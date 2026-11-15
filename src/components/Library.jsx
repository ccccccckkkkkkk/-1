import { useEffect, useRef, useState } from 'react';
import Card, { SkCard } from './Card.jsx';
import { CATS, api, esc, imgURL, norm } from '../lib/core.js';

/* 片库：分类 chips + 网格 + 600px 预取的无限滚动 */
export default function Library({ cat, onCat, onOpen, onTab }) {
  const [items, setItems] = useState([]);
  const [page, setPage] = useState(1);
  const [more, setMore] = useState(true);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [firstDone, setFirstDone] = useState(false);   // 首屏请求已返回（成功或失败）
  const sent = useRef(null);
  const cache = useRef(new Map());
  const doneRef = useRef(false);

  const name = (CATS.find(c => c.id === cat) || CATS[0]).name;

  useEffect(() => {
    let dead = false;
    doneRef.current = false;
    setFirstDone(false);
    setItems([]); setPage(1); setMore(true); setBusy(false); setErr('');
    (async () => {
      const key = cat + ':1';
      let d = cache.current.get(key);
      if (!d) { try { d = await api.list(cat, 1); cache.current.set(key, d); } catch (e) { if (!dead) { setErr(e.message || '网络异常'); setFirstDone(true); } return; } }
      if (dead) return;
      setItems((d.items || []).map(norm));
      setMore(!!d.more);
      doneRef.current = true;
      setFirstDone(true);
      if (!d.more) setPage(1);
    })();
    return () => { dead = true; };
  }, [cat]);

  /* 下一页 */
  const next = async () => {
    if (busy || !more || !doneRef.current) return;
    setBusy(true);
    const p = page + 1;
    try {
      const key = cat + ':' + p;
      let d = cache.current.get(key);
      if (!d) { d = await api.list(cat, p); cache.current.set(key, d); }
      setItems(prev => prev.concat((d.items || []).map(norm)));
      setPage(p);
      setMore(!!d.more);
    } catch (e) {
      setErr(e.message || '网络异常');
      setMore(false);
    } finally { setBusy(false); }
  };

  useEffect(() => {
    const el = sent.current;
    if (!el || !('IntersectionObserver' in window)) return;
    const io = new IntersectionObserver(es => {
      if (es.some(e => e.isIntersecting)) next();
    }, { rootMargin: '600px' });
    io.observe(el);
    return () => io.disconnect();
  }, [page, more, busy, cat]);

  /* 从首页分类卡跳进来时 tab 已经由 App 设好，这里不能再清空 ——
     一清空胶囊就失去高亮，用户看到的是「点电影却不在片库」。
     只有从「更多」收藏夹那种没有 tab 的入口进来才需要清。 */
  useEffect(() => {
    if (!cat && onTab) onTab(null);
  }, []);

  const loadingFirst = !firstDone && !err;

  return (
    <>
      <div className="sect">
        <div className="sect__k">LIBRARY</div>
        <h1 className="sect__t">{name}</h1>
      </div>

      <div className="chips">
        {CATS.map(c => (
          <button
            key={c.id}
            className={'chip' + (c.id === cat ? ' is-on' : '')}
            type="button"
            onClick={() => onCat(c.id, c.name)}
          >{c.name}</button>
        ))}
      </div>

      <div className="grid">
        {loadingFirst ? Array.from({ length: 12 }, (_, i) => <SkCard key={i} />) : null}
        {items.map((s, i) => (
          <Card key={s.id + ':' + i} s={s} onClick={(ss, from) => onOpen(ss, from)} />
        ))}
      </div>

      {firstDone && !err && !items.length ? (
        <div className="empty">
          <svg><use href="#i-search" /></svg>
          <h3>暂无内容</h3>
          <p>这个分类暂时没有影片</p>
        </div>
      ) : null}

      {err ? (
        <div className="empty">
          <svg><use href="#i-signal" /></svg>
          <h3>加载失败</h3>
          <p>{esc(err)}</p>
        </div>
      ) : null}

      <div className="sentinel" ref={sent}>
        {!more && items.length ? <span className="sentinel__end">没有更多了</span> : null}
      </div>
    </>
  );
}
