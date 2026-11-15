import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Topbar from './components/Topbar.jsx';
import Tabbar from './components/Tabbar.jsx';
import Home from './components/Home.jsx';
import Library from './components/Library.jsx';
import Mine from './components/Mine.jsx';
import Detail from './components/Detail.jsx';
import Player from './components/Player.jsx';
import Sprite from './components/Sprite.jsx';
import Card from './components/Card.jsx';
import { api, norm, toast } from './lib/core.js';
import {
  txBegin, txEnd, showSheetNow, sheetOpenFrom, sheetClipBack, sheetFadeOut, reduceMotion,
} from './lib/sheet.js';

const CAT_ORDER = ['1', '2', '3', '4', '6'];

export default function App() {
  /* ---------- 路由 ---------- */
  const [route, setRoute] = useState('home');
  const [tab, setTab] = useState('home');
  const [libCat, setLibCat] = useState('1');

  /* ---------- 首页数据 ---------- */
  const [home, setHome] = useState({ hero: [], sections: [] });
  const [homeLoading, setHomeLoading] = useState(true);
  const [homeErr, setHomeErr] = useState('');
  const homeReq = useRef(null);

  const loadHome = useCallback(() => {
    setHomeLoading(true);
    setHomeErr('');
    homeReq.current = api.home()
      .then(d => {
        setHome({ hero: d.hero || [], sections: (d.sections || []).filter(s => s.items && s.items.length >= 3) });
        setHomeLoading(false);
      })
      .catch(e => { setHomeErr(e.message || '网络异常'); setHomeLoading(false); });
    return homeReq.current;
  }, []);

  /* ---------- 「全部」列表（区块展开） ---------- */
  const [listView, setListView] = useState(null);   // {title, items}

  /* ---------- 详情 ---------- */
  const [sheet, setSheet] = useState(null);         // {show, from, autoPlay}
  const openRef = useRef(false);                    // 是否已经有详情开着（不能用 DOM ref 兼任）
  const curSheet = useRef(null);                    // 当前详情 {show,from}：回调里不能读 state 闭包
  const sheetElRef = useRef(null);
  const bodyRef = useRef(null);
  const closingRef = useRef(false);

  /* ---------- 播放器 ---------- */
  const [player, setPlayer] = useState(null);

  /* ---------- 搜索 ---------- */
  const [searchOpen, setSearchOpen] = useState(false);
  const [q, setQ] = useState('');
  const [results, setResults] = useState(null);     // null 未搜，[] 空结果
  const [searching, setSearching] = useState(false);
  const searchT = useRef(0);
  const inputRef = useRef(null);

  /* ---------- toast ---------- */
  const [toastMsg, setToastMsg] = useState('');
  const toastT = useRef(0);
  useEffect(() => {
    const onT = e => {
      setToastMsg(e.detail || '');
      clearTimeout(toastT.current);
      toastT.current = setTimeout(() => setToastMsg(''), 2100);
    };
    window.addEventListener('nf:toast', onT);
    return () => { window.removeEventListener('nf:toast', onT); clearTimeout(toastT.current); };
  }, []);

  /* ---------- 启动 ---------- */
  /* 启动遮罩是 index.html 里的静态节点：首屏立刻可见，React 挂载后接管淡出 */
  const [ready, setReady] = useState(false);
  useEffect(() => {
    let cancelled = false;
    let t = 0;
    /* 定时器必须由 effect 自己清理：写在 .finally 里的 return 会被 Promise 吞掉，
       卸载后仍可能 setReady。语义不变——首页数据回来后再等 260ms 收启动遮罩。 */
    loadHome().catch(() => {}).finally(() => {
      if (cancelled) return;
      t = setTimeout(() => { if (!cancelled) setReady(true); }, 260);
    });
    return () => { cancelled = true; clearTimeout(t); };
  }, [loadHome]);
  useEffect(() => {
    if (!ready) return;
    const b = document.getElementById('boot');
    if (b) {
      b.classList.add('is-gone');
      const t = setTimeout(() => { if (b.parentNode) b.parentNode.removeChild(b); }, 480);
      return () => clearTimeout(t);
    }
  }, [ready]);

  /* 顶层返回/前进：详情开着就是收详情 */
  const go = useCallback(name => {
    if (openRef.current) { closeDetail(); return; }
    setListView(null);
    setRoute(name);
    setTab(name);
    window.scrollTo({ top: 0 });
  }, []);

  const onTab = useCallback(name => {
    if (openRef.current) { closeDetail(); return; }
    setListView(null);
    if (name) { setRoute(name); setTab(name); window.scrollTo({ top: 0 }); }
    else setTab(null);
  }, []);

  /* ---------- 打开详情 ---------- */
  const openDetail = useCallback((s, from, autoPlay = false) => {
    if (!s || !s.id) return;
    const it = norm(s);
    /* 详情/播放器/搜索三者互斥：任何入口开详情都先把其它浮层收掉。 */
    if (player) setPlayer(null);
    if (searchOpen) closeSearch();
    if (openRef.current) {
      /* 已经在详情里点相关推荐：换一部，不重新飞行 */
      setSheet({ show: it, from: null, autoPlay });
      curSheet.current = { show: it, from: null, autoPlay };
      if (bodyRef.current) bodyRef.current.scrollTop = 0;
      return;
    }
    openRef.current = true;
    closingRef.current = false;
    document.documentElement.classList.add('is-locked');
    setSheet({ show: it, from: from || null, autoPlay });
    curSheet.current = { show: it, from: from || null, autoPlay };
    try { history.pushState({ nf: 'detail' }, '', '#detail'); } catch (e) {}
  }, [player, searchOpen]);

  /* 详情挂载后再张开：整页自己从被点的卡片矩形长到全屏。
     不再有「海报先飞、页面后跟上」那一层 —— 只有一个矩形在动，
     所以中途不会出现洞口比海报大一圈、下半屏提前露出来的撕裂。 */
  useEffect(() => {
    if (!sheet || !sheet.from) return;
    const body = bodyRef.current;
    if (body) body.scrollTop = 0;
    const sh = document.getElementById('sheet');
    const from = sheet.from;
    /* 有起点就整页张开（clip 从卡片矩形推到全屏）；
       起点不可用（卡片在屏外、或减动效）就直接显形。 */
    const canClip = !reduceMotion();
    txBegin();
    let landed = false;
    if (sh) {
      sh.classList.remove('is-open', 'is-shut', 'is-dim');
      sh.style.transform = '';
    }
    if (canClip) {
      const ok = sheetOpenFrom(from);
      if (!ok) { showSheetNow(); }
    } else {
      showSheetNow();
    }
    if (sh) { sh.classList.add('is-open'); sh.setAttribute('aria-hidden', 'false'); }
    document.getElementById('scrim')?.classList.add('is-on');
    /* 张开 420ms，留 60ms 余量再放行重活（正文建树）。 */
    const t = setTimeout(() => { if (!landed) { landed = true; txEnd(); } }, 480);
    return () => clearTimeout(t);
  }, [sheet]);

  const closeDetail = useCallback(() => {
    if (!openRef.current || closingRef.current) return;
    closingRef.current = true;
    openRef.current = false;
    const sh = document.getElementById('sheet');
    const cur = curSheet.current;
    const from = cur && cur.from;
    /* 正文滚过一段之后再关，就别收了：封面早已滚出视口，
       把整页 clip 回卡片只会露出正文中段的一小块，比直接淡出更怪。 */
    const scrolled = bodyRef.current ? bodyRef.current.scrollTop : 0;

    /* 真正卸载要等动画走完 —— 否则 setSheet(null) 一执行，详情 DOM 立刻消失，
       收回那 300ms 里缩回去的就是一个空壳，比不收还难看。 */
    const finish = () => {
      if (sh) { sh.classList.remove('is-open'); sh.setAttribute('aria-hidden', 'true'); }
      setSheet(null);
      curSheet.current = null;
      setTimeout(() => { closingRef.current = false; }, 120);
    };

    /* 首页与胶囊要马上回来：整页被 clip 成小块，周围露出的就是它们。 */
    document.getElementById('scrim')?.classList.remove('is-on');
    document.documentElement.classList.remove('is-locked');
    try { if (location.hash === '#detail') history.back(); } catch (e) {}

    if (from && scrolled <= 8 && !reduceMotion()) {
      txBegin();
      /* 两拍：先把整页收回卡片矩形（这段 opacity 锁 1），
         收拢到位后再 120ms 淡掉。顺序反了就会「啪」一下没。 */
      const shrinking = sheetClipBack(from);
      const fade = () => sheetFadeOut(() => { txEnd(); finish(); });
      if (shrinking) setTimeout(fade, 300);
      else fade();
    } else {
      sheetFadeOut(() => { txEnd(); finish(); });
    }
  }, []);

  useEffect(() => {
    const onPop = () => { if (openRef.current) closeDetail(); };
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, [closeDetail]);

  /* 详情下拉关闭：正文滚到顶时继续往下拖，整页跟手下移，松手超过 90px 就关。
     位移直接写 style，不经过 React 状态 —— 拖拽要跟手，一次 setState 就是一帧渲染。
     只有当纵向位移明显压过横向、且已经超过 10px 才接管，
     否则会抢掉面板里的横向滑动与按钮点击。 */
  const drag = useRef({ y: 0, x: 0, dy: 0, on: false });
  const onBodyDown = useCallback(e => {
    const body = bodyRef.current;
    if (!body || body.scrollTop > 0) return;
    drag.current = { y: e.clientY, x: e.clientX, dy: 0, on: false };
  }, []);
  const onBodyMove = useCallback(e => {
    const d = drag.current;
    if (!d.y) return;
    const dy = e.clientY - d.y;
    const dx = e.clientX - d.x;
    if (!d.on) {
      if (dy < 10 || Math.abs(dx) > Math.abs(dy) * 1.2) return;
      d.on = true;
      const sh = sheetElRef.current;
      if (sh) sh.style.transition = 'none';
    }
    d.dy = Math.max(0, dy);
    const sh = sheetElRef.current;
    if (sh) sh.style.transform = 'translateY(' + d.dy + 'px)';
  }, []);
  const onBodyUp = useCallback(() => {
    const d = drag.current;
    const sh = sheetElRef.current;
    const grabbed = d.on;
    const dy = d.dy;
    drag.current = { y: 0, x: 0, dy: 0, on: false };
    if (!grabbed) return;
    if (sh) { sh.style.transition = ''; sh.style.transform = ''; }
    if (dy > 90) closeDetail();
  }, [closeDetail]);

  const play = useCallback(item => {
    if (openRef.current) closeDetail();
    setPlayer({ ...item, _k: Date.now() });
  }, [closeDetail]);

  /* ---------- 搜索 ---------- */
  const openSearch = () => {
    /* 详情/搜索/播放器都是整屏浮层，只允许一个在前：从详情里点搜索先收详情。 */
    if (openRef.current) closeDetail();
    if (player) setPlayer(null);
    setSearchOpen(true); setQ(''); setResults(null);
    setTimeout(() => inputRef.current && inputRef.current.focus(), 60);
  };
  const closeSearch = () => {
    clearTimeout(searchT.current);          // 别让在途的搜索结果晚一拍弹回来
    setSearchOpen(false); setResults(null); setQ(''); setSearching(false);
  };
  const runSearch = useCallback(v => {
    setQ(v);
    clearTimeout(searchT.current);
    const k = v.trim();
    if (!k) { setResults(null); setSearching(false); return; }
    setSearching(true);
    searchT.current = setTimeout(async () => {
      try {
        const d = await api.search(k);
        const items = (d.items || d || []).map(norm);
        setResults(items);
      } catch (e) { setResults([]); }
      setSearching(false);
    }, 320);
  }, []);

  /* 搜索面板是整屏浮层，打开时背景不能跟着滚。
     用 toggle 而不是 add/remove + cleanup：cleanup 跑在旧闭包上，
     详情打开时会拿 sheet=null 把刚加上的 is-locked 又摘掉。 */
  useEffect(() => {
    document.documentElement.classList.toggle('is-locked', !!(searchOpen || sheet || player));
  }, [searchOpen, sheet, player]);

  /* ESC：播放器自己管（要顺手记进度），App 不抢。
     否则详情里拉起播放器后按 ESC，App 会把详情一起收掉，播放器却还在屏幕上。 */
  useEffect(() => {
    if (!searchOpen && !sheet) return;
    const onKey = e => {
      if (e.key !== 'Escape') return;
      if (player) return;                 // 全权交给 Player 的 ESC
      if (searchOpen) closeSearch();
      else closeDetail();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [searchOpen, sheet, player, closeDetail]);

  /* ---------- 渲染 ---------- */
  const viewKey = route + ':' + libCat + ':' + (listView ? listView.title : '');
  const body = useMemo(() => {
    if (listView) {
      return (
        <>
          <div className="sect">
            <div className="sect__k">COLLECTION</div>
            <h1 className="sect__t">{listView.title}</h1>
          </div>
          <div className="grid">
            {listView.items.map((s, i) => {
              const n = norm(s);
              return (
                <Card2 key={n.id + ':' + i} s={n} onOpen={openDetail} />
              );
            })}
          </div>
        </>
      );
    }
    if (route === 'library') {
      return <Library cat={libCat} onCat={(c) => setLibCat(c)} onOpen={openDetail} onTab={onTab} />;
    }
    if (route === 'mylist') {
      return <Mine onOpen={openDetail} />;
    }
    return (
      <Home
        data={home}
        loading={homeLoading}
        error={homeErr}
        onOpen={openDetail}
        onCat={(c) => { setTab('library'); setRoute('library'); setLibCat(c); window.scrollTo({ top: 0 }); }}
        onMore={(title, items) => setListView({ title, items })}
        onRetry={() => loadHome()}
        onTop={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
      />
    );
  }, [viewKey, home, homeLoading, homeErr, listView, route, libCat, openDetail, onTab, loadHome]);

  return (
    <>
      <Sprite />
      <div className="app" id="app" hidden={!ready}>
        <Topbar
          back={route !== 'home' || !!listView}
          onBack={n => go(typeof n === 'string' ? n : 'home')}
          onSearch={openSearch}
        />

        <main className="view" id="view">
          <div key={viewKey}>{body}</div>
        </main>

        <Tabbar route={tab || route} onNav={go} />
      </div>

      <section className={'searchpanel' + (searchOpen ? ' is-open' : '')} id="searchPanel" aria-hidden={!searchOpen}>
        <div className="searchpanel__bar">
          <svg className="searchpanel__ico"><use href="#i-search" /></svg>
          <input
            id="searchInput"
            ref={inputRef}
            type="search"
            value={q}
            placeholder="搜片名、剧名、频道…"
            autoComplete="off"
            enterKeyHint="search"
            onChange={e => runSearch(e.target.value)}
          />
          <button className="iconbtn" id="btnSearchClose" aria-label="关闭" onClick={closeSearch}>
            <svg><use href="#i-close" /></svg>
          </button>
        </div>
        <div className="searchpanel__body" id="searchResults">
          {!searching && !results ? (
            <div className="empty">
              <h3>搜点什么</h3>
              <p>片名、演员、类型都可以</p>
            </div>
          ) : null}
          {searching ? (
            <div className="grid">
              {Array.from({ length: 6 }, (_, i) => <div key={i} className="card sk-card"><div className="card__art sk sk--art" /><div className="sk sk--n" /><div className="sk sk--s" /></div>)}
            </div>
          ) : null}
          {!searching && results && !results.length ? (
            <div className="empty">
              <svg><use href="#i-search" /></svg>
              <h3>没有找到「{q}」</h3>
              <p>换个关键词试试</p>
            </div>
          ) : null}
          {!searching && results && results.length ? (
            <>
              <div className="sect">
                <div className="sect__k">RESULT</div>
                <h1 className="sect__t">结果 · {results.length}</h1>
              </div>
              <div className="grid">
                {results.map((s, i) => (
                  <Card2 key={s.id + ':' + i} s={s} eager
                    onOpen={(ss, from) => { closeSearch(); requestAnimationFrame(() => openDetail(ss, from)); }} />
                ))}
              </div>
            </>
          ) : null}
        </div>
      </section>

      <div className={'scrim' + (sheet ? ' is-on' : '')} id="scrim" onClick={closeDetail} />

      <section className={'sheet' + (sheet ? ' is-open' : '')} id="sheet" ref={sheetElRef}
        role="dialog" aria-modal={sheet ? 'true' : undefined} aria-hidden={!sheet}>
        <div className="sheet__grab" id="sheetGrab"><i /></div>
        <div className="sheet__scroll" id="sheetBody" ref={bodyRef}
          onPointerDown={onBodyDown} onPointerMove={onBodyMove} onPointerUp={onBodyUp} onPointerCancel={onBodyUp}>
          {sheet ? (
            <Detail
              key={sheet.show.id}
              show={sheet.show}
              autoPlay={sheet.autoPlay}
              onClose={closeDetail}
              onPlay={play}
              onRelated={(s, from) => openDetail(s, from)}
            />
          ) : null}
        </div>
      </section>

      {player ? <Player item={player} onClose={() => setPlayer(null)} /> : null}

      <div className={'toast' + (toastMsg ? ' is-on' : '') + (sheet || player ? ' is-up' : '')} id="toast">
        {toastMsg}
      </div>
    </>
  );
}

/* 列表/搜索结果里的卡片：与 Card 同构，单开一层把 onClick 签名接对 */
function Card2({ s, onOpen, eager }) {
  return <Card s={s} eager={eager} onClick={(ss, from) => onOpen(ss, from)} />;
}
