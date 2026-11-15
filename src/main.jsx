import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.jsx';

/* 老内核兜底：脚本解析/运行失败时，启动遮罩会一直盖着。
   这里不依赖任何新语法，把真实错误直接显示出来，避免黑屏无从排查。 */
(function () {
  function show(msg) {
    var b = document.getElementById('boot');
    if (b && b.getAttribute('data-failed')) return;
    if (b) b.setAttribute('data-failed', '1');
    var box = document.createElement('div');
    box.style.cssText = 'position:fixed;left:16px;right:16px;bottom:calc(50% - 190px);z-index:999;' +
      'padding:14px 16px;border:1px solid rgba(225,29,72,.5);border-radius:12px;' +
      'background:rgba(20,20,24,.96);color:#fff;font:12px/1.6 monospace;white-space:pre-wrap;' +
      'max-height:40vh;overflow:auto';
    box.textContent = '脚本加载失败\n' + msg;
    document.body.appendChild(box);
  }
  window.addEventListener('error', function (e) {
    var t = e && e.target;
    if (t && (t.tagName === 'SCRIPT' || t.tagName === 'LINK')) show('资源加载失败：' + (t.src || t.href));
    else show((e && e.message ? e.message : '未知错误') + '\n' + (e && e.filename ? e.filename + ':' + e.lineno : ''));
  }, true);
  window.addEventListener('unhandledrejection', function (e) {
    show('未处理的异步错误：' + ((e && e.reason && (e.reason.message || e.reason)) || '未知'));
  });
  window.__nfShow = show;
})();

const root = createRoot(document.getElementById('root'));
root.render(<StrictMode><App /></StrictMode>);
