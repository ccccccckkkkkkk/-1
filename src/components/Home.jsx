import { useEffect, useState } from 'react';
import Hero from './Hero.jsx';
import Rail, { SkeletonRail } from './Rail.jsx';
import Card from './Card.jsx';
import { CATS, esc, norm, useFav, useHist } from '../lib/core.js';

/* 首页：hero 轮播 + 分类 chips + 继续观看 + 各区块轨道 + 片库入口 */
export default function Home({ data, loading, error, onOpen, onCat, onMore, onRetry, onTop }) {
  const hist = useHist();
  useFav();                      // 收藏变化时 hero 的心形要重画

  const heroItems = (data.hero || []).map(norm).filter(x => x.title).slice(0, 6);
  const sections = (data.sections || []).filter(s => s.items && s.items.length >= 3);

  const cont = Object.entries(hist)
    .filter(([, h]) => h.p > 0.01 && h.p < 0.96 && h.title)
    .sort((a, b) => b[1].d - a[1].d)
    .slice(0, 12)
    .map(([id, h]) => ({ id, title: h.title, poster: h.poster || '', year: h.year || '', genres: [], p: h.p }));

  return (
    <>
      <Hero items={heroItems} onOpen={onOpen} />

      <div className="chips">
        <button className="chip is-on" type="button" onClick={onTop}>全部</button>
        {CATS.map(c => (
          <button key={c.id} className="chip" type="button" onClick={() => onCat(c.id, c.name)}>{c.name}</button>
        ))}
      </div>

      {cont.length ? (
        <section className="rail reveal is-in">
          <div className="rail__head">
            <h3 className="rail__title"><span />继续观看</h3>
          </div>
          <div className="rail__track">
            {cont.map((x, i) => (
              <Card0 key={x.id + i} x={x} onOpen={onOpen} />
            ))}
          </div>
        </section>
      ) : null}

      <div className="homebody">
        {loading ? (
          <>
            <SkeletonRail n={6} />
            <SkeletonRail n={6} />
            <SkeletonRail n={6} />
          </>
        ) : null}

        {error ? (
          <div className="empty">
            <svg><use href="#i-signal" /></svg>
            <h3>片源加载失败</h3>
            <p>{esc(error)}</p>
            <button className="btn btn--play" style={{ marginTop: 14 }} onClick={onRetry}>重试</button>
          </div>
        ) : null}

        {!loading && !error ? sections.map(sec => (
          <Rail
            key={sec.name}
            title={sec.name}
            items={sec.items}
            onOpen={onOpen}
            onMore={() => onMore(sec.name, sec.items)}
          />
        )) : null}

        {!loading && !error ? (
          <div className="catgrid">
            {CATS.map(c => (
              <button key={c.id} className="catcard" type="button" onClick={() => onCat(c.id, c.name)}>
                <span className="catcard__k">{esc(c.kick)}</span>
                <span className="catcard__n">{esc(c.name)}</span>
              </button>
            ))}
          </div>
        ) : null}
      </div>
    </>
  );
}

/* 「继续观看」的卡片带进度与副标题，单开一层包 Card */
function Card0({ x, onOpen }) {
  return <Card s={x} progress={x.p} sub={`已看 ${Math.round(x.p * 100)}%`} onClick={(s, from) => onOpen(s, from)} />;
}
