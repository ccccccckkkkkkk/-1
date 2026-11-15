import Card, { SkCard } from './Card.jsx';
import { norm } from '../lib/core.js';

/* 横向轨道。ranked 时卡片左上角带名次，宽卡是 16:9 */
export default function Rail({ title, items, wide, ranked, more = true, onMore, onOpen, subOf }) {
  return (
    <section className="rail reveal is-in">
      <div className="rail__head">
        <h3 className="rail__title"><span />{title}</h3>
        {more ? (
          <button className="rail__more" type="button" onClick={e => { onMore && onMore(e, items); }}>
            全部<svg><use href="#i-back" /></svg>
          </button>
        ) : null}
      </div>
      <div className={'rail__track' + (wide ? ' rail__track--wide' : '')}>
        {items.map((s, i) => {
          const it = norm(s);
          return (
            <Card
              key={it.id + ':' + i}
              s={it}
              rank={ranked ? i + 1 : 0}
              wide={wide}
              sub={subOf ? subOf(it) : undefined}
              onClick={(ss, from) => onOpen && onOpen(ss, from)}
            />
          );
        })}
      </div>
    </section>
  );
}

export function SkeletonRail({ n = 6 }) {
  return (
    <section className="rail reveal is-in">
      <div className="rail__head">
        <h3 className="rail__title"><span /><i className="sk sk--t" /></h3>
      </div>
      <div className="rail__track">
        {Array.from({ length: n }, (_, i) => <SkCard key={i} />)}
      </div>
    </section>
  );
}
