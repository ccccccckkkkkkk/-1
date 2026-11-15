/* 设计 token：与 Web 版 css/style.css 的变量一一对应。
   RN 没有 CSS 变量，这里集中一份，组件只引用它。 */
export const C = {
  bg: '#08080A',
  bg2: '#0B0B10',
  card: '#131317',
  card2: '#1D1D23',
  line: 'rgba(255,255,255,.08)',
  line2: 'rgba(255,255,255,.14)',
  tx: '#F5F5F7',
  tx2: 'rgba(245,245,247,.64)',
  tx3: 'rgba(245,245,247,.42)',
  accent: '#E11D48',
  gold: '#E8B44A',
  glass: 'rgba(18,18,23,.42)',
  glassSolid: 'rgba(18,18,23,.86)',
  scrim: 'rgba(0,0,0,.6)',
};

export const F = {
  display: 'Anton-Regular',
  text: 'Archivo-Regular',
  semi: 'Archivo-SemiBold',
  bold: 'Archivo-ExtraBold',
};

export const R = { card: 14, pill: 999, sheet: 26, btn: 12 };

export const EASE_OUT = 'cubic-bezier(.23,1,.32,1)';

export const hit = { minWidth: 44, minHeight: 44 };
