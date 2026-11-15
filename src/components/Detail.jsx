import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Card, { SkCard } from './Card.jsx';
import {
  api, esc, favHas, norm, showName, toast, toggleFav, useFav,
} from '../lib/core.js';
import { probeStream, fetchRtt, rank } from '../lib/net.js';
import { waitTx } from '../lib/sheet.js';

const fmtT = n => {
  n = Math.max(0, Math.floor(n || 0));
  const m = Math.floor(n / 60), s = n % 60;
  return (m < 10 ? '0' : '') + m + ':' + (s < 10 ? '0' : '') + s;
};
const hostOf = u => { try { return new URL(u).host; } catch (e) { return ''; } };

const latOf = ms => (!ms ? '' : ms <= 120 ? 'is-fast' : ms > 300 ? 'is-slow' : 'is-mid');

/* 详情加载骨架：api.detail 还没回来（且要等转场 is-tx 摘掉）时，
   正文用占位条，别把「空 stats + 选择线路 + 暂无简介」当成半张坏页给用户。
   标题不进骨架 —— 飞行层落地那一刻标题就得对得上卡片。 */
function LoadingBody() {
  return (
    <>
      <div className="dt__sk-stats">
        <span className="sk" style={{ width: 54, height: 13 }} />
        <span className="sk" style={{ width: 44, height: 13 }} />
        <span className="sk" style={{ width: 72, height: 13 }} />
      </div>
      <div className="sk" style={{ height: 46, borderRadius: 12, marginBottom: 12 }} />
      <div className="dt__sk-acts">
        <span className="sk" /><span className="sk" /><span className="sk" />
      </div>
      <div className="dt__card">
        <div className="sk" style={{ height: 11, width: '92%', marginBottom: 10 }} />
        <div className="sk" style={{ height: 11, width: '100%', marginBottom: 10 }} />
        <div className="sk" style={{ height: 11, width: '64%', marginBottom: 14 }} />
        <div className="sk" style={{ height: 11, width: 52 }} />
      </div>
      <div className="dt__rel">
        <div className="sk" style={{ height: 11, width: 72, marginBottom: 14 }} />
        <div className="grid dt__relSk"><SkCard /><SkCard /><SkCard /></div>
      </div>
    </>
  );
}

/* 详情页：整页覆盖，正文没有任何位移/错峰动画。
   线路探测走服务端 NDJSON 流，第一条能用的立刻定下来并回报给 app 起播。 */
export default function Detail({ show, autoPlay, onClose, onPlay, onRelated, onOpened }) {
  const fav = useFav();
  const s = show;

  const [detail, setDetail] = useState(null);
  const [metaState, setMetaState] = useState('loading');  // loading|ready|error：详情元数据
  const [lines, setLines] = useState([]);
  const [curEp, setCurEp] = useState('');
  const [probed, setProbed] = useState(null);
  const [rows, setRows] = useState({});       // url -> 探测结果
  const [curPick, setCurPick] = useState(null);
  const [listOpen, setListOpen] = useState(true);
  const [sumOpen, setSumOpen] = useState(false);
  const [srcOpen, setSrcOpen] = useState(false);
  const [panelState, setPanelState] = useState('idle');  // idle|loading|probing|done|error
  const [panelErr, setPanelErr] = useState('');
  const [probeNonce, setProbeNonce] = useState(0);   // 点「重新测速」自增，重跑整轮探测
  const [playing, setPlaying] = useState(false);
  const [prog, setProg] = useState(0);
  const [dur, setDur] = useState(0);
  const [ctrlIdle, setCtrlIdle] = useState(false);
  /* 骨架层与真实层叠放交叉淡入：数据到了不硬切，骨架淡出、内容淡入。
     淡出结束（300ms）再把骨架层从 DOM 摘掉，免得它一直参与布局。 */
  const [showSk, setShowSk] = useState(true);

  const videoRef = useRef(null);
  const sumRef = useRef(null);
  const hlsRef = useRef(null);
  const nowRef = useRef('');
  const aliveRef = useRef(true);
  const ctrlT = useRef(0);
  const bodyRef = useRef(null);

  const cur = useMemo(() => s, [s.id]);
  const onFav = favHas(cur.id);

  /* 详情元数据 + 线路。两段都等转场结束（is-tx 摘掉）再写重结构，
     否则 16KB 级的 DOM 变更会落在飞行动画的第一帧上。 */
  useEffect(() => {
    aliveRef.current = true;
    let dead = false;
    (async () => {
      try {
        const d = await api.detail(cur.id);
        if (dead || !aliveRef.current) return;
        /* 数据回来了也要压住：这 16KB 正文建树 + 布局是整段打开流程里最大的一笔，
           落在飞行的 380ms 里就是一次 100ms 以上的长任务。等 is-tx 摘掉再写。 */
        await waitTx();
        if (dead || !aliveRef.current) return;
        setMetaState('ready');
        setDetail(d);
        const e0 = d.lines && d.lines[0] && d.lines[0].eps && d.lines[0].eps[0];
        if (e0) setCurEp(String(e0.ep));
        else { setPanelErr('暂无可用选集'); setPanelState('error'); }
      } catch (e) {
        if (!dead) { setMetaState('error'); setPanelErr(e.message || '网络异常'); setPanelState('error'); }
      }
    })();
    return () => { dead = true; };
  }, [cur.id]);

  /* 骨架与真实内容交叉淡入：ready/error 一到 stage 就加 is-ready 触发淡出淡入，
     300ms 过渡走完再把骨架层从 DOM 摘掉。 */
  useEffect(() => {
    if (metaState === 'loading') return undefined;
    const t = setTimeout(() => setShowSk(false), 300);
    return () => clearTimeout(t);
  }, [metaState]);

  useEffect(() => {
    if (!curEp) return undefined;
    let dead = false;
    setPanelState('loading');
    (async () => {
      try {
        const d = await api.lines(cur.id, curEp);
        if (dead) return;
        await waitTx();
        if (dead) return;
        const list = (d.lines || []).map(L => ({
          u: L.url, name: L.name, tag: L.name, t: 'hls', host: hostOf(L.url),
          eps: L.eps || [],
        }));
        if (!list.length) throw new Error('这条线路取不到地址');
        setLines(list);
        setRows({});
        setProbed(null);
        setCurPick(null);
        setPanelState('probing');
      } catch (e) {
        if (!dead) { setPanelErr(e.message || '网络异常'); setPanelState('error'); }
      }
    })();
    return () => { dead = true; };
  }, [cur.id, curEp]);

  /* 探测：第一条 ok 立刻定线路 */
  useEffect(() => {
    if (!lines.length) return undefined;
    let dead = false;
    let stop = null;
    /* 重新测速：上一轮的毫秒与排名全部作废，否则旧结果会盖住新读数 */
    if (probeNonce) { setRows({}); setProbed(null); setPanelState('probing'); }
    const hooks = {
      onEach(r) {
        if (dead) return;
        setRows(m => ({ ...m, [r.u]: r }));
        if (r.ok) {
          setProbed(p => {
            if (p) return p;
            const src = lines.find(x => x.u === r.u);
            toast(autoPlay ? '已找到可用线路 · 开始播放' : '首选线路已就绪');
            return [{ ...src, ...r, tag: (src && src.tag) || 'CDN', done: true, ok: true }];
          });
        }
      },
    };
    const p = probeStream(lines, hooks);
    stop = () => { if (hooks.cancel) hooks.cancel(); };
    p.then(res => {
      if (dead) return;
      const list = rank((res || []).filter(Boolean)).map((r, i) => {
        const src = lines.find(x => x.u === r.u) || {};
        return { ...src, ...r, tag: src.tag || 'CDN', done: true, ok: !!r.ok, bestMark: i === 0 && !!r.ok };
      });
      setProbed(list);
      setPanelState('done');
      const b = list[0];
      if (b && b.ok) toast(`已优选 · ${b.tag}${b.ms ? ' ' + b.ms + ' ms' : ''}`);
      else toast('线路都不稳定，可手动选一条试试');
    }).catch(() => { if (!dead) setPanelState('done'); });
    fetchRtt(lines.map(x => x.host)).then(map => {
      if (dead || !map) return;
      setRows(m => {
        const n = { ...m };
        Object.keys(n).forEach(u => {
          const h = n[u] && n[u].host;
          if (h && map[h] > 0) n[u] = { ...n[u], ms: map[h] };
        });
        return n;
      });
    }).catch(() => {});
    return () => { dead = true; stop && stop(); };
  }, [lines, probeNonce]);

  /* 定下首选线路后同步给播放按钮。
     注意 probed 第一次落地时只有「第一条 ok」，infoBar 也只需要这一条。 */
  useEffect(() => {
    if (!probed || !probed.length) return;
    const b = probed.find(r => r.ok);
    if (!b) return;
    setCurPick(prev => prev || { ...b, src: b.u, srcTag: b.tag, srcList: probed });
  }, [probed]);

  /* 自动播放：第一条可用线路一出来就走，不去等剩下 15 条探完。
     播放器自己会拿这一条当主线路，其余线路回来后再由 onPlay 更新。 */
  const firedRef = useRef(false);
  /* 自动起播在 240ms 后才触发，那时 probed 可能已从「首条 ok」长成完整排名；
     用 ref 读最新值，别锁死在 curPick 首次落地时的闭包里。 */
  const probedRef = useRef(null);
  probedRef.current = probed;
  useEffect(() => {
    if (!autoPlay || firedRef.current || !curPick) return;
    firedRef.current = true;
    const first = curPick;
    const t = setTimeout(() => {
      onPlay({
        ...first,
        id: cur.id,
        title: (detail && detail.title) || cur.title,
        poster: cur.poster,
        year: cur.year,
        srcList: probedRef.current || [],
      });
    }, 240);
    return () => clearTimeout(t);
  }, [autoPlay, curPick]);

  /* ---------- 页内播放 ---------- */
  const dtStop = useCallback(() => {
    if (hlsRef.current) { try { hlsRef.current.destroy(); } catch (e) {} hlsRef.current = null; }
    const v = videoRef.current;
    if (v) { try { v.pause(); v.removeAttribute('src'); v.load(); } catch (e) {} }
    nowRef.current = '';
    setPlaying(false);
    setProg(0);
  }, []);

  const dtStart = useCallback(src => {
    const v = videoRef.current;
    if (!v || !src) return;
    dtStop();
    nowRef.current = src;
    setPlaying(true);
    if (window.Hls && window.Hls.isSupported()) {
      const h = new window.Hls({
        maxBufferLength: 24, maxMaxBufferLength: 60, enableWorker: true,
        lowLatencyMode: false, backBufferLength: 20, manifestLoadingTimeOut: 9000,
        manifestLoadingMaxRetry: 1, levelLoadingMaxRetry: 2, fragLoadingMaxRetry: 2,
      });
      hlsRef.current = h;
      h.loadSource(src);
      h.attachMedia(v);
      h.on(window.Hls.Events.MANIFEST_PARSED, () => { v.play().catch(() => {}); });
      h.on(window.Hls.Events.ERROR, (_, d) => {
        if (!d || !d.fatal) return;
        if (d.type === window.Hls.ErrorTypes.MEDIA_ERROR) { try { h.recoverMediaError(); } catch (e) {} return; }
        toast('这条线路播不动，换一条试试');
        setPlaying(false);
        nowRef.current = '';
      });
    } else {
      v.src = src;
      v.play().catch(() => {});
    }
  }, [dtStop]);

  useEffect(() => () => dtStop(), [dtStop]);

  const ctrlShow = useCallback(() => {
    setCtrlIdle(false);
    clearTimeout(ctrlT.current);
    ctrlT.current = setTimeout(() => {
      const v = videoRef.current;
      if (nowRef.current && v && !v.paused) setCtrlIdle(true);
    }, 3200);
  }, []);
  useEffect(() => { ctrlShow(); return () => clearTimeout(ctrlT.current); }, [ctrlShow]);

  const onTime = () => {
    const v = videoRef.current;
    if (!v) return;
    const d = v.duration || 0;
    setDur(d);
    setProg(d ? Math.min(1, v.currentTime / d) : 0);
  };

  const togglePP = () => {
    const v = videoRef.current;
    if (!curPick) { toast('正在优选线路，稍等一下'); return; }
    const src = curPick.src || curPick.u;
    if (nowRef.current && nowRef.current === src) {
      if (v.paused) { v.play().catch(() => {}); setPlaying(true); } else { v.pause(); setPlaying(false); }
      return;
    }
    dtStart(src);
  };

  const seekTap = e => {
    const v = videoRef.current;
    const d = (v && v.duration) || 0;
    if (!d) return;
    const r = e.currentTarget.getBoundingClientRect();
    v.currentTime = Math.max(0, Math.min(d, ((e.clientX - r.left) / r.width) * d));
    onTime();
  };

  /* ---------- 简介展开：高度补间，不位移 ---------- */
  const toggleSum = () => {
    const el = sumRef.current;
    if (!el) return;
    const h0 = el.getBoundingClientRect().height;
    const open = !sumOpen;
    setSumOpen(open);
    requestAnimationFrame(() => {
      const h1 = el.getBoundingClientRect().height;
      el.style.overflow = 'hidden';
      el.style.transition = 'max-height .32s cubic-bezier(.22,.68,.16,1)';
      el.style.maxHeight = h0 + 'px';
      void el.offsetWidth;
      el.style.maxHeight = (open ? h1 : h0) + 'px';
      setTimeout(() => {
        el.style.maxHeight = open ? 'none' : '';
        el.style.overflow = '';
        el.style.transition = '';
      }, 340);
    });
  };

  const share = () => {
    const txt = `${showName(cur)}${cur.year ? ' (' + cur.year + ')' : ''} — NeonFlick`;
    if (navigator.share) { navigator.share({ title: showName(cur), text: txt }).catch(() => {}); return; }
    const ta = document.createElement('textarea');
    ta.value = txt;
    ta.style.cssText = 'position:fixed;opacity:0;pointer-events:none';
    document.body.appendChild(ta);
    ta.select();
    let ok = false;
    try { ok = document.execCommand('copy'); } catch (e) { ok = false; }
    document.body.removeChild(ta);
    toast(ok ? '片名已复制' : txt);
  };

  const goFull = () => {
    if (!curPick) { toast('正在优选线路，稍等一下'); return; }
    const v = videoRef.current;
    const at = nowRef.current && v ? v.currentTime : 0;
    dtStop();
    onPlay({
      ...curPick,
      id: cur.id,
      title: (detail && detail.title) || cur.title,
      poster: cur.poster,
      year: cur.year,
      srcList: probed || [],
      resumeAt: at,
    });
  };

  /* ---------- 渲染所需派生 ---------- */
  const epList = useMemo(() => {
    const seen = new Set(), out = [];
    (detail && detail.lines ? detail.lines : []).forEach(L => (L.eps || []).forEach(e => {
      const k = String(e.ep);
      if (!seen.has(k)) { seen.add(k); out.push(k); }
    }));
    return out;
  }, [detail]);

  const stats = useMemo(() => {
    const d = detail || {};
    const bits = [];
    if (d.year) bits.push(<span key="y">{d.year}</span>);
    if (d.region) bits.push(<span key="r">{d.region}</span>);
    if (d.rating) bits.push(<b key="s"><svg><use href="#i-star" /></svg>{d.rating}</b>);
    if (d.lines && d.lines.length) bits.push(<span key="l">{d.lines.length} 条线路</span>);
    if (epList.length > 1) bits.push(<span key="e">共 {epList.length} 集</span>);
    (d.genres || []).slice(0, 3).forEach((g, i) => bits.push(<i key={'g' + i}>{g}</i>));
    return bits.reduce((acc, node, i) => (i ? acc.concat(<i className="dot" key={'d' + i} />, node) : [node]), []);
  }, [detail, epList.length]);

  const dir = (detail && detail.directors || []).filter(Boolean);
  const act = (detail && detail.actors || []).filter(Boolean);
  /* 主创不再单独占一行（头像 + 名字 + 收藏），收进简介卡顶部：
     头像那一列除了重复片名首字没有任何信息量，白吃掉 53px 高度。 */
  const crewLine = [
    dir.length ? `导演 ${dir.join(' / ')}` : '',
    act.length ? `主演 ${act.slice(0, 2).join(' / ')}` : '',
  ].filter(Boolean).join(' · ');
  const rawSummary = (detail && detail.summary) || '暂无简介。';
  /* 主创不再单列一栏：头像那列除了重复片名首字没有信息量，白吃 53px。
     直接并进简介正文，详情页少一行、少一个圆头像。 */
  const summary = crewLine ? crewLine + '。' + rawSummary : rawSummary;
  const needMore = summary.length > 96;

  /* 行列表始终是全部线路：probed 只保存探测结果，别拿它当行数，
     否则第一条 ok 一回来整列就塌成一两条。 */
  const pMap = useMemo(() => {
    const m = {};
    (probed || []).forEach(r => { if (r && r.u) m[r.u] = r; });
    return m;
  }, [probed]);
  const rowList = lines.map(p => ({ ...p, done: false, bestMark: !!(pMap[p.u] && pMap[p.u].bestMark) }));
  const shownRows = listOpen ? rowList : rowList.slice(0, 1);

  /* 点线路就是「用这条播」。不能只在 probed 里找：probed 在探测进行中只有
     「第一条 ok」，点别的好行会找不到而静默失败。改成实时行 → 探测结果 → 原始行三级兜底。 */
  const pickRow = u => {
    const r = rows[u];
    const base = lines.find(x => x.u === u) || {};
    const hit = r || pMap[u] || base;
    if (!hit || !u) return;
    setCurPick({ ...base, ...hit, u, src: u, srcTag: hit.tag || base.tag, srcList: probed || [] });
    dtStart(u);
  };

  useEffect(() => {
    if (onOpened) onOpened();
  }, [onOpened]);

  return (
    <div className="dt">
      <div className={'dt__hero' + (playing ? ' is-playing' : '')}>
        {/* 封面区不再挂视频海报：片名和海报在列表里已经看过一遍，
            点进来第一屏应该先认出「这是 NeonFlick」，所以放品牌标记。 */}
        <div className="dt__logo" id="dtHero">
          <svg className="dt__logoMark" aria-hidden="true"><use href="#i-mark" /></svg>
          <em className="dt__logoName">NEON<i>FLICK</i></em>
        </div>
        <video
          id="dtVideo"
          ref={videoRef}
          playsInline
          x5-playsinline=""
          x5-video-player-type="h5"
          disablePictureInPicture
          disableRemotePlayback
          preload="none"
          onClick={togglePP}
          onTimeUpdate={onTime}
          onLoadedMetadata={onTime}
          onProgress={onTime}
          onPlay={() => { setPlaying(true); ctrlShow(); }}
          onPause={() => { setPlaying(false); setCtrlIdle(false); }}
        />
        <button className="dt__back" id="dtBack" aria-label="返回" onClick={onClose}>
          <svg><use href="#i-back" /></svg>
        </button>
        <span className="dt__badge" id="dtBadge">{(detail && (detail.note || detail.cat)) || cur.note || cur.cat || '影片'}</span>
        <div className={'dt__ctrl' + (ctrlIdle ? ' is-idle' : '')} id="dtCtrl">
          <button className="dt__pp" id="dtPP" aria-label="播放/暂停" onClick={togglePP}>
            <svg><use href={playing ? '#i-pause' : '#i-play'} /></svg>
          </button>
          <div className="dt__seek" id="dtSeek" onClick={seekTap}>
            <i id="dtBar" style={{ transform: `scaleX(${prog})` }} />
            <b id="dtKnob" style={{ transform: `translateX(${prog * 100}%)` }} />
          </div>
          <span className="dt__time" id="dtTime">{fmtT(prog * dur)} / {fmtT(dur)}</span>
          <button className="dt__fs" id="dtFs" aria-label="全屏" onClick={goFull}>
            <svg><use href="#i-full" /></svg>
          </button>
        </div>
      </div>

      <div className="dt__body" ref={bodyRef}>
        <h1 className="dt__title" id="dtTitle">{showName(cur)}</h1>
        <div className={'dt__stage' + (metaState !== 'loading' ? ' is-ready' : '')}>
          {showSk ? (
            <div key="sk" className="dt__layer dt__layer--sk" aria-hidden="true"><LoadingBody /></div>
          ) : null}
          {metaState !== 'loading' ? (
            <div key="real" className="dt__layer dt__layer--real">
              {metaState === 'error' ? (
                <div className="empty">
                  <svg><use href="#i-signal" /></svg>
                  <h3>详情加载失败</h3>
                  <p>{panelErr}</p>
                </div>
              ) : (
                <>
                  <div className="dt__stats" id="dtStats">{stats}</div>

                  <button className="dt__src" id="dtSrc" onClick={() => setSrcOpen(true)}>
                    <span className="dt__srcTxt" id="dtSrcTxt">
                      {curPick ? `${curPick.tag || '线路'}${curPick.ms ? ' · ' + curPick.ms + ' ms' : ''}` : '选择线路与选集'}
                    </span>
                    <svg className="dt__srcArr"><use href="#i-back" /></svg>
                  </button>

                  <div className="dt__acts">
                    <button className="actbtn" id="dtShare" onClick={share}>
                      <svg><use href="#i-forward" /></svg><span>分享</span>
                    </button>
                    <button className={'actbtn' + (onFav ? ' actbtn--on' : '')} id="dtFav2" onClick={() => toggleFav(cur)}>
                      <svg><use href={onFav ? '#i-check' : '#i-plus'} /></svg><span>{onFav ? '已收藏' : '收藏'}</span>
                    </button>
                    <button className="actbtn" id="dtDetect" onClick={() => { setSrcOpen(true); setProbeNonce(n => n + 1); }}>
                      <svg><use href="#i-signal" /></svg><span>测速</span>
                    </button>
                  </div>

                  <div className="dt__card">
                    <div
                      className={'dt__sum' + (sumOpen ? ' is-open' : '')}
                      id="dtSum"
                      ref={sumRef}
                    >{summary}</div>
                    {needMore ? (
                      <button className="dt__more" id="dtSumMore" onClick={toggleSum}>
                        {sumOpen ? '收起' : '展开全部'}
                      </button>
                    ) : null}
                  </div>

                  {detail && detail.related && detail.related.length ? (
                    <div className="dt__rel" id="dtRel">
                      <div className="dt__relK">相关推荐</div>
                      <div className="grid dt__relGrid" id="dtRelGrid">
                        {detail.related.map((it, i) => {
                          const n = norm(it);
                          return (
                            <Card key={n.id + ':' + i} s={n} onClick={(ss, from) => onRelated(ss, from)} />
                          );
                        })}
                      </div>
                    </div>
                  ) : null}
                </>
              )}
            </div>
          ) : null}
        </div>
      </div>

      <section className={'srcpanel' + (srcOpen ? ' is-open' : '')} id="srcPanel">
        <div className="srcpanel__hd">
          <b>选集与线路</b>
          <button className="srcpanel__x" id="srcClose" aria-label="关闭" onClick={() => setSrcOpen(false)}>
            <svg><use href="#i-close" /></svg>
          </button>
        </div>
        <div className="srcpanel__bd">
          <section className="sp-sec" id="spEps">
            <div className="sp-sec__hd">
              <b>选集</b>
              <span className="sp-sec__n" id="epsCount">
                {epList.length > 1 ? `共 ${epList.length} 集` : '单片'}
              </span>
            </div>
            <div id="epsBox">
              {epList.length < 2 ? (
                <div className="eps__one">单片 · 无需选集</div>
              ) : (
                <div className="eps">
                  {epList.map(e => (
                    <button
                      key={e}
                      className={'ep' + (e === curEp ? ' is-on' : '')}
                      type="button"
                      onClick={() => setCurEp(e)}
                    >{e}</button>
                  ))}
                </div>
              )}
            </div>
          </section>

          <section className="sp-sec" id="spLines">
            <div className="sp-sec__hd">
              <b>线路</b>
              <span className="sp-sec__n" id="picksK">
                {panelState === 'probing' ? '自动优选中' : `共 ${lines.length} 条 · 自动优选`}
              </span>
              <button className={'picks__re' + (panelState === 'probing' ? ' is-busy' : '')} id="picksRe"
                type="button" aria-label="重新测速"
                onClick={() => { if (panelState !== 'probing') setProbeNonce(n => n + 1); }}>
                <svg><use href="#i-refresh" /></svg>
              </button>
            </div>
            <div id="pickList">
              {panelState === 'loading' ? (
                <div className="picksk"><i className="spinner" /><span>正在获取线路…</span></div>
              ) : null}
              {panelState === 'error' ? (
                <div className="empty" style={{ padding: '26px 0' }}>
                  <svg><use href="#i-signal" /></svg>
                  <h3>{panelErr === '暂无可用选集' ? '暂无选集' : '线路获取失败'}</h3>
                  <p>{esc(panelErr)}</p>
                </div>
              ) : null}
              {shownRows.map((p, i) => {
                const r = rows[p.u] || pMap[p.u] || null;
                const ms = r && r.ms > 0 ? r.ms : 0;
                const done = !!(r && (r.done || p.done));
                const lat = done ? latOf(ms) : '';
                const live = !done ? '测速中…' : (r.ok ? (ms > 0 ? ms + ' ms' : '已连通') : (r.err || '不通'));
                const cls = !done ? 'is-probing' : (r.ok ? 'good' : 'bad');
                const sel = curPick && curPick.u === p.u;
                return (
                  <button
                    key={p.u + ':' + i}
                    type="button"
                    className={'pick' + (sel ? ' is-on' : '') + (p.bestMark ? ' is-best' : '') + (done && !r.ok ? ' is-dead' : '')}
                    onClick={() => pickRow(p.u)}
                  >
                    <span className="pick__n">{i + 1}</span>
                    <span className="pick__b">
                      <span className="pick__t">
                        <em>线路 {i + 1}</em> · {p.tag}
                        {p.bestMark ? <span className="pick__best">最快</span> : null}
                      </span>
                      <span className={'pick__s ' + lat}>{'HLS'} · {r && r.host || p.host} · {live}</span>
                    </span>
                    <span className={'pick__q ' + cls + ' ' + lat}>
                      {!done ? <i className="spinner" /> : (r.ok ? (ms > 0 ? <>{ms}<em>ms</em></> : '通') : '×')}
                    </span>
                  </button>
                );
              })}
              {rowList.length > 1 ? (
                <button className="picks__more" type="button" onClick={() => setListOpen(v => !v)}>
                  {listOpen ? '收起线路' : `展开全部 ${rowList.length} 条线路`}
                </button>
              ) : null}
            </div>
          </section>
        </div>
      </section>
    </div>
  );
}
