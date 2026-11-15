/* 悬浮胶囊：三个 tab。长按 360ms 抬起并跟手，松手超过 22px 才切页。
   触摸走 View 的 responder 而不是 Pressable —— Pressable 内部由 Pressability 接管
   responder，父层拿不到 onTouchMove，长按拖动会整段丢失。 */
import React, { useEffect, useRef, useState } from 'react';
import { Animated, Easing, StyleSheet, Text, View } from 'react-native';
import Icon from './Icon.jsx';
import { C, F } from '../theme.js';

const TABS = [
  { id: 'home', name: '首页', icon: 'i-home' },
  { id: 'library', name: '片库', icon: 'i-tv' },
  { id: 'mylist', name: '我的', icon: 'i-bookmark' },
];

const HOLD = 360, SLOP = 9, MOVE = 22, INSET = 6;

export default function Tabbar({ route, onNav }) {
  const idx = Math.max(0, TABS.findIndex(t => t.id === route));
  const [lift, setLift] = useState(-1);
  const [pressed, setPressed] = useState(-1);
  const [barW, setBarW] = useState(0);
  const drag = useRef({ armed: false, x0: 0, y0: 0, down: -1, t: null }).current;
  const slide = useRef(new Animated.Value(idx)).current;
  const offX = useRef(new Animated.Value(0)).current;
  const offY = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(slide, {
      toValue: idx, duration: 300, easing: Easing.bezier(.77, 0, .175, 1), useNativeDriver: true,
    }).start();
  }, [idx, slide]);

  useEffect(() => () => clearTimeout(drag.t), [drag]);

  const tabAt = x => {
    if (!barW) return -1;
    const w = (barW - INSET * 2) / TABS.length;
    const i = Math.floor((x - INSET) / w);
    return Math.max(0, Math.min(TABS.length - 1, i));
  };

  const onGrant = e => {
    const { pageX, pageY, locationX } = e.nativeEvent;
    drag.armed = false;
    drag.x0 = pageX; drag.y0 = pageY;
    drag.down = tabAt(locationX);
    setPressed(drag.down);
    clearTimeout(drag.t);
    drag.t = setTimeout(() => { drag.armed = true; setLift(drag.down); }, HOLD);
  };

  const onMove = e => {
    const { pageX, pageY } = e.nativeEvent;
    if (!drag.armed) {
      if (Math.abs(pageX - drag.x0) > SLOP || Math.abs(pageY - drag.y0) > SLOP) {
        clearTimeout(drag.t); drag.armed = false; setPressed(-1);
      }
      return;
    }
    offX.setValue(Math.max(-12, Math.min(12, pageX - drag.x0)));
    offY.setValue(Math.max(-8, Math.min(8, pageY - drag.y0)));
  };

  const onRelease = e => {
    clearTimeout(drag.t);
    const { pageX, pageY } = e.nativeEvent;
    const rawDx = pageX - drag.x0;
    const rawDy = pageY - drag.y0;
    const wasArmed = drag.armed;
    drag.armed = false;
    const landed = drag.down;
    drag.down = -1;

    Animated.parallel([
      Animated.spring(offX, { toValue: 0, useNativeDriver: true, speed: 24, bounciness: 6 }),
      Animated.spring(offY, { toValue: 0, useNativeDriver: true, speed: 24, bounciness: 6 }),
    ]).start();
    setLift(-1); setPressed(-1);

    if (wasArmed) {
      if (Math.abs(rawDx) > MOVE || Math.abs(rawDy) > MOVE) {
        const step = Math.abs(rawDx) > Math.abs(rawDy) ? (rawDx > 0 ? 1 : -1) : (rawDy > 0 ? 1 : -1);
        const nx = Math.max(0, Math.min(TABS.length - 1, idx + step));
        if (nx !== idx) onNav(TABS[nx].id);
      }
      return;
    }
    // 没长按：当成一次普通点击
    if (landed >= 0 && Math.abs(rawDx) < SLOP && Math.abs(rawDy) < SLOP) onNav(TABS[landed].id);
  };

  return (
    <Animated.View
      style={[st.bar, {
        transform: [
          { translateX: offX },
          { translateY: offY },
          ...(lift >= 0 ? [{ scale: 1.055 }] : []),
        ],
      }]}
      onLayout={e => setBarW(e.nativeEvent.layout.width)}
      onStartShouldSetResponder={() => true}
      onResponderTerminationRequest={() => false}
      onResponderGrant={onGrant}
      onResponderMove={onMove}
      onResponderRelease={onRelease}
      onResponderTerminate={onRelease}
    >
      <Animated.View style={[st.pill, {
        left: INSET + (barW - INSET * 2) / TABS.length,
        transform: [{ translateX: Animated.multiply(slide, (barW - INSET * 2) / TABS.length) }],
      }]} />
      {TABS.map((t, i) => {
        const on = i === idx;
        const up = lift === i;
        return (
          <View
            key={t.id}
            style={[st.tab, pressed === i && st.tabDown, up && st.tabUp]}
            pointerEvents="none"
          >
            <Icon name={t.icon} size={21} color={on ? C.tx : C.tx3} />
            <Text style={[st.name, on && st.nameOn]}>{t.name}</Text>
          </View>
        );
      })}
    </Animated.View>
  );
}

const st = StyleSheet.create({
  bar: {
    position: 'absolute', bottom: 18, alignSelf: 'center',
    flexDirection: 'row', alignItems: 'center',
    width: '86%', maxWidth: 342, height: 64, paddingHorizontal: INSET,
    borderRadius: 999, backgroundColor: C.glass,
    borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(255,255,255,.10)',
    zIndex: 70,
  },
  pill: {
    position: 'absolute', top: INSET, bottom: INSET,
    borderRadius: 999, backgroundColor: 'rgba(255,255,255,.10)',
  },
  tab: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 3 },
  tabDown: { opacity: 0.62 },
  tabUp: { transform: [{ scale: 1.08 }] },
  name: { fontFamily: F.semi, fontSize: 10, color: C.tx3 },
  nameOn: { color: C.tx },
});
