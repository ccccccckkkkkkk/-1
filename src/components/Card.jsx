import { useEffect, useRef, useState } from 'react';
import { metaLine, showName } from '../lib/core.js';

/* 卡片：点击时把 .card__art 的真实矩形与圆角一起抛出去，供共享元素转场当起点 */
export default function Card({ s, rank, wide, badge, sub, eager, progress = 0, onClick }) {
  const artRef = useRef(null);
  const imgRef = useRef(null);
  const [loaded, setLoaded] = useState(false);

  /* 换海报时清掉 onError 留下的 opacity:0、重置 loaded；
     图片在缓存里时 load 事件不一定派发，挂载后补查一次 naturalWidth */
  useEffect(() => {
    const img = imgRef.current;
    if (img) img.style.opacity = '';
    setLoaded(false);
    if (img && img.complete && img.naturalWidth) setLoaded(true);
  }, [s.poster]);

  const fire = () => {
    const art = artRef.current;
    const r = art ? art.getBoundingClientRect() : null;
    const rad = art ? parseFloat(getComputedStyle(art).borderTopLeftRadius) : NaN;
    const from = r && r.width
      ? { l: r.left, t: r.top, w: r.width, h: r.height, r: isFinite(rad) ? rad : 16 }
      : null;
    if (onClick) onClick(s, from);
  };

  const label = badge || s.note;
  const line = sub || metaLine(s);

  return (
    <button
      type="button"
      className={'card' + (rank ? ' card--rank' : '') + (wide ? ' card--wide' : '')}
      data-id={s.id}
      onClick={fire}
    >
      <div className={'card__art' + (loaded ? ' is-loaded' : '')} ref={artRef}>
        {/* 无 poster 时不渲染 img：src="" 会再发一次对当前页的请求 */}
        {s.poster ? (
          <img
            ref={imgRef}
            {...(eager ? { fetchpriority: 'high' } : { loading: 'lazy' })}
            decoding="async"
            src={s.poster}
            alt={showName(s)}
            className={loaded ? 'on' : ''}
            onLoad={() => setLoaded(true)}
            onError={e => { e.currentTarget.style.opacity = '0'; setLoaded(false); }}
          />
        ) : null}
        <i className="card__ph" aria-hidden="true">
          <svg><use href="#i-mark" /></svg>
          <em>NEON<i>FLICK</i></em>
        </i>
        {label ? <span className="card__badge">{label}</span> : null}
        {progress > 0.02 && progress < 0.97 ? (
          <div className="card__prog"><i style={{ width: (progress * 100).toFixed(1) + '%' }} /></div>
        ) : null}
        {rank ? <span className="card__rank">{rank}</span> : null}
      </div>
      <div className="card__name">{showName(s)}</div>
      {/* 首页区块只带 id/title/poster/rating，没有年份与类型：
          副标题算出来是空串，渲染出来只剩一条 3px 的空行，不如不渲染 */}
      {line ? <div className="card__sub">{line}</div> : null}
    </button>
  );
}

/* 骨架卡 */
export function SkCard() {
  return (
    <div className="card sk-card">
      <div className="card__art sk sk--art" />
      <div className="sk sk--n" />
      <div className="sk sk--s" />
    </div>
  );
}
