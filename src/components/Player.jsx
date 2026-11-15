import { useEffect, useRef, useState } from 'react';
import { fmt, saveHist, toast } from '../lib/core.js';
import { watchStall } from '../lib/net.js';

const RATES = [1, 1.25, 1.5, 2, 0.75];

/* 全屏播放器。全屏是自绘的（is-fs + 竖屏 is-rot），不碰 Fullscreen API：
   手机上那套 API 在国产浏览器里行为不统一，自绘反而稳。 */
export default function Player({ item, onClose }) {
  const [open, setOpen] = useState(false);
  const [routes, setRoutes] = useState([]);
  const [ri, setRi] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [prog, setProg] = useState(0);
  const [dur, setDur] = useState(0);
  const [buffered, setBuffered] = useState(0);
  const [rate, setRate] = useState(1);
  const [muted, setMuted] = useState(false);
  const [fs, setFs] = useState(false);
  const [rot, setRot] = useState(false);
  const [hideUI, setHideUI] = useState(false);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');
  const [title, setTitle] = useState('');
  const [seekTip, setSeekTip] = useState('');   // 拖动进度条时的浮动时间气泡
  const tipRef = useRef(0);

  const vRef = useRef(null);
  const hlsRef = useRef(null);
  const uiT = useRef(0);
  const autoRef = useRef(0);
  const riRef = useRef(0);      // nextRoute 由 HLS 错误/卡顿回调触发，必须读 ref 而非渲染闭包
  const curRef = useRef(null);
  const stopRef = useRef(null);
  const startRef = useRef(null);   // 待起播的 {url,resumeAt}：视频节点挂载后才能 load
  const seekRef = useRef(null);
  const dragRef = useRef(false);

  /* 只重挂一次：item 换了才重新起播，父级重渲染不会打断播放 */
  const itemRef = useRef(null);
  const openRef = useRef(false);

  const showUI = sticky => {
    setHideUI(false);
    clearTimeout(uiT.current);
    if (sticky) return;
    uiT.current = setTimeout(() => { if (!vRef.current || !vRef.current.paused) setHideUI(true); }, 2600);
  };

  const killHls = () => {
    if (stopRef.current) { try { stopRef.current(); } catch (e) {} stopRef.current = null; }
    if (hlsRef.current) { try { hlsRef.current.destroy(); } catch (e) {} hlsRef.current = null; }
  };

  const showErr = msg => { setErr(msg || ''); setLoading(false); };

  const load = (url, resumeAt) => {
    const v = vRef.current;
    if (!v || !url) return;
    killHls();
    setErr('');
    setLoading(true);
    if (window.Hls && window.Hls.isSupported()) {
      const h = new window.Hls({
        maxBufferLength: 24, maxMaxBufferLength: 60, enableWorker: true,
        lowLatencyMode: false, backBufferLength: 30, manifestLoadingTimeOut: 9000,
        manifestLoadingMaxRetry: 1, levelLoadingMaxRetry: 2, fragLoadingMaxRetry: 2,
      });
      hlsRef.current = h;
      let switched = 0;
      h.on(window.Hls.Events.MANIFEST_PARSED, () => {
        setLoading(false);
        const r = resumeAt != null ? resumeAt : 0;
        if (r > 8 && Math.abs((v.duration || 0) - r) > 900) v.currentTime = r;
        v.play().catch(() => {});
      });
      h.on(window.Hls.Events.ERROR, (_, d) => {
        if (!d || !d.fatal) return;
        if (d.type === window.Hls.ErrorTypes.MEDIA_ERROR) { try { h.recoverMediaError(); } catch (e) {} return; }
        if (switched < 2 && nextRoute('auto')) { switched++; return; }
        setLoading(false);
        showErr('线路不可用，返回后换一条线路试试');
      });
      h.loadSource(url);
      h.attachMedia(v);
    } else {
      /* 原生 src 没有 Hls.ERROR 兜底，加载失败交给 <video> 的 onError */
      v.src = url;
      v.play().catch(() => {});
      setLoading(false);
    }
    const id = curRef.current && curRef.current.id;
    if (id) stopRef.current = watchStall(v, () => { nextRoute('stall'); });
    if (id) saveHist(id, 0, 0, curRef.current);
  };

  const nextRoute = () => {
    const ok = routes.map((r, i) => (r.ok !== false ? i : -1)).filter(i => i >= 0);
    if (ok.length < 2) return false;
    const at = ok.indexOf(riRef.current);
    const nx = ok[(at + 1) % ok.length];
    if (nx === riRef.current) return false;
    const v = vRef.current;
    const keep = v ? v.currentTime : 0;
    riRef.current = nx;
    setRi(nx);
    load(routes[nx].u, keep);
    toast('已切换线路');
    return true;
  };

  /* 起播 */
  useEffect(() => {
    if (!item) return;
    if (itemRef.current === item) return;
    itemRef.current = item;
    const list = Array.isArray(item.srcList) && item.srcList.length
      ? item.srcList
      : [{ u: item.src, tag: item.srcTag || '线路', ok: true }];
    const rs = list.map(r => ({
      u: r.u || r.src, tag: r.tag || r.srcTag || '线路', ok: r.ok !== false, ms: r.ms || 0,
    }));
    const start = Math.max(0, rs.findIndex(r => (r.u === (item.src || item.u))));
    setRoutes(rs);
    riRef.current = start;
    setRi(start);
    curRef.current = item;
    setTitle(item.title || '');
    setOpen(true);
    openRef.current = true;
    autoRef.current = 0;
    /* 不能在这里直接 load：setOpen 之后视频节点还没挂上，vRef 仍是 null。
       留一份待起播参数，等 <video> 真正渲染出来再由下面的 effect 起播。 */
    startRef.current = { url: rs[start].u, resumeAt: item.resumeAt };
    setOpen(true);
  }, [item]);

  /* 视频节点挂载后起播；item 换了会重新走一遍 */
  useEffect(() => {
    if (!open) return;
    const pend = startRef.current;
    if (!pend) return;
    startRef.current = null;
    const v = vRef.current;
    if (!v) return;
    showUI(true);
    load(pend.url, pend.resumeAt);
  }, [open, item]);

  useEffect(() => () => { killHls(); clearTimeout(uiT.current); }, []);

  /* 拖动进度条：move/up 挂在 window 上，指针滑出进度条也不会断 */
  useEffect(() => {
    if (!open) return undefined;
    const mv = e => { if (dragRef.current) seekAt(e.clientX); };
    const up = () => { dragRef.current = false; setSeekTip(''); };
    window.addEventListener('pointermove', mv, { passive: true });
    window.addEventListener('pointerup', up);
    window.addEventListener('pointercancel', up);
    return () => {
      window.removeEventListener('pointermove', mv);
      window.removeEventListener('pointerup', up);
      window.removeEventListener('pointercancel', up);
    };
  }, [open]);

  const close = () => {
    const v = vRef.current;
    /* 关掉时补记一次进度：timeupdate 是 4Hz，最后几秒可能没赶上 */
    const c = curRef.current;
    if (c && c.id && v && v.duration) saveHist(c.id, v.currentTime / v.duration, v.currentTime, c);
    if (v) { try { v.pause(); v.removeAttribute('src'); v.load(); } catch (e) {} }
    killHls();
    setOpen(false);
    openRef.current = false;
    setFs(false); setRot(false); setErr(''); setLoading(false);
    if (onClose) onClose();
  };

  /* ESC 退播放器。全屏时先退全屏，再按一次才关，跟用户的预期一致。 */
  useEffect(() => {
    if (!open) return undefined;
    const onKey = e => {
      if (e.key !== 'Escape') return;
      if (fs) { setFs(false); setRot(false); showUI(); }
      else close();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, fs]);

  /* 竖屏全屏时把画面旋转 90°（自绘全屏，对齐旧版 rotCheck）。
     orientationchange 后 innerWidth/innerHeight 可能还没更新，延后一拍再量。 */
  useEffect(() => {
    if (!open) return undefined;
    const sync = () => setRot(fs && window.innerHeight > window.innerWidth);
    const onOrient = () => setTimeout(sync, 300);
    sync();
    window.addEventListener('resize', sync);
    window.addEventListener('orientationchange', onOrient);
    return () => {
      window.removeEventListener('resize', sync);
      window.removeEventListener('orientationchange', onOrient);
    };
  }, [open, fs]);

  const onTime = () => {
    const v = vRef.current;
    if (!v) return;
    const d = v.duration || 0;
    setDur(d);
    setProg(d ? v.currentTime / d : 0);
    setPlaying(!v.paused);
    try {
      if (v.buffered && v.buffered.length) setBuffered(v.buffered.end(v.buffered.length - 1) / (d || 1));
    } catch (e) {}
    const c = curRef.current;
    if (c && c.id) saveHist(c.id, d ? v.currentTime / d : 0, v.currentTime, c);
  };

  /* 进度条：按下就跳，按住拖动持续跟手。旧版用 pointer 事件是因为
     手机上一旦开始拖就不能再让页面滚动抢走手势，click 只能点不能拖。 */
  const seekAt = clientX => {
    const v = vRef.current;
    const el = seekRef.current;
    const d = (v && v.duration) || 0;
    if (!v || !el || !d) return;
    const r = el.getBoundingClientRect();
    const p = Math.max(0, Math.min(1, (clientX - r.left) / r.width));
    v.currentTime = p * d;
    /* 气泡跟着手指走：left 用百分比定位，文案写进 state。
       注意 React 的 style.left 会被下一次渲染覆盖，所以 left 只写在 DOM 上、
       并且渲染时一并把它写回，避免气泡横向跳回 0。 */
    tipRef.current = p;
    const tip = el.querySelector('#seekTip');
    if (tip) tip.style.left = (p * 100) + '%';
    setSeekTip(fmt(p * d));
    onTime();
  };
  const onSeekDown = e => {
    e.preventDefault();
    seekAt(e.clientX);
    dragRef.current = true;
    showUI();
  };

  if (!open) return null;

  const cur = routes[ri] || null;

  return (
    <div className={'player' + (open ? ' is-on' : '') + (fs ? ' is-fs' : '') + (fs && rot ? ' is-rot' : '')} id="player">
      <video
        id="video"
        ref={vRef}
        playsInline
        x5-playsinline=""
        x5-video-player-type="h5"
        disablePictureInPicture
        preload="none"
        onClick={() => { if (hideUI) showUI(); else { clearTimeout(uiT.current); setHideUI(true); } }}
        onError={() => {
          /* HLS 场景由 hls.js 的 ERROR 处理，这里只兜原生 src 的加载失败 */
          if (hlsRef.current) return;
          if (!nextRoute()) showErr('线路不可用，返回后换一条线路试试');
        }}
        onTimeUpdate={onTime}
        onLoadedMetadata={onTime}
        onProgress={onTime}
        onPlay={() => { setPlaying(true); showUI(); }}
        onPause={() => { setPlaying(false); showUI(true); }}
        onWaiting={() => setLoading(true)}
        onPlaying={() => setLoading(false)}
        onCanPlay={() => setLoading(false)}
        onEnded={() => {
          setPlaying(false);
          const c = curRef.current;
          if (c && c.id) saveHist(c.id, 1, 0, c);
        }}
      />
      <div className={'player__ui' + (hideUI ? ' is-hide' : '')} id="playerUI">
        <div className="player__top">
          <button className="iconbtn iconbtn--glass" id="btnPClose" aria-label="关闭" onClick={close}>
            <svg><use href="#i-close" /></svg>
          </button>
          <div className="player__title" id="pTitle">{title}</div>
          <button className="routebtn" id="pRoute" aria-label="切换线路"
            onClick={() => { if (routes.length > 1) nextRoute(); else toast('没有更多备用线路'); }}>
            <svg><use href="#i-signal" /></svg><span id="pRouteTxt">{cur ? (cur.ms ? cur.ms + ' ms' : cur.tag) : '自动'}</span>
          </button>
        </div>
        <button className={'player__big' + (hideUI ? ' is-hide' : '')} id="btnPBig" aria-label="播放/暂停"
          onClick={() => { const v = vRef.current; if (!v) return; if (v.paused) v.play().catch(() => {}); else v.pause(); }}>
          <svg><use href={playing ? '#i-pause' : '#i-play'} /></svg>
        </button>
        <div className="player__bottom">
          <div className="seek" id="seek" ref={seekRef} onPointerDown={onSeekDown}>
            <div className="seek__track">
              <div className="seek__buf" id="seekBuf" style={{ width: (buffered * 100).toFixed(2) + '%' }} />
              <div className="seek__fill" id="seekFill" style={{ width: (prog * 100).toFixed(2) + '%' }}><i /></div>
            </div>
            <span className={'seek__tip' + (seekTip ? ' on' : '')} id="seekTip"
              style={{ left: (tipRef.current * 100) + '%' }}>{seekTip}</span>
          </div>
          <div className="player__ctrl">
            <button className="pbtn" id="btnPPlay" aria-label="播放/暂停"
              onClick={() => { const v = vRef.current; if (!v) return; if (v.paused) v.play().catch(() => {}); else v.pause(); }}>
              <svg><use href={playing ? '#i-pause' : '#i-play'} /></svg>
            </button>
            <button className="pbtn" id="btnPBack10" aria-label="后退 10 秒"
              onClick={() => { const v = vRef.current; if (v) v.currentTime = Math.max(0, v.currentTime - 10); showUI(); }}>
              <svg><use href="#i-back10" /></svg>
            </button>
            <button className="pbtn" id="btnPFwd10" aria-label="前进 10 秒"
              onClick={() => { const v = vRef.current; if (v) v.currentTime = Math.min(v.duration || 0, v.currentTime + 10); showUI(); }}>
              <svg><use href="#i-forward" /></svg>
            </button>
            <span className="player__time" id="pTime">{fmt(prog * dur)} / {fmt(dur)}</span>
            <span className="player__spacer" />
            <button className="pbtn pbtn--rate" id="btnPRate" aria-label="倍速" onClick={() => {
              const k = (RATES.indexOf(rate) + 1) % RATES.length;
              setRate(RATES[k]);
              if (vRef.current) vRef.current.playbackRate = RATES[k];
              showUI();
            }}>{(rate === Math.round(rate) ? rate.toFixed(1) : String(rate))}×</button>
            <button className="pbtn" id="btnPMute" aria-label="静音" onClick={() => {
              const v = vRef.current;
              if (v) { v.muted = !v.muted; setMuted(v.muted); }
              showUI();
            }}>
              <svg><use href={muted ? '#i-mute' : '#i-volume'} /></svg>
            </button>
            <button className="pbtn" id="btnPFull" aria-label="全屏" onClick={() => { setFs(f => !f); showUI(); }}>
              <svg><use href={fs ? '#i-shrink' : '#i-full'} /></svg>
            </button>
          </div>
          {fs ? (
            <div className="player__exit">
              <button className="player__exitbtn" id="btnPExit" onClick={() => { setFs(false); setRot(false); }}>退出全屏</button>
            </div>
          ) : null}
        </div>
      </div>
      <div className={'player__loading' + (loading ? ' on' : '')} id="pLoading"><span /><span /><span /></div>
      {err ? <div className="player__err on" id="pErr" onClick={() => setErr('')}><p>{err}</p></div> : null}
    </div>
  );
}
