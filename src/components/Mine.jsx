import Card from './Card.jsx';
import { dropHist, imgURL, useFav, useHist } from '../lib/core.js';

/* 我的：收藏网格 + 观看记录行 */
export default function Mine({ onOpen }) {
  const fav = useFav();
  const hist = useHist();

  const rec = Object.entries(hist || {})
    .filter(([, h]) => h && h.title)
    .sort((a, b) => b[1].d - a[1].d)
    .slice(0, 20);

  return (
    <>
      <div className="sect">
        <div className="sect__k">LIBRARY</div>
        <h1 className="sect__t">我的片单</h1>
      </div>

      {!fav.length ? (
        <div className="empty">
          <svg><use href="#i-bookmark" /></svg>
          <h3>片单是空的</h3>
          <p>点开任意影片，按「＋」把它放进这里</p>
        </div>
      ) : (
        <div className="grid">
          {fav.map((s, i) => (
            <Card key={s.id + ':' + i} s={s} onClick={(ss, from) => onOpen(ss, from)} />
          ))}
        </div>
      )}

      {rec.length ? (
        <>
          <div className="sect">
            <div className="sect__k">HISTORY</div>
            <h1 className="sect__t">观看记录</h1>
          </div>
          <div className="rowlist">
            {rec.map(([id, h]) => (
              <div
                key={id}
                className="rowitem"
                onClick={() => onOpen({ id, title: h.title, poster: h.poster || '', year: h.year || '', genres: [] }, null)}
              >
                <div className="rowitem__art">
                  {h.poster ? <img src={imgURL(h.poster)} alt="" loading="lazy" /> : null}
                </div>
                <div className="rowitem__b">
                  <div className="rowitem__t">{h.title}</div>
                  <div className="rowitem__m">
                    {h.p > 0.01 ? `已看 ${Math.round(h.p * 100)}%` : '未开始'} · {new Date(h.d).toLocaleDateString('zh-CN')}
                  </div>
                </div>
                <button
                  className="rowitem__x"
                  aria-label="移除"
                  onClick={e => { e.stopPropagation(); dropHist(id); }}
                ><svg><use href="#i-trash" /></svg></button>
              </div>
            ))}
          </div>
        </>
      ) : null}
    </>
  );
}
