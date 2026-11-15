import { useEffect, useRef, useState } from 'react';

/* 顶栏：滚动过 24px 叠实底。两层渐变都在 CSS 里，这里只切类名 */
export default function Topbar({ back, onBack, onSearch }) {
  const [solid, setSolid] = useState(false);

  useEffect(() => {
    const sync = () => {
      const y = window.pageYOffset || document.documentElement.scrollTop || document.body.scrollTop || 0;
      setSolid(y > 24);
    };
    sync();
    /* 同一个滚动事件也会冒泡到 document，挂两个监听只会重复 setState */
    window.addEventListener('scroll', sync, { passive: true });
    return () => window.removeEventListener('scroll', sync);
  }, []);

  return (
    <header className={'topbar' + (solid ? ' is-solid' : '')} id="topbar">
      <div className="topbar__l">
        <button className="iconbtn" id="btnBack" hidden={!back} aria-label="返回" onClick={onBack}>
          <svg><use href="#i-back" /></svg>
        </button>
        <a className="brand" href="#" data-nav="home" onClick={e => { e.preventDefault(); onBack && onBack('home'); }}>
          NEON<em>FLICK</em>
        </a>
      </div>
      <div className="topbar__r">
        <button className="iconbtn" id="btnSearch" aria-label="搜索" onClick={onSearch}>
          <svg><use href="#i-search" /></svg>
        </button>
      </div>
    </header>
  );
}
