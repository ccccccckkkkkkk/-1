/* 全屏播放器：react-native-video（Android 走 ExoPlayer，原生支持 HLS）。
   比 Web 版少很多胶水 —— 不需要 hls.js、不用自绘全屏旋转，
   保留的是：多线路兜底切换、断流检测、续播、倍速、进度拖动、记忆落盘。 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator, Pressable, StatusBar, StyleSheet, Text, View, useWindowDimensions,
} from 'react-native';
import Video from 'react-native-video';
import Icon from '../components/Icon.jsx';
import { C, F } from '../theme.js';
import { fmt, getHist, saveHist } from '../lib/core.js';

const RATES = [1, 1.25, 1.5, 2, 0.75];
const HIDE_AFTER = 2600;

export default function Player({ item, onClose }) {
  const { width: W } = useWindowDimensions();
  const vRef = useRef(null);
  const [routes, setRoutes] = useState([]);
  const [ri, setRi] = useState(0);
  const riRef = useRef(0);
  const [paused, setPaused] = useState(false);
  const [muted, setMuted] = useState(false);
  const [rate, setRate] = useState(1);
  const [dur, setDur] = useState(0);
  const [pos, setPos] = useState(0);
  const [buf, setBuf] = useState(0);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');
  const [hideUI, setHideUI] = useState(false);
  const [tip, setTip] = useState('');
  const dragRef = useRef({ on: false, p: 0 });
  const seekW = useRef(0);
  const autoRef = useRef(0);
  const uiT = useRef(null);
  const seekT = useRef(null);
  const startedRef = useRef(false);
  const durRef = useRef(0);
  const posRef = useRef(0);
  const commitHistRef = useRef(null);

  /* 线路表：优先用详情页探好的完整列表，单条时自己造一条 */
  useEffect(() => {
    const rs = (item && item.srcList && item.srcList.length)
      ? item.srcList.slice()
      : [{ u: item && (item.u || item.src), tag: (item && item.srcTag) || '线路', t: 'hls' }];
    const ordered = rs.filter(r => r && r.u);
    setRoutes(ordered);
    const at = Math.max(0, ordered.findIndex(r => r === item || (item && r.u === item.u)));
    setRi(at);
    riRef.current = at;
    autoRef.current = 0;
    startedRef.current = false;
    setErr(''); setLoading(true); setPos(0); setDur(0);
  }, [item]);

  const showUI = useCallback(() => {
    setHideUI(false);
    clearTimeout(uiT.current);
    uiT.current = setTimeout(() => setHideUI(true), HIDE_AFTER);
  }, []);

  useEffect(() => {
    if (!item) return undefined;
    showUI();
    return () => {
      clearTimeout(uiT.current); clearTimeout(seekT.current);
      commitHistRef.current && commitHistRef.current();   // 卸载前补记一次进度
    };
  }, [item, showUI]);

  const nextRoute = useCallback(reason => {
    const ok = routes;
    const at = riRef.current;
    for (let i = at + 1; i < ok.length; i++) {
      if (ok[i] && ok[i].ok !== false) {
        const nx = i;
        riRef.current = nx;
        setRi(nx);
        setErr(''); setLoading(true);
        return true;
      }
    }
    if (reason === 'auto' && autoRef.current < 2) {
      autoRef.current++;
      riRef.current = 0; setRi(0); setErr(''); setLoading(true);
      return true;
    }
    setErr('线路不可用，返回后换一条线路试试');
    return false;
  }, [routes]);

  const cur = routes[ri] || null;
  const src = cur ? cur.u : '';

  /* 一条可用线路都没有：别一直转圈，给个能返回的提示 */
  useEffect(() => {
    if (routes.length) return undefined;
    const t = setTimeout(() => {
      setLoading(false);
      setErr('这条线路没有可用地址，返回后换一条试试');
    }, 1200);
    return () => clearTimeout(t);
  }, [routes.length]);

  const onLoad = d => {
    setLoading(false);
    setDur(d.duration || 0);
    durRef.current = d.duration || 0;
    const v = vRef.current;
    const h = item && item.id ? getHist()[item.id] : null;
    const resume = item
      ? (item.resumeAt != null ? item.resumeAt : (h ? (h.t || 0) : 0))
      : 0;
    const want = resume > 8 ? resume : 0;
    if (want && v && Math.abs((d.duration || 0) - want) > 900) { /* 时长对不上就不跳 */ }
    else if (want && v) { v.seek(want); }
    startedRef.current = true;
  };

  const commitHist = useCallback(() => {
    if (!item || !item.id) return;
    const d = durRef.current || 0;
    const t = posRef.current || 0;
    saveHist(item.id, d > 0 ? t / d : 0, t, {
      title: item.title, poster: item.poster, year: item.year,
    });
  }, [item]);

  commitHistRef.current = commitHist;
  const close = () => { commitHist(); onClose(); };

  const seekToX = (x, silent) => {
    const bw = seekW.current || W;
    const d = durRef.current || dur;
    if (!d || !bw) return;
    const p = Math.max(0, Math.min(1, x / bw));
    dragRef.current.p = p;
    posRef.current = p * d;
    setPos(p * d);
    setTip(fmt(p * d));
    if (vRef.current) vRef.current.seek(p * d);
    if (!silent) {
      clearTimeout(seekT.current);
      seekT.current = setTimeout(() => setTip(''), 700);
    }
  };

  if (!item) return null;
  const pct = dur ? Math.min(1, pos / dur) : 0;
  const bufPct = dur ? Math.min(1, buf / dur) : 0;

  return (
    <View style={st.wrap}>
      {src ? (
        <Video
          ref={vRef}
          source={{ uri: src }}
          style={StyleSheet.absoluteFill}
          resizeMode="contain"
          paused={paused}
          muted={muted}
          rate={rate}
          repeat={false}
          progressUpdateInterval={400}
          playInBackground={false}
          onLoad={onLoad}
          onProgress={d => {
            posRef.current = d.currentTime || 0;
            setPos(d.currentTime || 0);
            if (d.playableDuration) setBuf(d.playableDuration);
          }}
          onEnd={() => {
            if (item && item.id) saveHist(item.id, 1, 0, { title: item.title, poster: item.poster, year: item.year });
            close();
          }}
          onError={e => {
            const msg = String((e && e.error && (e.error.errorString || e.error.localizedDescription)) || '');
            if (__DEV__) console.warn('[player]', msg);
            nextRoute('auto');
          }}
        />
      ) : null}

      {loading ? (
        <View style={st.loadWrap} pointerEvents="none">
          <ActivityIndicator color={C.accent} size="large" />
        </View>
      ) : null}

      <Pressable
        style={StyleSheet.absoluteFill}
        onPress={() => { if (hideUI) showUI(); else { clearTimeout(uiT.current); setHideUI(true); } }}
      />

      {!hideUI ? (
        <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
          <View style={st.top}>
            <Pressable onPress={close} hitSlop={12} style={st.icon}>
              <Icon name="i-back" size={22} />
            </Pressable>
            <Text style={st.title} numberOfLines={1}>{(item && item.title) || ''}</Text>
            <View style={st.route}>
              <Icon name="i-signal" size={12} color={C.tx3} />
              <Text style={st.routeTx}>
                {cur && cur.ms ? cur.ms + ' ms' : (cur && cur.tag) || '线路'}
              </Text>
            </View>
          </View>

          <View style={st.center} pointerEvents="box-none">
            <Pressable onPress={() => { setPaused(p => !p); showUI(); }} style={st.big}>
              <Icon name={paused ? 'i-play' : 'i-pause'} size={30} color="#fff" />
            </Pressable>
          </View>

          <View style={st.bottom}>
            {tip ? <Text style={st.tip}>{tip}</Text> : null}
            {/* 进度条自己当 responder：Pressable 会被内部 Pressability 接管，
                onTouchMove 根本收不到，拖动会断在第一下 */}
            <View
              style={st.seek}
              onLayout={e => { seekW.current = e.nativeEvent.layout.width; }}
              onStartShouldSetResponder={() => true}
              onMoveShouldSetResponder={() => true}
              onResponderTerminationRequest={() => false}
              onResponderGrant={e => {
                dragRef.current.on = true;
                seekToX(e.nativeEvent.locationX, true);
                showUI();
              }}
              onResponderMove={e => {
                if (dragRef.current.on) seekToX(e.nativeEvent.locationX, true);
              }}
              onResponderRelease={() => {
                dragRef.current.on = false;
                clearTimeout(seekT.current);
                seekT.current = setTimeout(() => setTip(''), 500);
              }}
              onResponderTerminate={() => { dragRef.current.on = false; setTip(''); }}
            >
              <View style={st.track}>
                <View style={[st.buf, { width: (bufPct * 100).toFixed(1) + '%' }]} />
                <View style={[st.fill, { width: (pct * 100).toFixed(1) + '%' }]} />
              </View>
              <View style={[st.knob, { left: (pct * 100).toFixed(1) + '%' }]} />
            </View>

            <View style={st.ctrl}>
              <Pressable onPress={() => { setPaused(p => !p); showUI(); }} style={st.ibtn}>
                <Icon name={paused ? 'i-play' : 'i-pause'} size={19} />
              </Pressable>
              <Pressable
                onPress={() => { const v = vRef.current; const t = Math.max(0, pos - 10); if (v) v.seek(t); setPos(t); showUI(); }}
                style={st.ibtn}
              >
                <Icon name="i-back10" size={19} />
              </Pressable>
              <Pressable
                onPress={() => { const v = vRef.current; const t = Math.min(dur || pos + 10, pos + 10); if (v) v.seek(t); setPos(t); showUI(); }}
                style={st.ibtn}
              >
                <Icon name="i-forward" size={19} />
              </Pressable>
              <Text style={st.time}>{fmt(pos)} / {fmt(dur)}</Text>
              <View style={{ flex: 1 }} />
              <Pressable
                onPress={() => { const i = RATES.indexOf(rate); setRate(RATES[(i + 1) % RATES.length]); showUI(); }}
                style={st.rateBtn}
              >
                <Text style={st.rateTx}>{rate.toFixed(rate === Math.round(rate) ? 1 : 2).replace(/0$/, '')}×</Text>
              </Pressable>
              <Pressable onPress={() => { setMuted(m => !m); showUI(); }} style={st.ibtn}>
                <Icon name={muted ? 'i-mute' : 'i-volume'} size={19} />
              </Pressable>
            </View>
          </View>
        </View>
      ) : null}

      {err ? (
        <Pressable style={st.err} onPress={() => setErr('')}>
          <Text style={st.errTx}>{err}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const st = StyleSheet.create({
  wrap: { ...StyleSheet.absoluteFillObject, backgroundColor: '#000' },
  loadWrap: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center' },
  top: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingHorizontal: 12, paddingTop: 14 + (StatusBar.currentHeight || 0), paddingBottom: 14,
  },
  icon: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  title: { flex: 1, fontFamily: F.semi, fontSize: 13, color: '#fff' },
  route: {
    flexDirection: 'row', alignItems: 'center', gap: 5, height: 26,
    paddingHorizontal: 9, borderRadius: 7, backgroundColor: 'rgba(255,255,255,.10)',
  },
  routeTx: { fontFamily: F.semi, fontSize: 10.5, color: C.tx2 },
  center: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center' },
  big: {
    width: 66, height: 66, borderRadius: 33, alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,.42)',
  },
  bottom: { position: 'absolute', left: 0, right: 0, bottom: 0, paddingHorizontal: 14, paddingBottom: 18 },
  tip: {
    alignSelf: 'center', marginBottom: 8, paddingHorizontal: 10, paddingVertical: 4,
    borderRadius: 7, backgroundColor: 'rgba(0,0,0,.7)', color: '#fff',
    fontFamily: F.semi, fontSize: 11,
  },
  seek: { height: 30, justifyContent: 'center' },
  track: { height: 4, borderRadius: 2, backgroundColor: 'rgba(255,255,255,.2)', overflow: 'hidden' },
  buf: { position: 'absolute', left: 0, top: 0, bottom: 0, backgroundColor: 'rgba(255,255,255,.30)' },
  fill: { position: 'absolute', left: 0, top: 0, bottom: 0, backgroundColor: C.accent },
  knob: {
    position: 'absolute', width: 12, height: 12, borderRadius: 6, marginLeft: -6,
    backgroundColor: '#fff', top: 9,
  },
  ctrl: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 6 },
  ibtn: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  time: { fontFamily: F.text, fontSize: 11, color: C.tx2, marginLeft: 4 },
  rateBtn: {
    height: 26, minWidth: 40, paddingHorizontal: 8, borderRadius: 7,
    alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,.10)',
  },
  rateTx: { fontFamily: F.semi, fontSize: 11, color: '#fff' },
  err: {
    position: 'absolute', left: 20, right: 20, bottom: 120, padding: 14,
    borderRadius: 12, backgroundColor: 'rgba(225,29,72,.92)',
  },
  errTx: { fontFamily: F.semi, fontSize: 12.5, color: '#fff', textAlign: 'center' },
});
