# NeonFlick · React Native 版

多源影视聚合 App 的原生版本。UI 与交互对齐 Web 版（`../neonflick-react/`），
后端仍是同一个 `server.js`，App 只负责界面与播放。

- 详情页整页从被点卡片的位置张开、收回原卡片（不做海报飞行，顶部封面是品牌标记）
- 顶部渐变随滚动压暗，悬浮胶囊长按抬起、拖动切页
- 线路自动测速优选，第一条通就起播，播放器内可切线路、倍速、拖进度、续播

---

## 一、先跑后端

APK 里没有同源概念，必须有一个能访问到的服务器。

```bash
cd ../neonflick
bash start.sh          # 默认 8099，见 /tmp/nf.log
curl -s http://127.0.0.1:8099/api/ping
```

手机和服务器要在同一局域网，记下服务器的内网地址，例如 `http://192.168.1.2:8099`。

## 二、装 APK

首次启动会停在「填一下片源服务器地址」这一页，填入上面的地址，点「保存并连接」。
连通后地址存进本地存储（`nf:base`），以后不再问。

之后想改地址：「我的 → 片源服务器」。

## 三、在 GitHub 上打包

仓库里已经带好 `.github/workflows/build-apk.yml`，推送即出包：

```bash
cd neonflick-rn
git init && git add . && git commit -m "feat: React Native 版"
git branch -M main
git remote add origin git@github.com:<你>/<仓库>.git
git push -u origin main
```

然后在仓库的 **Actions → Build APK** 里能看到构建；跑完在当次运行的
**Artifacts** 里下载 `NeonFlick-apk`，解压得到 `app-release.apk`。

也可以在 Actions 页面点 **Run workflow** 手动触发。

工作流做的事：Node 20 → JDK 17（temurin）→ Android SDK → 缓存 Gradle →
`npm install --legacy-peer-deps` → `./gradlew assembleRelease` → 上传产物。
单次约 8～15 分钟，首次冷缓存更久。

## 四、只用 arm64

`android/gradle.properties` 里 `reactNativeArchitectures=arm64-v8a`。
绝大多数手机够用；要给模拟器或 32 位设备装，改成 `arm64-v8a,armeabi-v7a,x86_64`，
包体会从 ~30MB 涨到 ~70MB。

## 五、签名

`android/app/build.gradle` 的 release 目前复用 `app/debug.keystore`
（密码都是 `android`），装得上、能覆盖安装，但**不是正式签名**，
上架或分发前请换成自己的 keystore。

## 六、目录

```
src/
  App.jsx            路由、详情/播放器浮层、硬件返回键分层
  theme.js           颜色、字体、圆角
  lib/config.js      后端地址（AsyncStorage）
  lib/core.js        接口、占位渐变、收藏与观看记录、toast 总线
  lib/net.js         多源测速：服务端 NDJSON 流 → 失败退逐条直连
  components/        Icon / Card / Gradient / Rail / Topbar / Tabbar / Hero
  screens/           Home / Library / Mine / Detail / Player / Search / Settings
android/             RN 0.75.5 骨架，Java 入口（不用 Kotlin，避免拖慢构建）
```

## 七、技术取舍

- **不用 hls.js**：Android 的 ExoPlayer 原生吃 HLS，播放器直接用 `react-native-video`。
- **测速走 XHR**：RN 的 `fetch` 没有 `res.body.getReader()`，拿不到增量流，
  所以 `/api/probe` 的 NDJSON 用 `XMLHttpRequest.onprogress` 边到边解。
- **不引 linear-gradient**：占位底色用一层旋转纯色近似 158° 双色渐变，
  少一个原生依赖、少一次编译风险。想换真渐变，装 `react-native-linear-gradient`
  后替换 `src/components/Gradient.jsx` 即可。
- **详情转场用 transform**：RN 没有 clip-path，整页做一个
  `translate + scale`，从卡片矩形长到全屏，落地后再把骨架交叉淡成真实内容，
  避免文字在缩放过程里被拉扁。

## 八、出错先看这里

| 现象 | 原因 |
| --- | --- |
| 卡在填地址页 | 地址不通、端口不对，或后端没起。先在手机浏览器打开 `地址/api/ping` |
| 有列表但海报不显示 | 图床被拦，图片走 `/api/img?u=` 代理；确认后端能访问外网 |
| 点播放一直转圈 | 线路被墙或超时，进详情页「测速」看哪条通，手动选一条 |
| Actions 里 Gradle 报 SDK 许可 | 工作流用 `android-actions/setup-android`，已自动接受；若改过，补 `yes \| sdkmanager --licenses` |
