/* NeonFlick React 构建：把 src/ 打成 dist/ 一份可直接静态托管的产物。
   - app.js     ：main.jsx 全量 bundle（react/react-dom 内联，不依赖 CDN）
   - style.css  ：原样拷贝，字体路径已按 dist 同级写好
   - index.html ：注入版本号，避免手机上缓存旧壳
   依赖装在 /root/nfbuild（/sdcard 是 FUSE，不支持 npm 的软链）。
   用法：node build.mjs */
import { build } from '/root/nfbuild/node_modules/esbuild/lib/main.js';
import { readFileSync, writeFileSync, mkdirSync, existsSync, cpSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = dirname(fileURLToPath(import.meta.url));
const DIST = join(ROOT, 'dist');
const V = 'r' + Date.now().toString(36);

if (!existsSync(DIST)) mkdirSync(DIST, { recursive: true });

const res = await build({
  entryPoints: [join(ROOT, 'src/main.jsx')],
  bundle: true,
  outfile: join(DIST, 'app.js'),
  format: 'iife',
  target: ['es2019'],
  nodePaths: ['/root/nfbuild/node_modules'],
  jsx: 'automatic',
  minify: true,
  legalComments: 'none',
  define: { 'process.env.NODE_ENV': '"production"' },
  loader: { '.js': 'jsx' },
  logLevel: 'info',
  metafile: true,
});

cpSync(join(ROOT, 'src/style.css'), join(DIST, 'style.css'));
const html = readFileSync(join(ROOT, 'src/index.html'), 'utf8').replaceAll('__V__', V);
writeFileSync(join(DIST, 'index.html'), html);

const kb = n => (n / 1024).toFixed(1) + 'KB';
const bytes = Object.values(res.metafile.outputs).reduce((a, o) => a + o.bytes, 0);
console.log('built', V, kb(bytes));
