/* 卡片：与 Web 版同构（海报 + 占位渐变 + 角标 + 进度条 + 名次），用 RN 的 Image/Pressable 重画。
   点击时把卡片在屏幕上的矩形抛出去，详情页拿它当展开起点。 */
import React, { useRef, useState } from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import LinearGradient from './Gradient.jsx';
import Icon from './Icon.jsx';
import { C, F, R } from '../theme.js';
import { metaLine, ph, showName } from '../lib/core.js';

export default function Card({ s, rank, wide, badge, sub, progress = 0, onClick, width }) {
  const artRef = useRef(null);
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);
  const [box, setBox] = useState(null);

  const tone = ph(s);
  const label = badge || s.note;
  const line = sub || metaLine(s);

  const measure = () => {
    const n = artRef.current;
    if (!n || !n.measureInWindow) { onClick && onClick(s, box); return; }
    n.measureInWindow((x, y, w, h) => {
      const from = w > 0 ? { l: x, t: y, w, h, r: R.card } : null;
      setBox(from);
      onClick && onClick(s, from);
    });
  };

  return (
    <Pressable
      style={[st.wrap, width ? { width } : null]}
      onPress={measure}
      android_ripple={{ color: 'rgba(255,255,255,.08)', borderless: false }}
    >
      <View ref={artRef} collapsable={false}
        style={[st.art, wide && st.artWide, { backgroundColor: tone[0] }]}>
        <LinearGradient colors={tone} style={StyleSheet.absoluteFill} />
        {s.poster && !failed ? (
          <Image
            source={{ uri: s.poster }}
            style={st.img}
            resizeMode="cover"
            onLoad={() => setLoaded(true)}
            onError={() => { setFailed(true); setLoaded(false); }}
            fadeDuration={180}
          />
        ) : null}
        {!loaded ? (
          <View style={st.ph} pointerEvents="none">
            <Icon name="i-mark" size={26} color="rgba(255,255,255,.20)" />
            <Text style={st.phName}>NEON<Text style={{ color: C.accent }}>FLICK</Text></Text>
          </View>
        ) : null}
        {label ? (
          <View style={st.badge}><Text style={st.badgeTx} numberOfLines={1}>{label}</Text></View>
        ) : null}
        {progress > 0.02 && progress < 0.97 ? (
          <View style={st.prog}><View style={[st.progIn, { width: (progress * 100).toFixed(1) + '%' }]} /></View>
        ) : null}
        {rank ? <Text style={st.rank}>{rank}</Text> : null}
      </View>
      <Text style={st.name} numberOfLines={2}>{showName(s)}</Text>
      {line ? <Text style={st.sub} numberOfLines={1}>{line}</Text> : null}
    </Pressable>
  );
}

export function SkCard({ width }) {
  return (
    <View style={[st.wrap, width ? { width } : null]}>
      <View style={[st.art, st.sk]} />
      <View style={[st.sk, { height: 10, borderRadius: 5, marginTop: 8, width: '82%' }]} />
      <View style={[st.sk, { height: 8, borderRadius: 4, marginTop: 6, width: '56%' }]} />
    </View>
  );
}

const st = StyleSheet.create({
  wrap: { flex: 1 },
  art: {
    width: '100%', aspectRatio: 2 / 3, borderRadius: R.card,
    overflow: 'hidden', backgroundColor: C.card,
  },
  artWide: { aspectRatio: 16 / 9 },
  img: { ...StyleSheet.absoluteFillObject, width: '100%', height: '100%' },
  ph: {
    ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center', gap: 6,
  },
  phName: {
    fontFamily: F.display, fontSize: 10, letterSpacing: 1.4,
    color: 'rgba(255,255,255,.30)',
  },
  badge: {
    position: 'absolute', top: 6, left: 6, maxWidth: '80%',
    paddingHorizontal: 6, paddingVertical: 2, borderRadius: 5,
    backgroundColor: 'rgba(0,0,0,.62)',
  },
  badgeTx: { fontFamily: F.semi, fontSize: 9, color: '#fff' },
  prog: {
    position: 'absolute', left: 0, right: 0, bottom: 0, height: 3,
    backgroundColor: 'rgba(255,255,255,.22)',
  },
  progIn: { height: 3, backgroundColor: C.accent },
  rank: {
    position: 'absolute', top: 4, right: 6, fontFamily: F.display, fontSize: 18,
    color: 'rgba(255,255,255,.9)', textShadowColor: 'rgba(0,0,0,.5)', textShadowRadius: 4,
  },
  name: { marginTop: 7, fontFamily: F.semi, fontSize: 12, lineHeight: 16, color: C.tx },
  sub: { marginTop: 2, fontFamily: F.text, fontSize: 10, color: C.tx3 },
  sk: { backgroundColor: C.card2, borderRadius: R.card },
});
