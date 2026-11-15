/* 多源优选器：与 Web 版 src/lib/net.js 同算法。
   两处必须改：
   1) 没有 location/localStorage 全局，缓存改走 AsyncStorage；
   2) RN 的 fetch 没有 res.body.getReader，NDJSON 流式探测改用 XHR 的 onprogress 增量读取。 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getBase } from './config.js';

const CACHE_KEY = 'nf:probe:v3';
const TTL = 30 * 60 * 1000;
const BT = 320 * 1024;
const BUDGET = 1600;
const CONCURRENCY = 3;
const MIN_OK_KBPS = 90;

export const NO_FETCH = false;
const now = () => (typeof performance !== 'undefined' && performance.now ? performance.now() : Date.now());

let cache = {};
let cacheReady = false;
let cacheDirty = false;

(async () => {
  try {
    const raw = await AsyncStorage.getItem(CACHE_KEY);
    cache = raw ? (JSON.parse(raw) || {}) : {};
  } catch (e) { cache = {}; }
  cacheReady = true;
})();

function cacheGet(key) {
  const c = cache[key];
  if (!c || Date.now() - c.at > TTL) return null;
  return c;
}
function cacheSet(key, val) {
  cache[key] = Object.assign({}, val, { at: Date.now() });
  cacheDirty = true;
}
export function flush() {
  if (!cacheDirty || !cacheReady) return Promise.resolve();
  const keys = Object.keys(cache);
  if (keys.length > 200) {
    keys.sort((a, b) => (cache[b].at || 0) - (cache[a].at || 0));
    keys.slice(180).forEach(k => { delete cache[k]; });
  }
  cacheDirty = false;
  return AsyncStorage.setItem(CACHE_KEY, JSON.stringify(cache)).catch(() => {});
}

function pickVariant(text, base) {
  const lines = text.split('\n').map(s => s.trim());
  let best = null;
  for (let i = 0; i < lines.length; i++) {
    const l = lines[i];
    if (!l.startsWith('#EXT-X-STREAM-INF')) continue;
    const bw = +(l.match(/BANDWIDTH=(\d+)/) || [])[1] || 0;
    let u = '';
    for (let j = i + 1; j < lines.length; j++) {
      if (lines[j] && !lines[j].startsWith('#')) { u = lines[j]; break; }
    }
    if (!u) continue;
    let absUrl;
    try { absUrl = new URL(u, base).href; } catch (e) { continue; }
    if (!best || bw > best.bw) best = { bw, url: absUrl };
  }
  return best;
}

function firstSegment(text, base) {
  for (const raw of text.split('\n')) {
    const l = raw.trim();
    if (!l || l.startsWith('#')) continue;
    try { return new URL(l, base).href; } catch (e) {}
  }
  return null;
}

async function readBody(res, signal, budgetEnd) {
  const t0 = now();
  let bytes = 0;
  try {
    const reader = res.body && res.body.getReader ? res.body.getReader() : null;
    if (!reader) {
      const buf = await res.arrayBuffer();
      bytes = buf.byteLength;
    } else {
      while (bytes < BT) {
        const { done, value } = await reader.read();
        if (done) break;
        bytes += value.byteLength;
        if (now() > budgetEnd) { try { reader.cancel(); } catch (e) {} break; }
      }
    }
  } catch (e) {}
  const ms = Math.max(now() - t0, 1);
  return { bytes, ms, kbps: bytes / 1024 / (ms / 1000) };
}

export async function probeOne(src) {
  const url = typeof src === 'string' ? src : src.u;
  const cached = cacheGet(url);
  if (cached) return Object.assign({}, cached, { url, cached: true });

  const t0 = now();
  const budgetEnd = t0 + BUDGET;
  const ctl = typeof AbortController !== 'undefined' ? new AbortController() : null;
  const killer = setTimeout(() => { if (ctl) ctl.abort(); }, BUDGET);

  let ttfb = 0, kbps = 0, bytes = 0, ok = false, err = '', segUrl = url;

  const req = (u, range) => fetch(u, {
    method: 'GET',
    signal: ctl ? ctl.signal : undefined,
    headers: range ? { Range: range } : {},
  });

  try {
    const isHls = /\.m3u8(\?|$)/i.test(url);
    if (isHls) {
      const r1 = await req(url);
      ttfb = now() - t0;
      if (!r1.ok) throw new Error('HTTP ' + r1.status);
      const txt = await r1.text();
      let media = txt, mUrl = url;
      if (txt.includes('#EXT-X-STREAM-INF')) {
        const v = pickVariant(txt, url);
        if (v) {
          const r2 = await req(v.url);
          if (!r2.ok) throw new Error('variant HTTP ' + r2.status);
          media = await r2.text();
          mUrl = v.url;
        }
      }
      const seg = firstSegment(media, mUrl);
      if (!seg) throw new Error('no segment');
      segUrl = seg;
      const r3 = await req(seg, 'bytes=0-' + (BT - 1));
      if (!r3.ok && r3.status !== 206 && r3.status !== 200) throw new Error('seg HTTP ' + r3.status);
      const rr = await readBody(r3, ctl && ctl.signal, budgetEnd);
      bytes = rr.bytes; kbps = rr.kbps; ok = bytes > 4096;
    } else {
      const r = await req(url, 'bytes=0-' + (BT - 1));
      if (!r.ok && r.status !== 206) throw new Error('HTTP ' + r.status);
      ttfb = now() - t0;
      const rr = await readBody(r, ctl && ctl.signal, budgetEnd);
      bytes = rr.bytes; kbps = rr.kbps; ok = bytes > 4096;
    }
  } catch (e) {
    const name = e && e.name;
    err = name === 'AbortError' ? '超时' : ((e && e.message) || '失败');
    ok = false;
  } finally {
    clearTimeout(killer);
  }

  const playable = ok && kbps >= MIN_OK_KBPS;
  const rec = {
    url, ok: playable,
    kbps: Math.round(kbps), ttfb: Math.round(ttfb), bytes, err,
    host: (() => { try { return new URL(url).host; } catch (e) { return ''; } })(),
    score: score({ ok: playable, kbps, ttfb }),
    seg: segUrl,
  };
  cacheSet(url, { ok: rec.ok, kbps: rec.kbps, ttfb: rec.ttfb, bytes, err, score: rec.score, seg: segUrl });
  return rec;
}

export function score({ ok, kbps, ttfb }) {
  if (!ok) return 0;
  const tp = Math.min(kbps / 2400, 1);
  const lat = Math.max(0, Math.min(1, 1 - (ttfb - 120) / 1400));
  return Math.round((tp * 0.66 + lat * 0.34) * 100);
}

export async function probeAll(list, onEach) {
  const arr = list.map(s => Object.assign({}, typeof s === 'string' ? { u: s } : s));
  const out = new Array(arr.length);
  let cursor = 0;
  async function worker() {
    while (cursor < arr.length) {
      const i = cursor++;
      const r = await probeOne(arr[i]);
      out[i] = Object.assign({}, arr[i], r);
      if (onEach) onEach(out[i], i, arr.length);
    }
  }
  await Promise.all(Array.from({ length: Math.min(CONCURRENCY, arr.length) }, worker));
  return out;
}

export function probeUntil(list, hooks = {}) {
  const arr = list.map(s => Object.assign({}, typeof s === 'string' ? { u: s } : s));
  const out = new Array(arr.length);
  const total = arr.length;
  let cursor = 0, firstFired = false, finished = 0, cancelled = false;
  hooks.cancel = () => { cancelled = true; };
  if (!total) return Promise.resolve(out);
  return new Promise(resolve => {
    const worker = async () => {
      while (cursor < total && !cancelled) {
        const i = cursor++;
        const r = await probeOne(arr[i]);
        if (cancelled) return;
        out[i] = Object.assign({}, arr[i], r);
        finished++;
        if (hooks.onEach) hooks.onEach(out[i], i, total);
        if (!firstFired && r.ok) { firstFired = true; if (hooks.onFirst) hooks.onFirst(out[i], i, total); }
        if (finished >= total) resolve(out);
      }
      if (cancelled && finished >= total) resolve(out);
    };
    for (let k = 0; k < Math.min(CONCURRENCY, total); k++) worker();
  });
}

export function latencyScore(r) {
  if (!r.ok) return 0;
  const ttfb = r.ttfb > 0 ? r.ttfb : 400;
  const hit = r.ms > 0 ? r.ms : ttfb;
  const lat = Math.max(0, Math.min(1, 1 - (ttfb - 120) / 1400));
  const ping = Math.max(0, Math.min(1, 1 - (hit - 30) / 420));
  return Math.round((lat * 0.62 + ping * 0.38) * 100);
}

/* 服务端 /api/probe 吐 NDJSON，一条一行。RN 的 fetch 拿不到增量流，
   这里用 XHR 的 onprogress 读已经到达的字节。失败就退回逐条直连探测。 */
export function probeStream(list, hooks = {}) {
  const arr = list.map(s => Object.assign({}, typeof s === 'string' ? { u: s } : s));
  const total = arr.length;
  if (!total) return Promise.resolve([]);

  const out = new Array(total);
  let firstFired = false, finished = 0, aborted = false;
  let xhr = null;

  hooks.cancel = () => {
    aborted = true;
    if (xhr) { try { xhr.abort(); } catch (e) {} }
  };

  const emit = (i, r) => {
    if (aborted) return;
    out[i] = r;
    finished++;
    if (hooks.onEach) hooks.onEach(r, i, total);
    if (!firstFired && r.ok) { firstFired = true; if (hooks.onFirst) hooks.onFirst(r, i, total); }
  };

  const handle = raw => {
    let o;
    try { o = JSON.parse(raw); } catch (e) { return; }
    if (!o || !o.u) return;
    const i = arr.findIndex(x => x.u === o.u);
    if (i < 0 || out[i]) return;
    emit(i, Object.assign({}, arr[i], o, { score: latencyScore(o), done: true, verified: !!o.ok && o.status === 200 }));
  };

  return new Promise(resolve => {
    let settled = false;
    const done = v => { if (!settled) { settled = true; resolve(v); } };
    const fallback = () => {
      if (aborted) return done(out.filter(Boolean));
      probeUntil(arr, hooks).then(r => done(r)).catch(() => done(out.filter(Boolean)));
    };

    const qs = arr.map(x => 'u=' + encodeURIComponent(x.u)).join('&');
    try {
      xhr = new XMLHttpRequest();
      xhr.open('GET', getBase() + '/api/probe?' + qs, true);
      let seen = 0;
      xhr.onprogress = () => {
        if (aborted) return;
        const txt = xhr.responseText || '';
        if (txt.length <= seen) return;
        const chunk = txt.slice(seen);
        seen = txt.length;
        chunk.split('\n').forEach(l => { const s = l.trim(); if (s) handle(s); });
      };
      xhr.onload = () => {
        if (aborted) return done(out.filter(Boolean));
        const txt = xhr.responseText || '';
        if (txt.length > seen) txt.slice(seen).split('\n').forEach(l => { const s = l.trim(); if (s) handle(s); });
        done(out);
      };
      xhr.onerror = () => { if (!aborted) fallback(); };
      xhr.ontimeout = () => { if (!aborted) fallback(); };
      xhr.onabort = () => done(out.filter(Boolean));
      xhr.send();
    } catch (e) { fallback(); }
  });
}

export async function fetchRtt(hosts) {
  const uniq = [...new Set((hosts || []).filter(Boolean))].slice(0, 24);
  if (!uniq.length) return {};
  try {
    const r = await fetch(getBase() + '/api/rtt?h=' + encodeURIComponent(uniq.join(',')));
    const j = await r.json();
    return (j && j.rtt) || {};
  } catch (e) { return {}; }
}

export async function attachRtt(list) {
  const map = await fetchRtt((list || []).map(x => (x && (x.host || x.url)) || '').map(h => {
    try { return new URL(h).host; } catch (e) { return h && h.indexOf('://') < 0 ? h : ''; }
  }));
  (list || []).forEach(x => {
    if (!x) return;
    const ms = map[x.host];
    if (ms > 0) x.ms = ms;
  });
  return list;
}

export function rank(probed) {
  return probed.slice().sort((a, b) => {
    if (!!a.ok !== !!b.ok) return a.ok ? -1 : 1;
    return (b.score || 0) - (a.score || 0);
  });
}

export function best(probed) {
  const r = rank(probed);
  return r.length ? r[0] : null;
}

export const NFNet = {
  probeOne, probeAll, probeUntil, probeStream, fetchRtt, attachRtt,
  rank, best, score, flush, NO_FETCH, TTL,
};
