/* 多源优选器：从旧版 js/net.js 直接移植为 ES module，
   逻辑一行不改（缓存、打分、流式探测、卡顿观测全部保留）。 */

const CACHE_KEY = 'nf:probe:v2';
const TTL = 30 * 60 * 1000;
const BT = 320 * 1024;
const BUDGET = 1600;
const CONCURRENCY = 3;
const MIN_OK_KBPS = 90;

export const NO_FETCH = typeof location !== 'undefined' && location.protocol === 'file:';
const now = () => (typeof performance !== 'undefined' && performance.now ? performance.now() : Date.now());

let cache = {};
try { cache = JSON.parse(localStorage.getItem(CACHE_KEY) || '{}') || {}; } catch (e) { cache = {}; }
let cacheDirty = false;

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
  if (!cacheDirty) return;
  const keys = Object.keys(cache);
  if (keys.length > 200) {
    keys.sort((a, b) => (cache[b].at || 0) - (cache[a].at || 0));
    keys.slice(180).forEach(k => delete cache[k]);
  }
  try { localStorage.setItem(CACHE_KEY, JSON.stringify(cache)); cacheDirty = false; } catch (e) {}
}
if (typeof window !== 'undefined') {
  window.addEventListener('pagehide', flush);
  setInterval(flush, 20000);
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
    let abs;
    try { abs = new URL(u, base).href; } catch (e) { continue; }
    if (!best || bw > best.bw) best = { bw, url: abs };
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

/* fetch 会被 CORS 拦，但线路其实能播。用 <video> 真加载一次兜底。 */
function probeMedia(url, type, budget) {
  return new Promise(resolve => {
    const isHls = type === 'hls' || /\.m3u8(\?|$)/i.test(url);
    if (isHls && !(document.createElement('video').canPlayType('application/vnd.apple.mpegurl'))) {
      resolve({ ok: null, ms: 0 });
      return;
    }
    const v = document.createElement('video');
    v.preload = 'auto';
    v.muted = true;
    v.playsInline = true;
    v.crossOrigin = 'anonymous';
    const t0 = now();
    let settled = false;
    const finish = ok => {
      if (settled) return;
      settled = true;
      clearTimeout(killer);
      try { v.removeAttribute('src'); v.load(); } catch (e) {}
      resolve({ ok, ms: Math.round(now() - t0) });
    };
    const killer = setTimeout(() => finish(false), budget);
    v.addEventListener('loadeddata', () => finish(true), { once: true });
    v.addEventListener('canplay', () => finish(true), { once: true });
    v.addEventListener('error', () => finish(false), { once: true });
    v.src = url;
    v.load();
  });
}

export async function probeOne(src) {
  const url = typeof src === 'string' ? src : src.u;
  const cached = cacheGet(url);
  if (cached) return Object.assign({}, cached, { url: url, cached: true });
  if (NO_FETCH) return { url, ok: true, score: 50, ttfb: 0, kbps: 0, unknown: true };

  const t0 = now();
  const budgetEnd = t0 + BUDGET;
  const ctl = typeof AbortController !== 'undefined' ? new AbortController() : null;
  const killer = setTimeout(() => ctl && ctl.abort(), BUDGET);

  let ttfb = 0, kbps = 0, bytes = 0, ok = false, err = '', segUrl = url;
  let needMedia = false;

  const req = (u, range) => fetch(u, {
    method: 'GET', mode: 'cors', credentials: 'omit', cache: 'no-store',
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
    err = name === 'AbortError' ? '超时' : (e && e.message) || '失败';
    needMedia = true;
    ok = false;
  } finally {
    clearTimeout(killer);
  }

  let mediaOK = null, mediaMs = 0;
  if (!ok && needMedia) {
    const m = await probeMedia(url, /\.m3u8(\?|$)/i.test(url) ? 'hls' : 'mp4', 4200);
    mediaOK = m.ok; mediaMs = m.ms;
    if (mediaOK) {
      err = '';
      ok = true;
      kbps = Math.max(kbps, Math.round(180 * Math.max(0.15, 1 - (mediaMs - 300) / 4200)));
      ttfb = ttfb || mediaMs;
    } else if (mediaOK === false && !err) {
      err = '无法解码';
    }
  }

  const playable = ok && (kbps >= MIN_OK_KBPS || mediaOK === true);
  const rec = {
    url, ok: playable,
    kbps: Math.round(kbps), ttfb: Math.round(ttfb), bytes, err,
    verified: mediaOK === true,
    host: (() => { try { return new URL(url).host; } catch (e) { return ''; } })(),
    score: score({ ok: playable, kbps, ttfb }),
    seg: segUrl,
  };
  cacheSet(url, { ok: rec.ok, kbps: rec.kbps, ttfb: rec.ttfb, bytes, err, score: rec.score, seg: segUrl, verified: rec.verified });
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

export function probeUntil(list, hooks) {
  hooks = hooks || {};
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

/* 服务端没有 CORS 这层，直连 m3u8 一两百毫秒就出结论，
   按行推回来（NDJSON），探完一条画一条，第一条 ok 立刻起播。 */
export function latencyScore(r) {
  if (!r.ok) return 0;
  const ttfb = r.ttfb > 0 ? r.ttfb : 400;
  const hit = r.ms > 0 ? r.ms : ttfb;
  const lat = Math.max(0, Math.min(1, 1 - (ttfb - 120) / 1400));
  const ping = Math.max(0, Math.min(1, 1 - (hit - 30) / 420));
  return Math.round((lat * 0.62 + ping * 0.38) * 100);
}

export function probeStream(list, hooks) {
  hooks = hooks || {};
  const arr = list.map(s => Object.assign({}, typeof s === 'string' ? { u: s } : s));
  const total = arr.length;
  if (!total) return Promise.resolve([]);

  const out = new Array(total);
  let firstFired = false, finished = 0, aborted = false;
  const ctrl = typeof AbortController !== 'undefined' ? new AbortController() : null;
  hooks.cancel = () => { aborted = true; if (ctrl) { try { ctrl.abort(); } catch (e) {} } };

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
    const fallback = () => {
      if (aborted) return resolve(out.filter(Boolean));
      probeUntil(arr, hooks).then(r => resolve(r)).catch(() => resolve(out.filter(Boolean)));
    };
    const qs = arr.map(x => 'u=' + encodeURIComponent(x.u)).join('&');
    let res;
    try {
      res = fetch('/api/probe?' + qs, { cache: 'no-store', signal: ctrl ? ctrl.signal : undefined });
    } catch (e) { return fallback(); }

    res.then(r => {
      if (aborted) return resolve(out.filter(Boolean));
      if (!r.ok || !r.body || !r.body.getReader) return fallback();
      const reader = r.body.getReader();
      const dec = typeof TextDecoder !== 'undefined' ? new TextDecoder() : null;
      if (!dec) return fallback();
      let buf = '';
      const pump = () => reader.read().then(({ value, done }) => {
        if (done) {
          buf += dec.decode();
          if (buf.trim()) buf.split('\n').forEach(l => l.trim() && handle(l.trim()));
          return resolve(out);
        }
        buf += dec.decode(value, { stream: true });
        let k;
        while ((k = buf.indexOf('\n')) >= 0) {
          const line = buf.slice(0, k).trim();
          buf = buf.slice(k + 1);
          if (line) handle(line);
        }
        if (aborted) { try { reader.cancel(); } catch (e) {} return resolve(out.filter(Boolean)); }
        return pump();
      }).catch(() => resolve(out.filter(Boolean)));
      pump();
    }).catch(() => fallback());
  });
}

/* 用户要的是 ping 毫秒，不是下载速率 */
export async function fetchRtt(hosts) {
  const uniq = [...new Set((hosts || []).filter(Boolean))].slice(0, 24);
  if (!uniq.length) return {};
  try {
    const r = await fetch('/api/rtt?h=' + encodeURIComponent(uniq.join(',')), { cache: 'no-store' });
    const j = await r.json();
    return (j && j.rtt) || {};
  } catch (e) { return {}; }
}

export async function attachRtt(list) {
  const map = await fetchRtt(list.map(x => (x && (x.host || x.url)) || '').map(h => {
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

export function watchStall(video, onStall, opt = {}) {
  const NEED = opt.need || 5.5;
  const RESET = opt.reset || 2200;
  let since = 0, timer = null, fired = false;
  const start = () => {
    if (timer || fired) return;
    since = Date.now();
    timer = setInterval(() => {
      if (video.paused) return;
      if (Date.now() - since > NEED * 1000) { fired = true; stop(); onStall(); }
    }, 500);
  };
  const stop = () => { clearInterval(timer); timer = null; };
  const ok = () => {
    if (!timer) return;
    if (Date.now() - since > RESET && !video.seeking) stop();
  };
  video.addEventListener('waiting', start);
  video.addEventListener('stalled', start);
  video.addEventListener('playing', stop);
  video.addEventListener('timeupdate', ok);
  return () => {
    stop();
    video.removeEventListener('waiting', start);
    video.removeEventListener('stalled', start);
    video.removeEventListener('playing', stop);
    video.removeEventListener('timeupdate', ok);
  };
}

export const NFNet = {
  probeOne, probeAll, probeUntil, probeStream, fetchRtt, attachRtt,
  rank, best, watchStall, score, flush, NO_FETCH, TTL,
};
