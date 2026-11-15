/* 首屏大图轮播：7 秒一片，点海报进详情，三个动作键（立即播放 / 收藏 / 详情）。
   背景用海报本身 + 一层暗角，避免纯黑断层。 */
import React, { useEffect, useRef, useState } from 'react';
import { Animated, Image, Pressable, StatusBar, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import LinearGradient from './Gradient.jsx';
import Icon from './Icon.jsx';
import { C, F, R } from '../theme.js';
import { ph, showName, toggleFav, useFav, favHas } from '../lib/core.js';

export default function Hero({ items, onOpen, onPlay }) {
  const { width, height } = useWindowDimensions();
  const [hi, setHi] = useState(0);
  const fade = useRef(new Animated.Value(1)).current;
  const heroRef = useRef(null);
  useFav();

  const cur = items[hi] || null;

  useEffect(() => {
    if (!items || items.length < 2) return undefined;
    const t = setInterval(() => setHi(h => (h + 1) % items.length), 7000);
    return () => clearInterval(t);
  }, [items]);

  useEffect(() => {
    fade.setValue(0.35);
    Animated.timing(fade, { toValue: 1, duration: 500, useNativeDriver: true }).start();
  }, [hi, fade]);

  const heroH = Math.max(420, Math.min(Math.round(height * 0.78), 620));
  if (!cur) return <View style={[st.hero, { height: heroH }]} />;

  const tone = ph(cur);
  const meta = [cur.year, cur.region, ...(cur.tags || cur.genres || []).slice(0, 2)].filter(Boolean);
  const faved = favHas(cur.id);

  const openFrom = autoPlay => {
    const n = heroRef.current;
    const go = from => onOpen(cur, from, autoPlay);
    if (!n || !n.measureInWindow) return go(null);
    n.measureInWindow((x, y, w, h) => go(w > 0 ? { l: x, t: y, w, h, r: R.card } : null));
  };

  return (
    <View style={[st.hero, { height: heroH }]} ref={heroRef} collapsable={false}>
      <Animated.View style={[StyleSheet.absoluteFill, { opacity: fade }]}>
        <LinearGradient colors={tone} style={StyleSheet.absoluteFill} />
        {cur.poster ? (
          <Image source={{ uri: cur.poster }} style={st.bg} resizeMode="cover" fadeDuration={220} />
        ) : null}
        <View style={st.wash} />
      </Animated.View>

      <View style={st.dots}>
        {items.map((_, i) => (
          <Pressable key={i} onPress={() => setHi(i)} hitSlop={6} style={st.dotHit}>
            <View style={[st.dot, i === hi && st.dotOn]} />
          </Pressable>
        ))}
      </View>

      <View style={st.body}>
        <View style={st.kick}>
          <View style={[st.kchip, st.kchipRed]}><Text style={st.kchipTx}>热播</Text></View>
          {Number(cur.rating) > 0 ? (
            <View style={[st.kchip, st.kchipGold]}>
              <Icon name="i-star" size={11} color={C.gold} />
              <Text style={[st.kchipTx, { color: C.gold }]}>{Number(cur.rating).toFixed(1)}</Text>
            </View>
          ) : null}
          {cur.note ? (
            <View style={[st.kchip, st.kchipGhost]}><Text style={st.kchipTx}>{cur.note}</Text></View>
          ) : null}
        </View>

        <Text style={st.title} numberOfLines={2}>{showName(cur)}</Text>
        {meta.length ? <Text style={st.meta}>{meta.join('  ·  ')}</Text> : null}
        {cur.summary ? <Text style={st.sum} numberOfLines={2}>{cur.summary}</Text> : null}

        <View style={st.acts}>
          <Pressable style={st.play} onPress={() => openFrom(true)}>
            <Icon name="i-play" size={16} color="#0B0B0F" />
            <Text style={st.playTx}>立即播放</Text>
          </Pressable>
          <Pressable style={st.ghost} onPress={() => toggleFav(cur)}>
            <Icon name={faved ? 'i-check' : 'i-plus'} size={15} color={C.tx} />
            <Text style={st.ghostTx}>{faved ? '已收藏' : '收藏'}</Text>
          </Pressable>
          <Pressable style={st.ghost} onPress={() => openFrom(false)}>
            <Icon name="i-info" size={15} color={C.tx} />
            <Text style={st.ghostTx}>详情</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

const st = StyleSheet.create({
  hero: { position: 'relative', overflow: 'hidden', justifyContent: 'flex-end', paddingTop: 56 + (StatusBar.currentHeight || 0) },
  bg: { ...StyleSheet.absoluteFillObject, width: '100%', height: '100%' },
  wash: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(6,6,10,.42)' },
  dots: { position: 'absolute', top: 56 + (StatusBar.currentHeight || 0), right: 14, flexDirection: 'row', gap: 2 },
  dotHit: { width: 24, height: 24, alignItems: 'center', justifyContent: 'center' },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: 'rgba(255,255,255,.32)' },
  dotOn: { backgroundColor: C.accent, width: 16 },
  body: { paddingHorizontal: 20, paddingBottom: 22 },
  kick: { flexDirection: 'row', gap: 6, marginBottom: 10 },
  kchip: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    height: 22, paddingHorizontal: 8, borderRadius: 6,
  },
  kchipRed: { backgroundColor: C.accent },
  kchipGold: { backgroundColor: 'rgba(232,180,74,.16)', borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(232,180,74,.4)' },
  kchipGhost: { backgroundColor: 'rgba(255,255,255,.10)' },
  kchipTx: { fontFamily: F.semi, fontSize: 10.5, color: '#fff' },
  title: {
    fontFamily: F.display, fontSize: 40, lineHeight: 44, letterSpacing: .4, color: '#fff',
  },
  meta: { marginTop: 8, fontFamily: F.text, fontSize: 11.5, color: 'rgba(255,255,255,.62)' },
  sum: { marginTop: 8, fontFamily: F.text, fontSize: 12, lineHeight: 18, color: 'rgba(255,255,255,.52)' },
  acts: { flexDirection: 'row', gap: 8, marginTop: 16 },
  play: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    height: 42, paddingHorizontal: 18, borderRadius: R.btn, backgroundColor: '#fff',
  },
  playTx: { fontFamily: F.bold, fontSize: 13, color: '#0B0B0F' },
  ghost: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    height: 42, paddingHorizontal: 13, borderRadius: R.btn,
    backgroundColor: 'rgba(255,255,255,.10)',
  },
  ghostTx: { fontFamily: F.semi, fontSize: 12, color: C.tx },
});
