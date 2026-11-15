/* 数据与接口层：与 Web 版 src/lib/core.js 同语义，把 fetch/localStorage 换成 RN 的。 */
import { useEffect, useSyncExternalStore } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { abs, getBase } from './config.js';

export const esc = s => String(s == null ? '' : s);

export const api = {
  async get(path, opt = {}) {
    const ctl = typeof AbortController !== 'undefined' ? new AbortController() : null;
    const t = setTimeout(() => { if (ctl) ctl.abort(); }, opt.timeout || 20000);
    const root = opt.base ? String(opt.base).replace(/\/+$/, '') : getBase();
    let r;
    try {
      r = await fetch(root + path, ctl ? { signal: ctl.signal } : {});
    } catch (e) {
      /* RN 的网络错误只有 "Network request failed"，看不出是地址/端口还是断网 */
      const why = ctl && ctl.signal && ctl.signal.aborted ? '连接超时' : '连不上服务器';
      throw new Error(why + '：' + root);
    } finally { clearTimeout(t); }
    const j = await r.json().catch(() => null);
    if (!r.ok || !j || j.error) throw new Error((j && j.error) || ('HTTP ' + r.status));
    return j;
  },
  home() { return this.get('/api/home'); },
  list(cat, page) { return this.get(`/api/list?cat=${cat}&page=${page}`); },
  detail(id) { return this.get('/api/detail?id=' + id, { timeout: 30000 }); },
  lines(id, ep) { return this.get(`/api/lines?id=${id}&ep=${ep}`, { timeout: 30000 }); },
  search(k) { return this.get('/api/search?k=' + encodeURIComponent(k), { timeout: 20000 }); },
  ping(base) { return this.get('/api/ping', { timeout: 6000, base }); },
};

/* 图床直连常被拦，统一走服务端代理；幂等，避免二次编码 */
export const imgURL = u => {
  if (!u) return '';
  if (u.indexOf('/api/img?u=') === 0) return abs(u);
  return /^https?:\/\//i.test(u) ? abs('/api/img?u=' + encodeURIComponent(u)) : abs(u);
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
  directors: Array.isArray(x.directors) ? x.directors : [],
  actors: Array.isArray(x.actors) ? x.actors : [],
  cat: x.cat || '',
  live: !!x.live,
});

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
  const p2 = n => (n < 10 ? '0' : '') + n;
  return h ? `${h}:${p2(m)}:${p2(q)}` : `${m}:${p2(q)}`;
};

export const showName = s => (s && s.title) || '未命名';
export const metaLine = s => [s.year, (s.genres || []).slice(0, 2).join(' · ')].filter(Boolean).join(' · ');

/* 占位底色：按 id 散列出稳定的双色渐变，RN 里手工算两个色标 */
const hsl2rgb = (h, s, l) => {
  s /= 100; l /= 100;
  const k = n => (n + h / 30) % 12;
  const a = s * Math.min(l, 1 - l);
  const f = n => Math.round(255 * (l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)))));
  return [f(0), f(8), f(4)];
};
const hex = c => '#' + c.map(v => v.toString(16).padStart(2, '0')).join('');

export function ph(s) {
  const key = String((s && (s.id || s.title)) || '');
  let h = 0;
  for (let i = 0; i < key.length; i++) h = (h * 31 + key.charCodeAt(i)) % 360;
  return [hex(hsl2rgb(h, 62, 16)), hex(hsl2rgb((h + 46) % 360, 70, 30))];
}

/* ---------- 收藏 / 观看记录 ---------- */
const FAV_KEY = 'nf:fav';
const HIST_KEY = 'nf:hist';

const listeners = new Set();
let state = { fav: [], hist: {} };
let hydrated = false;

const emit = () => { listeners.forEach(f => f()); };
export const subscribe = f => { listeners.add(f); return () => { listeners.delete(f); }; };
export const getFav = () => state.fav;
export const getHist = () => state.hist;

export async function hydrate() {
  try {
    const [f, h] = await Promise.all([AsyncStorage.getItem(FAV_KEY), AsyncStorage.getItem(HIST_KEY)]);
    const rf = f ? JSON.parse(f) : [];
    const rh = h ? JSON.parse(h) : {};
    state = {
      fav: Array.isArray(rf) ? rf.filter(x => x && typeof x === 'object' && x.id != null) : [],
      hist: rh && typeof rh === 'object' && !Array.isArray(rh) ? rh : {},
    };
  } catch (e) {}
  hydrated = true;
  emit();
}
export const isHydrated = () => hydrated;

const persistFav = v => AsyncStorage.setItem(FAV_KEY, JSON.stringify(v)).catch(() => {});
const persistHist = v => AsyncStorage.setItem(HIST_KEY, JSON.stringify(v)).catch(() => {});

const slim = s => ({
  id: String(s.id), title: s.title, poster: s.poster, year: s.year,
  genres: s.genres || [], rating: s.rating || 0,
});
export const favHas = id => state.fav.some(f => f.id === String(id));

export function toggleFav(s) {
  if (favHas(s.id)) {
    state = { ...state, fav: state.fav.filter(f => f.id !== String(s.id)) };
    persistFav(state.fav);
    toast('已从片单移除');
  } else {
    state = { ...state, fav: [slim(s), ...state.fav].slice(0, 200) };
    persistFav(state.fav);
    toast('已加入我的片单');
  }
  emit();
}

export function dropHist(id) {
  const n = { ...state.hist };
  delete n[id];
  state = { ...state, hist: n };
  persistHist(n);
  emit();
}

let histT = null;
export function saveHist(id, p, t, meta) {
  const old = state.hist[id] || {};
  const nh = {
    ...state.hist,
    [id]: {
      p: p || 0, t: t || 0, d: Date.now(),
      title: (meta && meta.title) || old.title || '',
      poster: (meta && meta.poster) || old.poster || '',
      year: (meta && meta.year) || old.year || '',
    },
  };
  const keys = Object.keys(nh);
  state = { ...state, hist: keys.length > 80
    ? Object.entries(nh).sort((a, b) => b[1].d - a[1].d).slice(0, 60).reduce((o, kv) => { o[kv[0]] = kv[1]; return o; }, {})
    : nh };
  clearTimeout(histT);
  histT = setTimeout(() => { persistHist(state.hist); emit(); }, 1200);
}

export function useFav() { return useSyncExternalStore(subscribe, getFav, getFav); }
export function useHist() { return useSyncExternalStore(subscribe, getHist, getHist); }

/* toast：RN 没有 DOM 事件，用一个极小的订阅总线 */
const toastSubs = new Set();
export const onToast = f => { toastSubs.add(f); return () => { toastSubs.delete(f); }; };
export const toast = msg => { if (msg) toastSubs.forEach(f => f(msg)); };

/* 首帧把持久化的收藏/历史读回来 */
export function useHydrate() {
  useEffect(() => { hydrate(); }, []);
}
