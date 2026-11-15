/* 图标雪碧图：沿用旧版 22 个 symbol，React 版只搬不改，尺寸与线宽都依赖 style.css 的 .sprite 规则 */
export default function Sprite() {
  return (
    <svg className="sprite" aria-hidden="true">
      <symbol id="i-mark" viewBox="0 0 24 24"><rect x="2.6" y="6" width="3.1" height="12" rx="1" fill="currentColor" stroke="none" /><rect x="8" y="6" width="1.5" height="12" rx=".75" fill="currentColor" stroke="none" /><rect x="11.8" y="6" width="3.1" height="12" rx="1" fill="currentColor" stroke="none" /><path d="M17.6 7.4c0-.72.8-1.16 1.4-.76l2.4 1.6c.56.38.56 1.22 0 1.6l-2.4 1.6c-.6.4-1.4-.04-1.4-.76V7.4Z" fill="currentColor" stroke="none" /></symbol>
      <symbol id="i-play" viewBox="0 0 24 24"><path fill="currentColor" stroke="none" d="M8 5.2c0-.9 1-1.5 1.8-1L19 10.9c.8.5.8 1.7 0 2.2L9.8 19.8c-.8.5-1.8-.1-1.8-1V5.2Z" /></symbol>
      <symbol id="i-plus" viewBox="0 0 24 24"><path d="M12 5v14M5 12h14" strokeLinecap="round" /></symbol>
      <symbol id="i-check" viewBox="0 0 24 24"><path d="m5 13 4.5 4.5L19 7" strokeLinecap="round" strokeLinejoin="round" /></symbol>
      <symbol id="i-info" viewBox="0 0 24 24"><circle cx="12" cy="12" r="8.5" /><path d="M12 11v5.5M12 7.8v.6" strokeLinecap="round" /></symbol>
      <symbol id="i-search" viewBox="0 0 24 24"><circle cx="11" cy="11" r="6.5" /><path d="m16 16 4 4" strokeLinecap="round" /></symbol>
      <symbol id="i-close" viewBox="0 0 24 24"><path d="M6 6l12 12M18 6 6 18" strokeLinecap="round" /></symbol>
      <symbol id="i-home" viewBox="0 0 24 24"><path d="M4 10.5 12 4l8 6.5V19a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 4 19v-8.5Z" strokeLinejoin="round" /></symbol>
      <symbol id="i-tv" viewBox="0 0 24 24"><rect x="3" y="7" width="18" height="12" rx="2.5" /><path d="M8.5 3.5 12 7l3.5-3.5" strokeLinecap="round" strokeLinejoin="round" /></symbol>
      <symbol id="i-bookmark" viewBox="0 0 24 24"><path d="M6.5 4h11a1 1 0 0 1 1 1v15l-6.5-4.2L5.5 20V5a1 1 0 0 1 1-1Z" strokeLinejoin="round" /></symbol>
      <symbol id="i-back" viewBox="0 0 24 24"><path d="M14.5 5.5 8 12l6.5 6.5" strokeLinecap="round" strokeLinejoin="round" /></symbol>
      <symbol id="i-pause" viewBox="0 0 24 24"><rect x="7" y="5" width="3.4" height="14" rx="1.2" fill="currentColor" stroke="none" /><rect x="13.6" y="5" width="3.4" height="14" rx="1.2" fill="currentColor" stroke="none" /></symbol>
      <symbol id="i-forward" viewBox="0 0 24 24"><path d="M12 5a7 7 0 1 1-6.6 4.7" strokeLinecap="round" /><path d="M12 1.8 15.6 5 12 8.2" strokeLinejoin="round" /><text x="12" y="16.4" fontSize="7.6" textAnchor="middle" fill="currentColor" stroke="none" fontFamily="Archivo,sans-serif" fontWeight="800">10</text></symbol>
      <symbol id="i-back10" viewBox="0 0 24 24"><path d="M12 5a7 7 0 1 0 6.6 4.7" strokeLinecap="round" /><path d="M12 1.8 8.4 5 12 8.2" strokeLinejoin="round" /><text x="12" y="16.4" fontSize="7.6" textAnchor="middle" fill="currentColor" stroke="none" fontFamily="Archivo,sans-serif" fontWeight="800">10</text></symbol>
      <symbol id="i-volume" viewBox="0 0 24 24"><path d="M4 9.5h3.5L12 5.5v13L7.5 14.5H4z" strokeLinejoin="round" /><path d="M15.5 9a4.2 4.2 0 0 1 0 6M18 6.5a7.6 7.6 0 0 1 0 11" strokeLinecap="round" /></symbol>
      <symbol id="i-mute" viewBox="0 0 24 24"><path d="M4 9.5h3.5L12 5.5v13L7.5 14.5H4z" strokeLinejoin="round" /><path d="m16 9.5 4 5M20 9.5l-4 5" strokeLinecap="round" /></symbol>
      <symbol id="i-full" viewBox="0 0 24 24"><path d="M4 9V4h5M20 15v5h-5M20 9V4h-5M4 15v5h5" strokeLinecap="round" strokeLinejoin="round" /></symbol>
      <symbol id="i-shrink" viewBox="0 0 24 24"><path d="M9 4v5H4M15 20v-5h5M15 4v5h5M9 20v-5H4" strokeLinecap="round" strokeLinejoin="round" /></symbol>
      <symbol id="i-live" viewBox="0 0 24 24"><circle cx="12" cy="12" r="2.4" /><path d="M7.6 7.6a6.2 6.2 0 0 0 0 8.8M16.4 16.4a6.2 6.2 0 0 0 0-8.8M4.9 4.9a10 10 0 0 0 0 14.2M19.1 19.1a10 10 0 0 0 0-14.2" strokeLinecap="round" /></symbol>
      <symbol id="i-star" viewBox="0 0 24 24"><path d="m12 4 2.4 5.1 5.6.7-4.1 3.9 1.1 5.5L12 16.5 6.9 19.2 8 13.7 4 9.8l5.6-.7L12 4Z" strokeLinejoin="round" /></symbol>
      <symbol id="i-trash" viewBox="0 0 24 24"><path d="M5 7h14M9.5 7V4.8h5V7M7 7l.8 12.2a1.5 1.5 0 0 0 1.5 1.4h5.4a1.5 1.5 0 0 0 1.5-1.4L17 7" strokeLinecap="round" strokeLinejoin="round" /></symbol>
      <symbol id="i-signal" viewBox="0 0 24 24"><path d="M4 18v-3.5M9 18v-6.5M14 18v-9.5M19 18V6" strokeLinecap="round" /></symbol>
      <symbol id="i-refresh" viewBox="0 0 24 24"><path d="M20 12a8 8 0 1 1-2.5-5.8" strokeLinecap="round" /><path d="M20 4v4.4h-4.4" strokeLinecap="round" strokeLinejoin="round" /></symbol>
    </svg>
  );
}
