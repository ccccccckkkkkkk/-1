/* 详情抽屉的转场编排：全部走 CSS class + inline clip-path，不碰 WAAPI。

   这一版起，详情页不再让海报自己飞到 hero 上（那层「共享元素」），
   而是**整个详情页从被点的卡片矩形长开**：
   起点 = 卡片矩形，终点 = 整屏。只有一个矩形在动，
   所以不存在「洞口比海报大一圈、下半屏提前露出来」的撕裂，
   也不存在两层交接那一帧的闪。 */

let clipSeq = 0;

const $ = id => document.getElementById(id);

/* 卡片有一半在屏幕外（横向轨道右侧那张、或下拉了一半）时，
   可见面积可能只有几个像素。拿这种矩形起手会像「从屏幕边缘挤进来」，
   不如直接瞬时显形。要求可见区域至少 24×24。 */
function visibleEnough(box) {
  if (!box || !(box.w > 8) || !(box.h > 8)) return false;
  const W = window.innerWidth;
  const H = window.innerHeight;
  const vw = Math.min(box.l + box.w, W) - Math.max(box.l, 0);
  const vh = Math.min(box.t + box.h, H) - Math.max(box.t, 0);
  return vw >= 24 && vh >= 24;
}

export function txBegin() { document.documentElement.classList.add('is-tx'); }
export function txEnd() { document.documentElement.classList.remove('is-tx'); }

/* 详情整页瞬时显形：先临时掐掉过渡，改完再恢复，
   否则「隐藏」类一摘，opacity 0→1 又要走一段，整屏再合成一遍。 */
export function showSheetNow() {
  const sh = $('sheet');
  if (!sh) return;
  const prev = sh.style.transition;
  sh.style.transition = 'none';
  sh.classList.remove('is-shut', 'is-dim');
  void sh.offsetWidth;
  sh.style.transition = prev;
}

export function hideSheetNow() {
  const sh = $('sheet');
  if (!sh) return;
  const prev = sh.style.transition;
  sh.style.transition = 'none';
  sh.classList.remove('is-open');
  sh.classList.add('is-shut');
  void sh.offsetWidth;
  sh.style.transition = prev;
}

/* 卡片矩形 → clip 的 inset 值。四个方向都夹到视口内：
   卡片可能有一半在横向轨道外，不夹的话起点会是贴着屏幕外的窄缝。 */
export function sheetClipFrom(from) {
  const W = window.innerWidth;
  const H = window.innerHeight;
  const l = Math.max(0, Math.min(from.l, W - 1));
  const t = Math.max(0, Math.min(from.t, H - 1));
  const w = Math.min(from.w, W - l);
  const h = Math.min(from.h, H - t);
  const r = Math.max(0, W - (l + w));
  const b = Math.max(0, H - (t + h));
  return 'inset(' + t + 'px ' + r + 'px ' + b + 'px ' + l + 'px)';
}

const CLIP_EASE_IN = 'cubic-bezier(.22,.68,.16,1)';
const CLIP_EASE_OUT = 'cubic-bezier(.36,0,.28,1)';

function setClip(sh, v) {
  sh.style.clipPath = v;
  sh.style.webkitClipPath = v;
}

/* 打开：整页从卡片矩形张开到全屏。
   - opacity 直接钉 1：整页是「张开」不是「淡入」，clip 之外不绘制，
     真正要画的只有卡片那么大一块，比先整屏透明铺一遍更便宜。
   - transition 必须 inline 显式写：.sheet.is-dim 的 transition:none
     特异性压过 .sheet，留空会回落 none，clip 一步跳到全屏、看不见张开。
   - is-opening 期间首页 hero 大图藏起来，张开那几百毫秒里
     clip 之外露出的应该是干净底色，而不是上一部片子的大幅海报。 */
export function sheetOpenFrom(from) {
  const sh = $('sheet');
  if (!sh) return false;
  if (!visibleEnough(from)) { showSheetNow(); return false; }

  const start = sheetClipFrom(from);
  sh.style.transition = 'none';
  sh.style.opacity = '1';
  sh.style.visibility = 'visible';
  setClip(sh, start);
  void sh.offsetWidth;
  sh.style.transition =
    'clip-path .42s ' + CLIP_EASE_IN + ',-webkit-clip-path .42s ' + CLIP_EASE_IN;
  setClip(sh, 'inset(0px)');

  document.documentElement.classList.add('is-opening');
  const my = ++clipSeq;
  setTimeout(() => {
    if (my !== clipSeq) return;
    sh.style.transition = '';
    document.documentElement.classList.remove('is-opening');
  }, 500);
  return true;
}

/* 关闭第一拍：整页收回卡片矩形。这段里 opacity 必须锁在 1，
   否则 React 摘掉 is-open 时 opacity 会立刻往 0 跑，收拢还没走完就淡没了。
   收拢时不能藏首页：那一段背景要渐渐露回来，藏了就会在收完瞬间「啪」地弹出。 */
export function sheetClipBack(from) {
  const sh = $('sheet');
  if (!sh) return false;
  if (!visibleEnough(from)) return false;
  document.documentElement.classList.remove('is-opening');
  clipSeq++;
  sh.style.transition = 'clip-path .3s ' + CLIP_EASE_OUT + ',-webkit-clip-path .3s ' + CLIP_EASE_OUT;
  sh.style.opacity = '1';
  sh.style.visibility = 'visible';
  setClip(sh, sheetClipFrom(from));
  return true;
}

/* 关闭第二拍：收拢已到位，只剩卡片大小的一小块，120ms 淡掉。 */
export function sheetFadeOut(done) {
  const sh = $('sheet');
  if (!sh) { done && done(); return; }
  document.documentElement.classList.remove('is-opening');
  clipSeq++;
  sh.style.transition = 'opacity .12s linear';
  sh.style.opacity = '0';
  setTimeout(() => {
    sh.style.transition = 'none';
    setClip(sh, 'inset(0px)');
    sh.style.opacity = '';
    sh.style.visibility = '';
    void sh.offsetWidth;
    sh.style.transition = '';
    done && done();
  }, 160);
}

/* 兜底复位：任何时候把整页恢复成「全屏、无过渡残留」 */
export function sheetClipReset() {
  const sh = $('sheet');
  if (!sh) return;
  clipSeq++;
  sh.style.transition = 'none';
  setClip(sh, 'inset(0px)');
  sh.style.opacity = '';
  sh.style.visibility = '';
  void sh.offsetWidth;
  sh.style.transition = '';
}

export function reduceMotion() {
  return !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
}

/* 等转场跑完再干重活。
   详情数据回来的时候整段正文会一次性建树 + 布局，如果这发生在
   张开的那 420ms 里，就是一次 100ms 以上的长任务，动画当场掉帧。
   所以取数回来后先挂起，等 is-tx 摘掉再 setState。 */
export function waitTx(limit = 1400) {
  return new Promise(resolve => {
    if (!document.documentElement.classList.contains('is-tx')) { resolve(); return; }
    const t0 = Date.now();
    const tick = () => {
      if (!document.documentElement.classList.contains('is-tx') || Date.now() - t0 > limit) { resolve(); return; }
      setTimeout(tick, 40);
    };
    setTimeout(tick, 40);
  });
}
