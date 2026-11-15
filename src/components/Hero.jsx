import { useEffect, useRef, useState } from 'react';
import { esc, favHas, imgURL, ph, showName, toggleFav, useFav } from '../lib/core.js';

/* 首页大图轮播。点「立即播放 / 详情」时把 hero 自身的矩形当转场起点，
   这样从大图进详情也是长出来，而不是凭空淡入 —— 以前这两个按钮不带 from。 */
export default function Hero({ items, onOpen }) {
  const [idx, setIdx] = useState(0);
  const [loaded, setLoaded] = useState(false);
  const bgRef = useRef(null);
  const posterRef = useRef(null);
  const boxRef = useRef(null);
  const firstRef = useRef(true);
  const fav = useFav();
  const timer = useRef(0);

  const cur = items[Math.min(idx, items.length - 1)] || null;

  const paintBg = () => {
    const bg = bgRef.current;
    if (!bg || !cur) return;
    bg.style.backgroundImage = `url("${imgURL(cur.poster)}")`;
    /* 首次入场用 heroIn（带淡入），后续轮播只推镜，
       否则每 7 秒背景会整块闪黑一次 */
    bg.style.animation = 'none';
    void bg.offsetWidth;
    bg.style.animation = firstRef.current ? '' : 'heroShift 1.4s var(--e-out) both';
    firstRef.current = false;
  };

  useEffect(() => {
    if (!cur) return;
    paintBg();
    setLoaded(false);
    const im = posterRef.current;
    if (im && im.complete && im.naturalWidth) setLoaded(true);
  }, [cur && cur.id]);

  useEffect(() => {
    if (items.length < 2) return;
    const loop = () => {
      clearInterval(timer.current);
      timer.current = setInterval(() => setIdx(i => (i + 1) % items.length), 7000);
    };
    loop();
    const box = boxRef.current;
    const pause = () => clearInterval(timer.current);
    box.addEventListener('pointerdown', pause, { passive: true });
    box.addEventListener('pointerup', loop, { passive: true });
    return () => {
      clearInterval(timer.current);
      box.removeEventListener('pointerdown', pause);
      box.removeEventListener('pointerup', loop);
    };
  }, [items.length]);

  /* hero 区域矩形：桌面端有独立海报就量海报，手机端整幅背景就是海报 */
  const heroFrom = () => {
    const p = posterRef.current;
    const box = (p && getComputedStyle(p.parentElement).display !== 'none') ? p : boxRef.current;
    const r = box ? box.getBoundingClientRect() : null;
    if (!r || !r.width) return null;
    return { l: r.left, t: r.top, w: r.width, h: r.height, r: 0 };
  };

  const open = autoPlay => {
    if (!cur) return;
    onOpen(cur, heroFrom(), autoPlay);
  };

  if (!cur) {
    return (
      <section className="hero hero--sk" ref={boxRef}>
        <div className="hero__bg" />
        <div className="hero__wash" />
        <div className="hero__poster" />
        <div className="hero__body" />
        <div className="hero__dots" />
      </section>
    );
  }

  const on = fav.some(f => f.id === String(cur.id));
  /* 首页 hero 只有 tags（正片/高清版），没有 year/genres/region。
     别再留一个空 div 白吃 12px margin。 */
  const meta = [cur.year, cur.region, ...(cur.tags || cur.genres || []).slice(0, 2)].filter(Boolean);

  return (
    <section className="hero" ref={boxRef}>
      <div className="hero__bg" ref={bgRef} />
      <div className="hero__wash" style={{ background: ph(cur) }} />
      <div className="hero__poster">
        {cur.poster ? (
          <img
            ref={posterRef}
            alt=""
            src={imgURL(cur.poster)}
            onLoad={() => setLoaded(true)}
            onError={() => setLoaded(false)}
            style={{ opacity: loaded ? 1 : 0 }}
          />
        ) : null}
      </div>
      <div className="hero__body">
        <div className="hero__kick">
          <span className="pill pill--red">{esc(cur.note || '热播')}</span>
          {cur.rating ? (
            <span className="pill pill--gold">
              <svg style={{ width: 11, height: 11, fill: 'currentColor', stroke: 'none' }}><use href="#i-star" /></svg>
              {cur.rating}
            </span>
          ) : null}
          {cur.year ? <span className="pill pill--ghost">{esc(cur.year)}</span> : null}
        </div>
        <h2 className="hero__title">{showName(cur)}</h2>
        {meta.length ? (
          <div className="hero__meta">
            {meta.map((m, i) => <span key={i}>{esc(String(m))}</span>)}
          </div>
        ) : null}
        {cur.summary ? <p className="hero__sum">{cur.summary}</p> : null}
        <div className="hero__act">
          <button className="btn btn--play" id="heroPlay" onClick={() => open(true)}>
            <svg className="ico-fill"><use href="#i-play" /></svg>立即播放
          </button>
          <button
            className="btn btn--ghost btn--icon"
            id="heroFav"
            aria-label="加入收藏"
            onClick={e => { e.stopPropagation(); toggleFav(cur); }}
          >
            <svg className={on ? 'ico-fill' : ''}><use href={on ? '#i-check' : '#i-plus'} /></svg>
          </button>
          <button className="btn btn--ghost btn--icon" id="heroInfo" aria-label="详情" onClick={() => open(false)}>
            <svg><use href="#i-info" /></svg>
          </button>
        </div>
      </div>
      <div className="hero__dots">
        {items.map((_, i) => (
          <button
            key={i}
            className={i === idx ? 'on' : ''}
            type="button"
            aria-label={'第 ' + (i + 1) + ' 部'}
            onClick={() => setIdx(i)}
          />
        ))}
      </div>
    </section>
  );
}
