/* 后端地址：真机装的 APK 必须指向你在局域网里跑着的 server.js。
   首次进 App 会弹设置页，填一次就存进 AsyncStorage。 */
import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY = 'nf:base';
export const DEFAULT_BASE = 'http://192.168.1.2:8099';

let base = DEFAULT_BASE;
let loaded = false;

export const getBase = () => base;
export const isBaseLoaded = () => loaded;

export async function loadBase() {
  try {
    const v = await AsyncStorage.getItem(KEY);
    if (v) base = v;
  } catch (e) {}
  loaded = true;
  return base;
}

export async function saveBase(v) {
  const n = String(v || '').trim().replace(/\/+$/, '');
  base = /^https?:\/\//i.test(n) ? n : DEFAULT_BASE;
  try { await AsyncStorage.setItem(KEY, base); } catch (e) {}
  return base;
}

/* 相对路径补全成绝对地址：图片、API 都要过这一层 */
export const abs = u => {
  const s = String(u || '');
  if (!s) return '';
  if (/^(https?:|data:|file:)/i.test(s)) return s;
  return base + (s.charAt(0) === '/' ? s : '/' + s);
};
