import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import { Crosshair, LocateFixed, Minus, MoreHorizontal, MoveRight, Plus, X } from 'lucide-react';
import { connectScene } from '../sceneBridge';
import type { WorkspaceController } from '../workspace';
import type { OfficeDestination, OfficeSafeRect, OfficeSceneAdapter } from './types';
import type { Language, MessageKey } from '../i18n';
import { translate } from '../i18n';
import { createOfficeSceneAdapter } from './sceneAdapter';

export function OfficeCanvas({ controller, onCreateAgent, language = 'zh' }: { controller: WorkspaceController; onCreateAgent?: () => void; language?: Language }) {
  const t = (key: MessageKey, values?: Record<string, string | number>) => translate(language, key, values);
  const targetId = useId();
  const host = useRef<HTMLDivElement>(null);
  const stageWrap = useRef<HTMLDivElement>(null);
  const menu = useRef<HTMLDivElement>(null);
  const moreButton = useRef<HTMLButtonElement>(null);
  const adapter = useRef<OfficeSceneAdapter | null>(null);
  const [destinations, setDestinations] = useState<OfficeDestination[]>([]);
  const [target, setTarget] = useState('');
  const [preview, setPreview] = useState(false);
  const [generation, setGeneration] = useState(0);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; returnTo: 'stage' | 'more' } | null>(null);
  const [menuPosition, setMenuPosition] = useState<{ left: number; top: number } | null>(null);
  const [feedback, setFeedback] = useState({ message: t('office.loading'), kind: 'info' as 'info' | 'success' | 'error' });

  useEffect(() => {
    if (!host.current) return;
    const instance = createOfficeSceneAdapter(host.current, {
      t,
      onReady(next) {
        setDestinations(next);
        setTarget(current => current && next.some(item => item.id === current) ? current : next[0]?.id || '');
      },
      onFeedback(message, kind) { setFeedback({ message, kind }); },
      onPreviewChange(enabled) { setPreview(enabled); if (!enabled) setContextMenu(null); },
      onContextMenu(request) { setMenuPosition(null); setContextMenu({ x: request.x, y: request.y, returnTo: 'stage' }); },
      getSafeRect(): OfficeSafeRect {
        const bounds = stageWrap.current?.getBoundingClientRect();
        if (!bounds) return { left: 0, top: 0, right: 1, bottom: 1 };
        const overlaps = [...document.querySelectorAll<HTMLElement>('.inspector, .office-context-menu')]
          .map(element => element.getBoundingClientRect())
          .filter(rect => rect.right > bounds.left && rect.left < bounds.right && rect.bottom > bounds.top && rect.top < bounds.bottom);
        let left = 0;
        let top = 0;
        let right = bounds.width;
        let bottom = bounds.height;
        for (const rect of overlaps) {
          if (rect.left <= bounds.left && rect.right > bounds.left) left = Math.max(left, rect.right - bounds.left);
          if (rect.top <= bounds.top && rect.bottom > bounds.top) top = Math.max(top, rect.bottom - bounds.top);
          if (rect.right >= bounds.right && rect.left < bounds.right) right = Math.min(right, rect.left - bounds.left);
          if (rect.bottom >= bounds.bottom && rect.top < bounds.bottom) bottom = Math.min(bottom, rect.top - bounds.top);
        }
        return { left, top, right, bottom };
      },
    });
    instance.bindSelect(selection => selection ? controller.select(selection) : controller.clearSelection());
    adapter.current = instance;
    const disconnect = connectScene(controller.store, instance, controller.subscribeNavigation);
    return () => { adapter.current = null; disconnect(); };
  }, [controller, generation, language]);

  useLayoutEffect(() => {
    if (!contextMenu || !menu.current || !stageWrap.current) return;
    const bounds = stageWrap.current.getBoundingClientRect();
    const menuBounds = menu.current.getBoundingClientRect();
    const gap = 8;
    const left = Math.max(gap, Math.min(contextMenu.x - menuBounds.width / 2, bounds.width - menuBounds.width - gap));
    const preferredTop = contextMenu.y + gap;
    const top = Math.max(gap, Math.min(
      preferredTop + menuBounds.height <= bounds.height - gap ? preferredTop : contextMenu.y - menuBounds.height - gap,
      bounds.height - menuBounds.height - gap,
    ));
    setMenuPosition({ left, top });
    requestAnimationFrame(() => menu.current?.querySelector<HTMLButtonElement>('button:not(:disabled)')?.focus());
  }, [contextMenu]);

  function closeMenu(restoreFocus = true) {
    const returnTo = contextMenu?.returnTo;
    setContextMenu(null);
    setMenuPosition(null);
    if (restoreFocus) requestAnimationFrame(() => (returnTo === 'more' ? moreButton.current : host.current)?.focus());
  }

  function menuKeyDown(event: React.KeyboardEvent<HTMLDivElement>) {
    if (event.key === 'Escape') { event.preventDefault(); closeMenu(); return; }
    if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) return;
    const items = [...(menu.current?.querySelectorAll<HTMLButtonElement>('button:not(:disabled)') || [])];
    if (!items.length) return;
    event.preventDefault();
    const current = items.indexOf(document.activeElement as HTMLButtonElement);
    const next = event.key === 'Home' ? 0 : event.key === 'End' ? items.length - 1
      : event.key === 'ArrowDown' ? (current + 1 + items.length) % items.length : (current - 1 + items.length) % items.length;
    items[next].focus();
  }

  function togglePreview() {
    const next = !preview;
    setPreview(next);
    setContextMenu(null);
    adapter.current?.setPreview(next);
  }

  return <section className="office-surface" aria-label={t('office.canvas')}>
    <div className="office-toolbar" aria-label={t('office.canvas')}>
      <div className="office-mode" role="group" aria-label={language === 'zh' ? '场景模式' : 'Scene mode'}>
        <button className={!preview ? 'active' : ''} aria-pressed={!preview} onClick={() => { if (preview) togglePreview(); }}>{t('office.workspaceMode')}</button>
        <button className={preview ? 'active' : ''} aria-pressed={preview} onClick={() => { if (!preview) togglePreview(); }}>{t('office.demoMode')}</button>
      </div>
      <div className="office-target">
        <label htmlFor={targetId}>{t('office.target')}</label>
        <select id={targetId} value={target} onChange={event => setTarget(event.target.value)}>
          {destinations.map(item => <option key={item.id} value={item.id}>{item.label}{item.occupied ? ` · ${t('office.occupied')}` : ''}</option>)}
        </select>
        <button className="primary move-command" disabled={!preview || !target} onClick={() => adapter.current?.moveSelected(target)}>
          <MoveRight size={16} />{t('action.move')}
        </button>
      </div>
      <div className="office-tools">
        {onCreateAgent && <button className="primary office-add-agent" aria-label={t('action.addAgent')} onClick={onCreateAgent}><Plus size={16} />{t('action.addAgent')}</button>}
        <button className="icon" title={t('action.zoomOut')} aria-label={t('action.zoomOut')} onClick={() => adapter.current?.zoomBy(-1)}><Minus size={17} /></button>
        <button className="icon" title={t('action.zoomIn')} aria-label={t('action.zoomIn')} onClick={() => adapter.current?.zoomBy(1)}><Plus size={17} /></button>
        <button className="icon" title={t('action.overview')} aria-label={t('action.overview')} onClick={() => adapter.current?.overview()}><LocateFixed size={17} /></button>
        <button className="icon" title={t('action.focus')} aria-label={t('action.focus')} onClick={() => adapter.current?.focusSelected()}><Crosshair size={17} /></button>
        <button ref={moreButton} className="icon touch-more" title={t('action.more')} aria-label={t('action.more')}
          aria-expanded={contextMenu !== null} onClick={() => {
            if (contextMenu) { closeMenu(); return; }
            setMenuPosition(null);
            setContextMenu({ x: Math.max(18, (stageWrap.current?.clientWidth || 36) - 18), y: 18, returnTo: 'more' });
          }}><MoreHorizontal size={18} /></button>
      </div>
    </div>
    <div className="office-stage-wrap" ref={stageWrap}>
      <div className="office-stage" ref={host} tabIndex={0} aria-label={t('office.canvas')} />
      {contextMenu && <div ref={menu} className="office-context-menu" role="menu" aria-label={t('office.sceneActions')}
        onKeyDown={menuKeyDown} style={{ left: menuPosition?.left ?? contextMenu.x, top: menuPosition?.top ?? contextMenu.y, visibility: menuPosition ? 'visible' : 'hidden' }}>
        <button role="menuitem" disabled={!preview || !target} onClick={() => { adapter.current?.moveSelected(target); closeMenu(); }}>
          <MoveRight size={16} />{t('action.move')}
        </button>
        <button role="menuitem" onClick={() => { adapter.current?.focusSelected(); closeMenu(); }}>
          <Crosshair size={16} />{t('office.focusMember')}
        </button>
        <button className="icon" role="menuitem" aria-label={t('office.closeSceneActions')} title={t('office.closeSceneActions')} onClick={() => closeMenu()}><X size={16} /></button>
      </div>}
    </div>
    <div className={`office-feedback ${feedback.kind}`} role="status" aria-live="polite">
      <span className="connection-dot" />{feedback.message}
      {feedback.kind === 'error' && <button className="retry-scene" onClick={() => setGeneration(value => value + 1)}>{t('office.retryScene')}</button>}
      <span className="drag-hint">{t('office.dragHint')}</span>
      {preview && <strong>{t('office.demoNotSaved')}</strong>}
    </div>
  </section>;
}
