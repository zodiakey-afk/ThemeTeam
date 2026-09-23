"""W02 supplemental deterministic persistence schedules and pre/post-commit faults."""
import json
import os
import subprocess
import sys
import tempfile
import threading
import unittest
from concurrent.futures import ThreadPoolExecutor
from contextlib import contextmanager
from unittest.mock import patch

from support import temporary_store
from themeteam.core.store import WorkspaceStore


class PersistenceTests(unittest.TestCase):
    def setUp(self):
        self.store, self.path = self.enterContext(temporary_store())

    def test_wb_serialization_write_and_flush_faults(self):
        self.store.save()
        before, blob = self.store.snapshot(), self.path.read_bytes()
        with patch('themeteam.core.store.json.dumps', side_effect=ValueError('serialize fault')):
            with self.assertRaises(ValueError):
                self.store.save()
        self.assertEqual(self.store.snapshot(), before)
        original = tempfile.NamedTemporaryFile
        for operation in ('write', 'flush'):
            @contextmanager
            def broken_writer(*args, **kwargs):
                with original(*args, **kwargs) as handle:
                    with patch.object(handle, operation, side_effect=OSError('write fault')):
                        yield handle
            with patch('tempfile.NamedTemporaryFile', side_effect=broken_writer):
                with self.assertRaises(OSError):
                    self.store.save()
            self.assertEqual(self.store.snapshot(), before)
            self.assertEqual(self.path.read_bytes(), blob)
            self.assertEqual(list(self.path.parent.iterdir()), [self.path])

    def test_wb_save_save_and_save_reload_serialized(self):
        real_replace = os.replace
        for second_operation in ('save', 'reload'):
            entered, release, second_done = threading.Event(), threading.Event(), threading.Event()
            def delayed_replace(*args):
                entered.set()
                if not release.wait(5):
                    raise TimeoutError('barrier')
                return real_replace(*args)
            def second():
                result = getattr(self.store, second_operation)()
                second_done.set()
                return result
            with patch('os.replace', side_effect=delayed_replace), ThreadPoolExecutor(max_workers=2) as pool:
                first = pool.submit(self.store.save)
                try:
                    self.assertTrue(entered.wait(2))
                    following = pool.submit(second)
                    self.assertFalse(second_done.wait(0.05))
                finally:
                    release.set()
                first.result(5)
                after = following.result(5)
            self.assertEqual(self.store.snapshot(), after)
            disk = json.loads(self.path.read_text(encoding='utf-8'))
            self.assertEqual(disk['tasks'], after['tasks'])
            self.assertEqual(disk['lastSavedAt'], after['lastSavedAt'])

    def test_wb_reload_mutation_serialized(self):
        self.store.save()
        self.store.create_task({'title': 'discarded by explicit reload'})
        entered, release, mutated = threading.Event(), threading.Event(), threading.Event()
        original = self.store._load_state
        def delayed_load():
            entered.set()
            if not release.wait(5):
                raise TimeoutError('barrier')
            return original()
        def mutate():
            self.store.create_task({'title': 'after reload'})
            mutated.set()
        with patch.object(self.store, '_load_state', side_effect=delayed_load), ThreadPoolExecutor(max_workers=2) as pool:
            reloading = pool.submit(self.store.reload)
            try:
                self.assertTrue(entered.wait(2))
                change = pool.submit(mutate)
                self.assertFalse(mutated.wait(0.05))
            finally:
                release.set()
            reloading.result(5)
            change.result(5)
        titles = [task['title'] for task in self.store.snapshot()['tasks']]
        self.assertIn('after reload', titles)
        self.assertNotIn('discarded by explicit reload', titles)

    def test_wb_restart_after_postcommit_process_exit(self):
        self.store.save()
        script = '''
import os, sys
from pathlib import Path
from themeteam.core.store import WorkspaceStore
store = WorkspaceStore(Path(sys.argv[1]))
store.create_task({'title': 'committed before exit'})
replace = os.replace
def crash_after_replace(*args):
    replace(*args)
    os._exit(23)
os.replace = crash_after_replace
store.save()
'''
        result = subprocess.run([sys.executable, '-B', '-c', script, str(self.path)], timeout=15)
        self.assertEqual(result.returncode, 23)
        recovered = WorkspaceStore(self.path).snapshot()
        self.assertEqual(recovered['tasks'][0]['title'], 'committed before exit')
        self.assertEqual(list(self.path.parent.iterdir()), [self.path])
