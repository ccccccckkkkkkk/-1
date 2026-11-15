/* 详情页：整页从被点的卡片矩形张开（不是海报飞出来），落地后才铺真实内容，
   避免文字在缩放过程里被拉扁。关闭时沿同一路径收回卡片。
   顶部封面区是品牌标记（NEONFLICK），不是影片海报。 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated, Easing, Image, PanResponder, Pressable, ScrollView, Share,
  StatusBar, StyleSheet, Text, View, useWindowDimensions,
} from 'react-native';
import LinearGradient from '../components/Gradient.jsx';
import Icon from '../components/Icon.jsx';
import { C, F, R } from '../theme.js';
import {
  api, favHas, norm, ph, showName, toast, toggleFav, useFav,
} from '../lib/core.js';
import { NFNet, probeStream } from '../lib/net.js';

const EASE = Easing.bezier(.22, .68, .16, 1);
const TOP = (StatusBar.currentHeight || 0);
const hasFromR = f => (f && f.w > 8 && f.h > 8 ? (f.r || 14) : 0);
const hostOf = u => { const m = /^https?:\/\/([^/]+)/i.exec(String(u || '')); return m ? m[1] : ''; };

export default function Detail({ show, autoPlay, from, onClose, onPlay, onRelated, closeRef }) {
  const { width: W, height: H } = useWindowDimensions();
  const [cur, setCur] = useState(() => norm(show));
  const [curUrl, setCurUrl] = useState('');
  const [lines, setLines] = useState([]);
  const [curEp, setCurEp] = useState('');
  const [epList, setEpList] = useState([]);
  const [rows, setRows] = useState({});
  const [probed, setProbed] = useState(null);
  const [panel, setPanel] = useState('idle');
  const [panelOpen, setPanelOpen] = useState(false);
  const [nonce, setNonce] = useState(0);
  const [sumOpen, setSumOpen] = useState(false);
  const [metaState, setMetaState] = useState('loading');
  const [landed, setLanded] = useState(false);
  const [skGone, setSkGone] = useState(false);
  const [closing, setClosing] = useState(false);
  const [related, setRelated] = useState([]);

  const exp = useRef(new Animated.Value(0)).current;
  const fade = useRef(new Animated.Value(0)).current;
  const rad = useRef(new Animated.Value(hasFromR(from))).current;
  const probedRef = useRef(null);
  probedRef.current = probed;
  /* 收起只能触发一次：返回键、下拉、返回按钮三条路都走这里，
     不守卫的话会重复 onClose（重复 setSheet(null) 与重复落盘）。 */
  const closingRef = useRef(false);

  useEffect(() => {
    setLanded(false); setSkGone(false); setClosing(false); closingRef.current = false;
    exp.setValue(0); fade.setValue(0); rad.setValue(hasFromR(from));
    Animated.timing(rad, {
      toValue: 0, duration: 380, easing: EASE, useNativeDriver: false,
    }).start();
    const anim = Animated.timing(exp, {
      toValue: 1, duration: 380, easing: EASE, useNativeDriver: true,
    });
    anim.start(({ finished }) => {
      if (!finished) return;
      setLanded(true);
      Animated.timing(fade, { toValue: 1, duration: 220, useNativeDriver: true })
        .start(({ finished }) => { if (finished) setSkGone(true); });
    });
    return () => anim.stop();
  }, [exp, rad, show.id, from]);

  /* 详情与线路都分段拿，落地后再写 state，避免和张开动画抢同一帧 */
  useEffect(() => {
    let dead = false;
    setMetaState('loading'); setLines([]); setCurEp(''); setEpList([]); setRows({}); setProbed(null);
    setPanel('idle'); setPanelOpen(false); setSumOpen(false); setRelated([]);
    api.detail(show.id).then(d => {
      if (dead) return;
      const n = norm(Object.assign({}, show, d));
      setCur(n);
      setRelated((d.related || []).map(norm).slice(0, 12));
      /* 选集来自 detail：lines[i].eps[j].ep 是条目 id，/api/lines 只认这个 id */
      const all = [];
      const seen = new Set();
      (d.lines || []).forEach(L => (L.eps || []).forEach(e => {
        const v = String(e && e.ep != null ? e.ep : e);
        if (v && !seen.has(v)) { seen.add(v); all.push(v); }
      }));
      /* all 里是条目 id（源站内部编号），按钮要显示集序号 */
      const numbered = all.map((id, i) => ({ id, n: i + 1 }));
      setEpList(numbered);
      if (numbered.length) setCurEp(numbered[0].id);
      else { setPanel('error'); }
      setMetaState('ready');
    }).catch(e => { if (!dead) { setMetaState('error'); toast(e.message || '详情加载失败'); } });
    return () => { dead = true; };
  }, [show.id]);

  useEffect(() => {
    if (!curEp) return undefined;
    let dead = false;
    /* 换集等于换一组线路：上一集的探测结果必须清掉，否则
       probedRef 还留着旧值，新一集首条 ok 就再也不会被选中。 */
    setRows({}); setProbed(null); setCurUrl('');
    api.lines(show.id, curEp).then(d => {
      if (dead) return;
      const list = (d.lines || [])
        .filter(L => L && L.url)
        .map(L => ({
          u: L.url,
          name: L.name || '',
          tag: L.name || L.line || '',
          tip: L.tip || '',
          t: 'hls',
          host: hostOf(L.url),
          eps: L.eps || [],
        }));
      if (!list.length) { setPanel('error'); toast('这条线路取不到地址'); return; }
      setLines(list);
      setPanel('probing');
    }).catch(e => { if (!dead) { setPanel('error'); toast(e.message || '线路加载失败'); } });
    return () => { dead = true; };
  }, [show.id, curEp]);

  useEffect(() => {
    if (!lines.length) return undefined;
    let dead = false;
    if (nonce) { setRows({}); setProbed(null); setPanel('probing'); }
    const list = lines.map(l => ({ u: l.u, tag: l.tag, t: l.t || 'hls', eps: l.eps }));
    probeStream(list, {
      onEach: r => {
        if (dead) return;
        setRows(v => ({ ...v, [r.u]: r }));
        if (r.ok && !probedRef.current) {
          setProbed([r]);
          toast(autoPlay ? '已找到可用线路 · 开始播放' : '首选线路已就绪');
        }
      },
    }).then(r => {
      if (dead || !r) return;
      const ranked = NFNet.rank(r.filter(Boolean));
      setProbed(ranked);
      setPanel('done');
      const b = ranked.find(x => x.ok);
      if (b) toast('已优选 · ' + (b.tag || '线路') + (b.ms ? ' ' + b.ms + ' ms' : ''));
      else toast('线路都不稳定，可手动选一条试试');
    }).catch(() => { if (!dead) setPanel('error'); });
    return () => { dead = true; };
  }, [lines, nonce, autoPlay]);

  /* 自动播放：等第一条 ok 落地 240ms 再交接给播放器，带上已排好的全部备线 */
  useEffect(() => {
    if (!autoPlay || !probed || !probed.length) return undefined;
    const first = probed.find(p => p.ok) || probed[0];
    if (!first) return undefined;
    const t = setTimeout(() => {
      onPlay({
        ...first, id: cur.id, title: cur.title, poster: cur.poster,
        year: cur.year, srcList: probedRef.current || [],
      });
    }, 240);
    return () => clearTimeout(t);
  }, [autoPlay, probed, cur.id, cur.title, cur.poster, cur.year, onPlay]);

  const finishClose = useCallback(() => {
    if (closingRef.current) return;
    closingRef.current = true;
    const anim = Animated.timing(exp, {
      toValue: 0, duration: 300, easing: Easing.bezier(.36, 0, .28, 1), useNativeDriver: true,
    });
    setClosing(true);
    Animated.timing(rad, {
      toValue: hasFromR(from), duration: 300, easing: Easing.bezier(.36, 0, .28, 1),
      useNativeDriver: false,
    }).start();
    anim.start(({ finished }) => { if (finished) onClose(); });
  }, [exp, rad, from, onClose]);

  /* 根组件的硬件返回键要能触发同一套收起动画 */
  useEffect(() => {
    if (!closeRef) return undefined;
    closeRef.current = finishClose;
    return () => { closeRef.current = null; };
  }, [closeRef, finishClose]);

  /* 下拉关闭：正文在顶且继续下拉超过 90px */
  const dy = useRef(new Animated.Value(0)).current;
  const drag = useRef({ y: 0, on: false, top: true }).current;
  const pan = useMemo(() => PanResponder.create({
    onStartShouldSetPanResponder: () => false,
    /* 必须在 capture 阶段判断：ScrollView 是原生滚动容器，普通冒泡阶段
       它先把手势吃掉，只有 capture 才能把「滚到顶后继续下拉」接管过来。 */
    onMoveShouldSetPanResponderCapture: (_, g) => drag.top && g.dy > 12 && Math.abs(g.dy) > Math.abs(g.dx),
    onPanResponderGrant: () => { drag.on = true; },
    onPanResponderMove: (_, g) => { dy.setValue(Math.max(0, g.dy)); },
    onPanResponderRelease: (_, g) => {
      drag.on = false; drag.top = true;
      if (g.dy > 90) finishClose();
      else Animated.spring(dy, { toValue: 0, useNativeDriver: true, damping: 22, stiffness: 220 }).start();
    },
  }), [drag, dy, finishClose]);

  const hasFrom = !!(from && from.w > 8 && from.h > 8);
  const sx = hasFrom ? from.w / W : 0.30;
  const sy = hasFrom ? from.h / H : 0.22;
  const tx = hasFrom ? from.l + from.w / 2 - W / 2 : 0;
  const ty = hasFrom ? from.t + from.h / 2 - H / 2 : H * 0.30;

  const panelStyle = {
    borderRadius: rad,
    overflow: 'hidden',
    transform: [
      { translateX: exp.interpolate({ inputRange: [0, 1], outputRange: [tx, 0] }) },
      { translateY: exp.interpolate({ inputRange: [0, 1], outputRange: [ty, 0] }) },
      { scaleX: exp.interpolate({ inputRange: [0, 1], outputRange: [sx, 1] }) },
      { scaleY: exp.interpolate({ inputRange: [0, 1], outputRange: [sy, 1] }) },
      { translateY: dy },
    ],
  };

  useFav();  // 订阅收藏表：收藏后按钮要立刻变
  const tone = ph(cur);
  const faved = favHas(cur.id);
  const best = probed ? probed.find(p => p.ok) : null;
  const eps = epList;

  /* 主创并入简介（不单独占一行、不显示头像），与 Web 版一致 */
  const crewLine = useMemo(() => {
    const dir = (cur.directors || []).slice(0, 2).join(' / ');
    const act = (cur.actors || []).slice(0, 2).join(' / ');
    if (dir && act) return '导演 ' + dir + ' · 主演 ' + act;
    if (dir) return '导演 ' + dir;
    if (act) return '主演 ' + act;
    return '';
  }, [cur.directors, cur.actors]);
  const summary = crewLine ? crewLine + '。' + (cur.summary || '') : (cur.summary || '');

  const stats = [
    cur.year, cur.region,
    Number(cur.rating) > 0 ? { star: Number(cur.rating).toFixed(1) } : null,
    lines.length ? lines.length + ' 条线路' : null,
    eps.length > 1 ? '共 ' + eps.length + ' 集' : (eps.length === 1 ? '单片' : null),
  ].filter(Boolean);

  const pickRow = u => {
    const r = rows[u];
    const base = lines.find(x => x.u === u) || {};
    const hit = r || base;
    setCurUrl(u);
    setPanelOpen(false);
    onPlay({
      ...base, ...hit, u, src: u, srcTag: hit.tag || base.tag,
      id: cur.id, title: cur.title, poster: cur.poster, year: cur.year,
      srcList: probedRef.current || [],
    });
  };

  const doShare = async () => {
    try { await Share.share({ message: showName(cur) + ' — NeonFlick' }); }
    catch (e) { toast('分享已取消'); }
  };

  return (
    <View style={StyleSheet.absoluteFill}>
      {/* 只在张开/收回期间栅格化：落地后同层里装着可滚动正文，
          继续保留硬件纹理会把整屏内容烘成一张图，滚动与内存都吃亏。 */}
      <Animated.View
        style={[st.panel, panelStyle, { backgroundColor: C.bg }]}
        renderToHardwareTextureAndroid={!landed}
      >
        {!skGone ? (
          <Animated.View
            pointerEvents="none"
            style={[StyleSheet.absoluteFill, st.booting, { opacity: fade.interpolate({ inputRange: [0, 1], outputRange: [1, 0], extrapolate: 'clamp' }) }]}
          >
            <LinearGradient colors={tone} style={StyleSheet.absoluteFill} />
            <Icon name="i-mark" size={44} color="rgba(255,255,255,.5)" />
            <Text style={st.bootName}>NEON<Text style={{ color: C.accent }}>FLICK</Text></Text>
          </Animated.View>
        ) : null}
        {landed ? (
          <View style={{ flex: 1 }} {...pan.panHandlers}>
            <ScrollView
              style={{ flex: 1 }}
              contentContainerStyle={{ paddingBottom: 40 }}
              scrollEventThrottle={16}
              onScroll={e => { drag.top = e.nativeEvent.contentOffset.y <= 2; }}
            >
              {/* 顶部：品牌标记（不是海报） */}
              <View style={st.hero}>
                <LinearGradient colors={['#15151C', '#070709']} style={StyleSheet.absoluteFill} />
                <View style={st.heroCenter}>
                  <Icon name="i-mark" size={44} color="rgba(255,255,255,.5)" />
                  <Text style={st.heroName}>NEON<Text style={{ color: C.accent }}>FLICK</Text></Text>
                </View>
                <Pressable style={st.back} onPress={finishClose} hitSlop={12}>
                  <Icon name="i-back" size={22} />
                </Pressable>
                <View style={st.badge}><Text style={st.badgeTx}>{cur.note || cur.cat || '影片'}</Text></View>
              </View>

              <View style={st.body}>
                <Text style={st.title}>{showName(cur)}</Text>

                <View style={st.stats}>
                  {stats.map((s, i) => (
                    <View key={i} style={st.statWrap}>
                      {i ? <View style={st.dot} /> : null}
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
                        {s && s.star ? <Icon name="i-star" size={11} color={C.gold} /> : null}
                        <Text style={[st.stat, s && s.star && { color: C.gold }]}>
                          {s && s.star ? s.star : s}
                        </Text>
                      </View>
                    </View>
                  ))}
                </View>

                <Pressable style={st.srcRow} onPress={() => setPanelOpen(true)}>
                  <View style={st.srcL}>
                    <View style={[st.live, best && { backgroundColor: C.accent }]} />
                    <Text style={st.srcTx} numberOfLines={1}>
                      {best ? (best.tag || '线路') + (best.ms ? ' · ' + best.ms + ' ms' : '') : '自动优选线路'}
                    </Text>
                  </View>
                  <Icon name="i-back" size={16} color={C.tx3} />
                </Pressable>

                <View style={st.acts}>
                  <Pressable style={st.act} onPress={doShare}>
                    <Icon name="i-forward" size={17} color={C.tx} />
                    <Text style={st.actTx}>分享</Text>
                  </Pressable>
                  <Pressable style={[st.act, faved && st.actOn]} onPress={() => toggleFav(cur)}>
                    <Icon name={faved ? 'i-check' : 'i-plus'} size={17} color={faved ? C.accent : C.tx} />
                    <Text style={[st.actTx, faved && { color: C.accent }]}>{faved ? '已收藏' : '收藏'}</Text>
                  </Pressable>
                  <Pressable style={st.act} onPress={() => { setPanelOpen(true); setNonce(n => n + 1); }}>
                    <Icon name="i-refresh" size={17} color={C.tx} />
                    <Text style={st.actTx}>测速</Text>
                  </Pressable>
                </View>

                {metaState === 'error' ? (
                  <View style={st.errBox}><Text style={st.errTx}>详情加载失败，可返回重试</Text></View>
                ) : null}

                {summary ? (
                  <View style={st.card}>
                    <Text style={[st.sum, !sumOpen && { maxHeight: 66 }]} numberOfLines={sumOpen ? undefined : 3}>
                      {summary}
                    </Text>
                    {summary.length > 96 ? (
                      <Pressable onPress={() => setSumOpen(v => !v)} hitSlop={10} style={st.more}>
                        <Text style={st.moreTx}>{sumOpen ? '收起' : '展开全部'}</Text>
                      </Pressable>
                    ) : null}
                  </View>
                ) : null}
              </View>

              {related.length ? (
                <View style={st.relWrap}>
                  <Text style={st.relK}>相关推荐</Text>
                  <View style={st.relGrid}>
                    {related.map((r, i) => (
                      <RelatedCard
                        key={(r.id || i) + ':' + i}
                        s={r}
                        onPress={() => { if (onRelated) onRelated(r); }}
                      />
                    ))}
                  </View>
                </View>
              ) : null}
            </ScrollView>
          </View>
        ) : null}
      </Animated.View>

      {panelOpen && landed ? (
        <View style={st.sheet} pointerEvents="box-none">
          <Pressable style={st.sheetBg} onPress={() => setPanelOpen(false)} />
          <View style={st.sheetBody}>
            <View style={st.sheetHd}>
              <Text style={st.sheetT}>选集与线路</Text>
              <Pressable hitSlop={12} onPress={() => setPanelOpen(false)}>
                <Icon name="i-close" size={20} color={C.tx3} />
              </Pressable>
            </View>
            <ScrollView contentContainerStyle={{ paddingBottom: 24 }}>
              <View style={st.sec}>
                <View style={st.secHd}>
                  <Text style={st.secT}>选集</Text>
                  <Text style={st.secN}>{eps.length > 1 ? '共 ' + eps.length + ' 集' : '单片'}</Text>
                </View>
                <View style={st.eps}>
                  {eps.map(e => (
                    <Pressable
                      key={e.id}
                      style={[st.ep, e.id === curEp && st.epOn]}
                      onPress={() => setCurEp(e.id)}
                    >
                      <Text style={[st.epTx, e.id === curEp && { color: '#0B0B0F' }]}>{e.n}</Text>
                    </Pressable>
                  ))}
                </View>
              </View>

              <View style={st.sec}>
                <View style={st.secHd}>
                  <Text style={st.secT}>线路</Text>
                  <Text style={st.secN}>
                    {panel === 'probing' ? '自动优选中' : lines.length ? '共 ' + lines.length + ' 条 · 自动优选' : ''}
                  </Text>
                  <Pressable hitSlop={10} style={st.reBtn} onPress={() => setNonce(n => n + 1)}>
                    <Icon name="i-refresh" size={14} color={panel === 'probing' ? C.accent : C.tx3} />
                  </Pressable>
                </View>
                {lines.map((l, i) => {
                  const r = rows[l.u] || (probed || []).find(p => p.u === l.u) || l;
                  const ok = r.ok === true, dead = r.ok === false;
                  const ms = r.ms || r.ttfb;
                  return (
                    <Pressable
                      key={(l.u || '') + ':' + i}
                      style={[st.pick, curUrl === l.u && { backgroundColor: 'rgba(255,255,255,.05)' }]}
                      onPress={() => pickRow(l.u)}
                    >
                      <Text style={st.pickN}>{i + 1}</Text>
                      <View style={{ flex: 1 }}>
                        <Text style={st.pickT}>线路 {i + 1}{l.tag ? ' · ' + l.tag : ''}</Text>
                        <Text style={st.pickS} numberOfLines={1}>
                          {'HLS · ' + (r.host || '') + ' · ' + (ok ? (ms ? ms + ' ms' : '已连通') : dead ? '不通' : '测速中…')}
                        </Text>
                      </View>
                      <Text style={[st.pickQ, ok && ms <= 120 && { color: C.accent }]}>
                        {ok ? (ms ? ms + 'ms' : '通') : dead ? '×' : '···'}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </ScrollView>
          </View>
        </View>
      ) : null}
    </View>
  );
}

function RelatedCard({ s, onPress }) {
  const tone = ph(s);
  return (
    <Pressable style={st.relCard} onPress={onPress}>
      <View style={[st.relArt, { backgroundColor: tone[0] }]}>
        <LinearGradient colors={tone} style={StyleSheet.absoluteFill} />
        {s.poster ? <Image source={{ uri: s.poster }} style={st.relImg} resizeMode="cover" /> : null}
      </View>
      <Text style={st.relName} numberOfLines={2}>{showName(s)}</Text>
    </Pressable>
  );
}

const st = StyleSheet.create({
  panel: { ...StyleSheet.absoluteFillObject, overflow: 'hidden' },
  /* 骨架层必须压在真实层上面：真实层恒不透明垫底，只让上层淡出，
     中间帧的合成亮度才连续（两层各自半透明叠黑底会暗一下）。 */
  booting: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10, zIndex: 2 },
  bootName: { fontFamily: F.display, fontSize: 22, letterSpacing: 4, color: 'rgba(255,255,255,.66)' },
  hero: { aspectRatio: 16 / 9, justifyContent: 'center', alignItems: 'center', overflow: 'hidden' },
  heroCenter: { alignItems: 'center', gap: 10 },
  heroName: { fontFamily: F.display, fontSize: 23, letterSpacing: 4.2, color: 'rgba(255,255,255,.66)' },
  back: {
    position: 'absolute', left: 10, top: TOP + 8, width: 36, height: 36, borderRadius: 18,
    alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0,0,0,.42)',
  },
  badge: {
    position: 'absolute', right: 12, bottom: 12, paddingHorizontal: 8, paddingVertical: 3,
    borderRadius: 6, backgroundColor: 'rgba(0,0,0,.6)',
  },
  badgeTx: { fontFamily: F.semi, fontSize: 10, color: '#fff' },
  body: { paddingHorizontal: 20, paddingTop: 14 },
  title: { fontFamily: F.display, fontSize: 27, lineHeight: 31, color: C.tx },
  stats: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', marginTop: 10, gap: 6 },
  statWrap: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  dot: { width: 3, height: 3, borderRadius: 2, backgroundColor: 'rgba(255,255,255,.24)' },
  stat: { fontFamily: F.text, fontSize: 11.5, color: C.tx3 },
  srcRow: {
    marginTop: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    height: 44, paddingHorizontal: 12, borderRadius: 12,
    backgroundColor: C.card, borderWidth: StyleSheet.hairlineWidth, borderColor: C.line,
  },
  srcL: { flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 },
  live: { width: 6, height: 6, borderRadius: 3, backgroundColor: 'rgba(255,255,255,.3)' },
  srcTx: { fontFamily: F.semi, fontSize: 12, color: C.tx2 },
  acts: { flexDirection: 'row', gap: 8, marginTop: 12 },
  act: {
    flex: 1, height: 46, borderRadius: 12, alignItems: 'center', justifyContent: 'center', gap: 3,
    backgroundColor: C.card, borderWidth: StyleSheet.hairlineWidth, borderColor: C.line,
  },
  actOn: { borderColor: 'rgba(225,29,72,.5)', backgroundColor: 'rgba(225,29,72,.10)' },
  actTx: { fontFamily: F.semi, fontSize: 10.5, color: C.tx2 },
  errBox: { marginTop: 12, padding: 12, borderRadius: 12, backgroundColor: 'rgba(225,29,72,.12)' },
  errTx: { fontFamily: F.text, fontSize: 12, color: '#F5A5B4' },
  card: {
    marginTop: 14, padding: 14, borderRadius: 14,
    backgroundColor: C.card, borderWidth: StyleSheet.hairlineWidth, borderColor: C.line,
  },
  sum: { fontFamily: F.text, fontSize: 12.5, lineHeight: 20, color: C.tx2, overflow: 'hidden' },
  more: { marginTop: 8, paddingVertical: 6 },
  moreTx: { fontFamily: F.semi, fontSize: 11.5, color: C.accent },
  relWrap: { marginTop: 26 },
  relK: { paddingHorizontal: 20, fontFamily: F.display, fontSize: 18, color: C.tx },
  relGrid: {
    flexDirection: 'row', flexWrap: 'wrap', gap: 6,
    paddingHorizontal: 8, paddingTop: 12,
  },
  relCard: { width: '31.6%' },
  relArt: { width: '100%', aspectRatio: 2 / 3, borderRadius: 12, overflow: 'hidden' },
  relImg: { ...StyleSheet.absoluteFillObject, width: '100%', height: '100%' },
  relName: { marginTop: 6, fontFamily: F.semi, fontSize: 11.5, lineHeight: 15, color: C.tx },
  sheet: { ...StyleSheet.absoluteFillObject, justifyContent: 'flex-end' },
  sheetBg: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,.55)' },
  sheetBody: {
    maxHeight: '76%', backgroundColor: '#0E0E13',
    borderTopLeftRadius: R.sheet, borderTopRightRadius: R.sheet, paddingTop: 8,
  },
  sheetHd: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingVertical: 12,
  },
  sheetT: { fontFamily: F.display, fontSize: 17, color: C.tx },
  sec: { paddingHorizontal: 20, paddingTop: 8 },
  secHd: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 },
  secT: { fontFamily: F.semi, fontSize: 12.5, color: C.tx },
  secN: { flex: 1, fontFamily: F.text, fontSize: 10.5, color: C.tx3 },
  reBtn: { width: 34, height: 30, alignItems: 'center', justifyContent: 'center' },
  eps: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  ep: {
    minWidth: 44, height: 34, paddingHorizontal: 12, borderRadius: 9,
    alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,.07)',
  },
  epOn: { backgroundColor: '#fff' },
  epTx: { fontFamily: F.semi, fontSize: 12, color: C.tx2 },
  pick: {
    flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 11,
    borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: C.line,
  },
  pickN: { width: 16, fontFamily: F.display, fontSize: 13, color: C.tx3 },
  pickT: { fontFamily: F.semi, fontSize: 12.5, color: C.tx },
  pickS: { marginTop: 2, fontFamily: F.text, fontSize: 10.5, color: C.tx3 },
  pickQ: { fontFamily: F.semi, fontSize: 11, color: C.tx3 },
});
