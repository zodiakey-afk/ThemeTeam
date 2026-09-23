import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import { Crosshair, LocateFixed, Minus, MoreHorizontal, MoveRight, Plus, X } from 'lucide-react';
import { connectScene } from '../sceneBridge';
import type { WorkspaceController } from '../workspace';
import type { OfficeDestination, OfficeSafeRect, OfficeSceneAdapter } from './types';
import { createOfficeSceneAdapter } from './sceneAdapter';

export function OfficeCanvas({ controller, onCreateAgent }: { controller: WorkspaceController; onCreateAgent?: () => void }) {
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
  const [feedback, setFeedback] = useState({ message: '正在加载办公室场景', kind: 'info' as 'info' | 'success' | 'error' });

  useEffect(() => {
    if (!host.current) return;
    const instance = createOfficeSceneAdapter(host.current, {
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
  }, [controller, generation]);

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

  return <section className="office-surface" aria-label="办公室画布">
    <div className="office-toolbar" aria-label="办公室画布工具">
      <div className="office-mode" role="group" aria-label="场景模式">
        <button className={!preview ? 'active' : ''} aria-pressed={!preview} onClick={() => { if (preview) togglePreview(); }}>工作区</button>
        <button className={preview ? 'active' : ''} aria-pressed={preview} onClick={() => { if (!preview) togglePreview(); }}>演示</button>
      </div>
      <div className="office-target">
        <label htmlFor={targetId}>目标</label>
        <select id={targetId} value={target} onChange={event => setTarget(event.target.value)}>
          {destinations.map(item => <option key={item.id} value={item.id}>{item.label}{item.occupied ? ' · 已占用' : ''}</option>)}
        </select>
        <button className="primary move-command" disabled={!preview || !target} onClick={() => adapter.current?.moveSelected(target)}>
          <MoveRight size={16} />移动
        </button>
      </div>
      <div className="office-tools">
        {onCreateAgent && <button className="primary office-add-agent" aria-label="新增员工" onClick={onCreateAgent}><Plus size={16} />新增员工</button>}
        <button className="icon" title="缩小" aria-label="缩小画布" onClick={() => adapter.current?.zoomBy(-1)}><Minus size={17} /></button>
        <button className="icon" title="放大" aria-label="放大画布" onClick={() => adapter.current?.zoomBy(1)}><Plus size={17} /></button>
        <button className="icon" title="总览" aria-label="办公室总览" onClick={() => adapter.current?.overview()}><LocateFixed size={17} /></button>
        <button className="icon" title="聚焦选中成员" aria-label="聚焦选中成员" onClick={() => adapter.current?.focusSelected()}><Crosshair size={17} /></button>
        <button ref={moreButton} className="icon touch-more" title="更多场景操作" aria-label="更多场景操作"
          aria-expanded={contextMenu !== null} onClick={() => {
            if (contextMenu) { closeMenu(); return; }
            setMenuPosition(null);
            setContextMenu({ x: Math.max(18, (stageWrap.current?.clientWidth || 36) - 18), y: 18, returnTo: 'more' });
          }}><MoreHorizontal size={18} /></button>
      </div>
    </div>
    <div className="office-stage-wrap" ref={stageWrap}>
      <div className="office-stage" ref={host} tabIndex={0} aria-label="可交互等轴办公室场景" />
      {contextMenu && <div ref={menu} className="office-context-menu" role="menu" aria-label="成员场景操作"
        onKeyDown={menuKeyDown} style={{ left: menuPosition?.left ?? contextMenu.x, top: menuPosition?.top ?? contextMenu.y, visibility: menuPosition ? 'visible' : 'hidden' }}>
        <button role="menuitem" disabled={!preview || !target} onClick={() => { adapter.current?.moveSelected(target); closeMenu(); }}>
          <MoveRight size={16} />移动到当前目标
        </button>
        <button role="menuitem" onClick={() => { adapter.current?.focusSelected(); closeMenu(); }}>
          <Crosshair size={16} />聚焦成员
        </button>
        <button className="icon" role="menuitem" aria-label="关闭场景操作" title="关闭场景操作" onClick={() => closeMenu()}><X size={16} /></button>
      </div>}
    </div>
    <div className={`office-feedback ${feedback.kind}`} role="status" aria-live="polite">
      <span className="connection-dot" />{feedback.message}
      {feedback.kind === 'error' && <button className="retry-scene" onClick={() => setGeneration(value => value + 1)}>重试场景</button>}
      {preview && <strong>演示位置不会保存</strong>}
    </div>
  </section>;
}
