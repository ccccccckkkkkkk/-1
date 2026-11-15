/* 数据与接口层：与旧版 js/app.js 的 api / norm / ph / store 等价 */
import { useSyncExternalStore } from 'react';

export const esc = s => String(s == null ? '' : s);

export const api = {
  async get(path, opt = {}) {
    const can = typeof AbortController !== 'undefined';
    const ctl = can ? new AbortController() : null;
    const t = setTimeout(() => { if (ctl) ctl.abort(); }, opt.timeout || 45000);
    try {
      const r = await fetch(path, ctl ? { signal: ctl.signal, cache: 'no-store' } : { cache: 'no-store' });
      const j = await r.json().catch(() => null);
      if (!r.ok || !j || j.error) throw new Error((j && j.error) || ('HTTP ' + r.status));
      return j;
    } finally { clearTimeout(t); }
  },
  home() { return this.get('/api/home'); },
  list(cat, page) { return this.get(`/api/list?cat=${cat}&page=${page}`); },
  detail(id) { return this.get('/api/detail?id=' + id); },
  lines(id, ep) { return this.get(`/api/lines?id=${id}&ep=${ep}`, { timeout: 60000 }); },
  search(k) { return this.get('/api/search?k=' + encodeURIComponent(k), { timeout: 30000 }); },
};

/* 图床直连常被拦，统一走服务端代理；幂等，避免二次编码 */
export const imgURL = u => {
  if (!u) return '';
  if (u.indexOf('/api/img?u=') === 0) return u;
  return /^https?:\/\//i.test(u) ? '/api/img?u=' + encodeURIComponent(u) : u;
};

export const norm = x => ({
  id: String(x.id),
  title: x.title || '未命名',
  poster: imgURL(x.poster || ''),
  year: x.year || '',
  region: x.region || '',
  genres: Array.isArray(x.genres) ? x.genres : [],
  tags: Array.isArray(x.tags) ? x.tags : [],
  rating: Number(x.rating) || 0,
  summary: x.summary || '',
  note: x.note || '',
  cat: x.cat || '',
  live: !!x.live,
});

export const REGION_NAME = { cn: '中国大陆', kr: '韩国', jp: '日本', tw: '中国台湾', hk: '中国香港', us: '美国' };

export const CATS = [
  { id: '1', name: '电影', kick: 'MOVIES' },
  { id: '2', name: '电视剧', kick: 'SERIES' },
  { id: '3', name: '动漫', kick: 'ANIME' },
  { id: '4', name: '综艺', kick: 'VARIETY' },
  { id: '6', name: '短剧', kick: 'SHORTS' },
];

export const fmt = s => {
  s = Math.max(0, Math.floor(s || 0));
  const h = Math.floor(s / 3600), m = Math.floor(s % 3600 / 60), q = s % 60;
  return h ? `${h}:${String(m).padStart(2, '0')}:${String(q).padStart(2, '0')}`
           : `${m}:${String(q).padStart(2, '0')}`;
};

export const showName = s => (s && s.title) || '未命名';
export const metaLine = s => [s.year, (s.genres || []).slice(0, 2).join(' · ')].filter(Boolean).join(' · ');

/* 占位底色：按 id 散列出稳定的双色渐变 */
export function ph(s) {
  const key = String((s && (s.id || s.title)) || '');
  let h = 0;
  for (let i = 0; i < key.length; i++) h = (h * 31 + key.charCodeAt(i)) % 360;
  const h2 = (h + 46) % 360;
  return `linear-gradient(158deg,hsl(${h} 62% 16%) 0%,hsl(${h2} 70% 30%) 100%)`;
}

const LS = {
  get(k, d) { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch (e) { return d; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} },
};

/* 收藏与观看记录：外部可变状态，用 useSyncExternalStore 订阅 */
const listeners = new Set();
/* localStorage 可能被写成任意 JSON；先归一化，否则 fav.some / Object.entries 会崩页 */
const rawFav = LS.get('nf:fav', []);
const rawHist = LS.get('nf:hist', {});
const state = {
  fav: Array.isArray(rawFav) ? rawFav.filter(f => f && typeof f === 'object' && f.id != null) : [],
  hist: (rawHist && typeof rawHist === 'object' && !Array.isArray(rawHist)) ? rawHist : {},
};
const emit = () => listeners.forEach(f => f());
export const subscribe = f => { listeners.add(f); return () => listeners.delete(f); };
export const getFav = () => state.fav;
export const getHist = () => state.hist;

const slim = s => ({ id: String(s.id), title: s.title, poster: s.poster, year: s.year, genres: s.genres || [], rating: s.rating || 0 });
export const favHas = id => state.fav.some(f => f.id === String(id));
export function toggleFav(s) {
  if (favHas(s.id)) {
    state.fav = state.fav.filter(f => f.id !== String(s.id));
    LS.set('nf:fav', state.fav);
    toast('已从片单移除');
  } else {
    state.fav = [slim(s), ...state.fav].slice(0, 200);
    LS.set('nf:fav', state.fav);
    toast('已加入我的片单');
  }
  emit();
}
export function dropHist(id) {
  /* 必须换成新对象：useSyncExternalStore 用引用比较快照，
     原地 delete 后引用没变，页面不会重画 */
  const n = { ...state.hist };
  delete n[id];
  state.hist = n;
  LS.set('nf:hist', n);
  emit();
}

let histT = null;
export function saveHist(id, p, t, meta) {
  const old = state.hist[id] || {};
  state.hist = {
    ...state.hist,
    [id]: {
      p: p || 0, t: t || 0, d: Date.now(),
      title: (meta && meta.title) || old.title || '',
      poster: (meta && meta.poster) || old.poster || '',
      year: (meta && meta.year) || old.year || '',
    },
  };
  const keys = Object.keys(state.hist);
  if (keys.length > 80) {
    const keep = Object.entries(state.hist).sort((a, b) => b[1].d - a[1].d).slice(0, 60);
    state.hist = keep.reduce((o, kv) => { o[kv[0]] = kv[1]; return o; }, {});
  }
  clearTimeout(histT);
  histT = setTimeout(() => { LS.set('nf:hist', state.hist); emit(); }, 1200);
}

export function useFav() { return useSyncExternalStore(subscribe, getFav, getFav); }
export function useHist() { return useSyncExternalStore(subscribe, getHist, getHist); }

/* toast 通过自定义事件抛给 App 层的单例容器 */
export const toast = msg => window.dispatchEvent(new CustomEvent('nf:toast', { detail: msg }));
