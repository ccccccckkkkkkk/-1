import { useRef } from 'react';

const TABS = [
  { nav: 'home', icon: 'i-home', label: '首页' },
  { nav: 'library', icon: 'i-tv', label: '片库' },
  { nav: 'mylist', icon: 'i-bookmark', label: '我的' },
];

/* 悬浮胶囊导航：长按 360ms 抬起，栏体小幅跟手，松手选中指针下方的项。
   定位始终用「按下时的栏体范围」——栏体自己也在平移，用新位置算会永远选不中 */
export default function Tabbar({ route, onNav }) {
  const barRef = useRef(null);
  const pillRef = useRef(null);
  const lensRef = useRef(null);
  const idx = Math.max(0, TABS.findIndex(t => t.nav === route));
  const st = useRef({ armed: false, dragging: false, pid: null, sx: 0, sy: 0, rawDx: 0, rawDy: 0, baseL: 0, baseW: 1, hold: 0, hot: null });

  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);

  const tabEls = () => barRef.current ? [...barRef.current.querySelectorAll('.tab')] : [];

  const tabAt = x => {
    const tabs = tabEls();
    const s = st.current;
    let rel = (x - s.baseL) / s.baseW;
    if (rel < 0) rel = 0;
    if (rel > 0.999) rel = 0.999;
    return tabs[Math.floor(rel * tabs.length)] || null;
  };

  const reset = () => {
    const bar = barRef.current, s = st.current;
    clearTimeout(s.hold);
    if (bar) {
      bar.classList.remove('is-drag', 'is-touch');
      bar.style.removeProperty('--dx');
      bar.style.removeProperty('--dy');
    }
    if (s.hot) { s.hot.classList.remove('is-lift'); s.hot = null; }
    if (lensRef.current) lensRef.current.removeAttribute('style');
    if (pillRef.current) pillRef.current.style.setProperty('--i', idx);
    s.armed = false; s.dragging = false; s.pid = null; s.rawDx = 0; s.rawDy = 0;
  };

  const onDown = e => {
    if (e.button === 1 || e.button === 2) return;
    const bar = barRef.current, s = st.current;
    const r0 = bar.getBoundingClientRect();
    s.baseL = r0.left; s.baseW = r0.width;
    s.sx = e.clientX; s.sy = e.clientY; s.rawDx = s.rawDy = 0;
    s.armed = true; s.dragging = false; s.pid = e.pointerId;
    bar.classList.add('is-touch');   // 按下即点亮透镜高光，reset 里摘掉
    clearTimeout(s.hold);
    s.hold = setTimeout(() => {
      if (!s.armed) return;
      s.dragging = true;
      try { bar.setPointerCapture(s.pid); } catch (err) {}
      bar.classList.add('is-drag');
      if (navigator.vibrate) { try { navigator.vibrate(12); } catch (err) {} }
      const h = tabAt(s.sx);
      if (h) { h.classList.add('is-lift'); s.hot = h; }
    }, 360);
  };

  const onMove = e => {
    const bar = barRef.current, s = st.current;
    if (!s.armed) return;
    if (!s.dragging) {
      if (Math.abs(e.clientX - s.sx) > 9 || Math.abs(e.clientY - s.sy) > 9) {
        clearTimeout(s.hold); s.armed = false;   // 想滚动/滑动，让给页面
      }
      return;
    }
    e.preventDefault();
    s.rawDx = e.clientX - s.sx; s.rawDy = e.clientY - s.sy;
    bar.style.setProperty('--dx', clamp(s.rawDx, -12, 12).toFixed(1) + 'px');
    bar.style.setProperty('--dy', clamp(s.rawDy, -8, 8).toFixed(1) + 'px');
    const n = tabEls().length;
    const rel = (e.clientX - s.baseL) / s.baseW;
    if (pillRef.current) pillRef.current.style.setProperty('--i', clamp(rel * n - 0.5, 0, n - 1).toFixed(3));
    if (lensRef.current) {
      const rr = bar.getBoundingClientRect();
      lensRef.current.style.setProperty('--lx', (((e.clientX - rr.left) / rr.width) * 100).toFixed(1) + '%');
      lensRef.current.style.setProperty('--ly', (((e.clientY - rr.top) / rr.height) * 100).toFixed(1) + '%');
    }
    const h = tabAt(e.clientX);
    if (h !== s.hot) {
      if (s.hot) s.hot.classList.remove('is-lift');
      s.hot = h;
      if (h) h.classList.add('is-lift');
    }
  };

  const onUp = () => {
    const s = st.current, bar = barRef.current;
    if (!s.armed && !s.dragging) return;
    const moved = Math.abs(s.rawDx) > 22 || Math.abs(s.rawDy) > 22;
    const target = s.dragging && moved && s.hot ? s.hot.dataset.nav : null;
    const wasDrag = s.dragging;
    reset();
    if (wasDrag && target) onNav(target);
    if (wasDrag) {   // 拖动后吞掉紧随其后的 click
      const kill = ev => { ev.stopPropagation(); ev.preventDefault(); };
      bar.addEventListener('click', kill, { capture: true, once: true });
      setTimeout(() => bar.removeEventListener('click', kill, true), 360);
    }
  };

  return (
    <nav className="tabbar" id="tabbar" aria-label="主导航"
      ref={barRef}
      onPointerDown={onDown}
      onPointerMove={onMove}
      onPointerUp={onUp}
      onPointerCancel={onUp}
      onLostPointerCapture={onUp}
    >
      <i className="tabbar__pill" id="tabPill" ref={pillRef} style={{ '--i': idx }} />
      <i className="tabbar__lens" id="tabLens" ref={lensRef} />
      {TABS.map((t, k) => (
        <button
          key={t.nav}
          className={'tab' + (k === idx ? ' is-on' : '')}
          data-nav={t.nav}
          onClick={() => onNav(t.nav)}
        >
          <svg><use href={'#' + t.icon} /></svg>
          <span>{t.label}</span>
        </button>
      ))}
    </nav>
  );
}
