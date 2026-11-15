/* 图标：Web 版用 <symbol> + <use>，RN 没有这套，改成按 id 查表渲染 react-native-svg。
   22 个图标的 path 数据逐字搬自 Web 版 Sprite.jsx，只把属性名换成 SVG 组件的写法。 */
import React from 'react';
import Svg, { Path, Circle, Rect, Text as SvgText } from 'react-native-svg';

const P = { fill: 'none', stroke: 'currentColor', strokeWidth: 1.7, strokeLinecap: 'round', strokeLinejoin: 'round' };
const F = { fill: 'currentColor', stroke: 'none' };

const ICONS = {
  'i-mark': () => (
    <>
      <Rect x="2.6" y="6" width="3.1" height="12" rx="1" fill="currentColor" stroke="none" />
      <Rect x="8" y="6" width="1.5" height="12" rx=".75" fill="currentColor" stroke="none" />
      <Rect x="11.8" y="6" width="3.1" height="12" rx="1" fill="currentColor" stroke="none" />
      <Path d="M17.6 7.4c0-.72.8-1.16 1.4-.76l2.4 1.6c.56.38.56 1.22 0 1.6l-2.4 1.6c-.6.4-1.4-.04-1.4-.76V7.4Z" fill="currentColor" stroke="none" />
    </>
  ),
  'i-play': () => <Path {...F} d="M8 5.2c0-.9 1-1.5 1.8-1L19 10.9c.8.5.8 1.7 0 2.2L9.8 19.8c-.8.5-1.8-.1-1.8-1V5.2Z" />,
  'i-plus': () => <Path {...P} d="M12 5v14M5 12h14" />,
  'i-check': () => <Path {...P} d="m5 13 4.5 4.5L19 7" />,
  'i-info': () => (<><Circle {...P} cx="12" cy="12" r="8.5" /><Path {...P} d="M12 11v5.5M12 7.8v.6" /></>),
  'i-search': () => (<><Circle {...P} cx="11" cy="11" r="6.5" /><Path {...P} d="m16 16 4 4" /></>),
  'i-close': () => <Path {...P} d="M6 6l12 12M18 6 6 18" />,
  'i-home': () => <Path {...P} d="M4 10.5 12 4l8 6.5V19a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 4 19v-8.5Z" />,
  'i-tv': () => (<><Rect {...P} x="3" y="7" width="18" height="12" rx="2.5" /><Path {...P} d="M8.5 3.5 12 7l3.5-3.5" /></>),
  'i-bookmark': () => <Path {...P} d="M6.5 4h11a1 1 0 0 1 1 1v15l-6.5-4.2L5.5 20V5a1 1 0 0 1 1-1Z" />,
  'i-back': () => <Path {...P} d="M14.5 5.5 8 12l6.5 6.5" />,
  'i-pause': () => (
    <>
      <Rect x="7" y="5" width="3.4" height="14" rx="1.2" fill="currentColor" stroke="none" />
      <Rect x="13.6" y="5" width="3.4" height="14" rx="1.2" fill="currentColor" stroke="none" />
    </>
  ),
  'i-forward': () => (
    <>
      <Path {...P} d="M12 5a7 7 0 1 1-6.6 4.7" />
      <Path {...P} d="M12 1.8 15.6 5 12 8.2" />
      <SvgText x="12" y="16.4" fontSize="7.6" textAnchor="middle" fill="currentColor" fontWeight="800">10</SvgText>
    </>
  ),
  'i-back10': () => (
    <>
      <Path {...P} d="M12 5a7 7 0 1 0 6.6 4.7" />
      <Path {...P} d="M12 1.8 8.4 5 12 8.2" />
      <SvgText x="12" y="16.4" fontSize="7.6" textAnchor="middle" fill="currentColor" fontWeight="800">10</SvgText>
    </>
  ),
  'i-volume': () => (
    <>
      <Path {...P} d="M4 9.5h3.5L12 5.5v13L7.5 14.5H4z" />
      <Path {...P} d="M15.5 9a4.2 4.2 0 0 1 0 6M18 6.5a7.6 7.6 0 0 1 0 11" />
    </>
  ),
  'i-mute': () => (
    <>
      <Path {...P} d="M4 9.5h3.5L12 5.5v13L7.5 14.5H4z" />
      <Path {...P} d="m16 9.5 4 5M20 9.5l-4 5" />
    </>
  ),
  'i-full': () => <Path {...P} d="M4 9V4h5M20 15v5h-5M20 9V4h-5M4 15v5h5" />,
  'i-shrink': () => <Path {...P} d="M9 4v5H4M15 20v-5h5M15 4v5h5M9 20v-5H4" />,
  'i-live': () => (
    <>
      <Circle {...P} cx="12" cy="12" r="2.4" />
      <Path {...P} d="M7.6 7.6a6.2 6.2 0 0 0 0 8.8M16.4 16.4a6.2 6.2 0 0 0 0-8.8M4.9 4.9a10 10 0 0 0 0 14.2M19.1 19.1a10 10 0 0 0 0-14.2" />
    </>
  ),
  'i-star': () => <Path {...P} d="m12 4 2.4 5.1 5.6.7-4.1 3.9 1.1 5.5L12 16.5 6.9 19.2 8 13.7 4 9.8l5.6-.7L12 4Z" />,
  'i-trash': () => <Path {...P} d="M5 7h14M9.5 7V4.8h5V7M7 7l.8 12.2a1.5 1.5 0 0 0 1.5 1.4h5.4a1.5 1.5 0 0 0 1.5-1.4L17 7" />,
  'i-signal': () => <Path {...P} d="M4 18v-3.5M9 18v-6.5M14 18v-9.5M19 18V6" />,
  'i-refresh': () => (<><Path {...P} d="M20 12a8 8 0 1 1-2.5-5.8" /><Path {...P} d="M20 4v4.4h-4.4" /></>),
};

export default function Icon({ name, size = 20, color = '#F5F5F7', strokeWidth }) {
  const Render = ICONS[name] || ICONS['i-mark'];
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" color={color}>
      <Render />
    </Svg>
  );
}

export const ICON_NAMES = Object.keys(ICONS);
