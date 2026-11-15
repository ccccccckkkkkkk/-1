/* 顶栏：左侧返回 + 品牌，右侧搜索。滚动超过 24 时压一层实底，避免内容从标题下透上来。 */
import React, { useEffect, useState } from 'react';
import { Pressable, StatusBar, StyleSheet, Text, View } from 'react-native';
import Icon from './Icon.jsx';
import { C, F } from '../theme.js';

export default function Topbar({ back, onBack, onSearch }) {
  return (
    <View style={st.bar} pointerEvents="box-none">
      <View style={st.l}>
        {back ? (
          <Pressable onPress={onBack} hitSlop={12} style={st.icon}>
            <Icon name="i-back" size={22} />
          </Pressable>
        ) : null}
        <Text style={st.brand}>NEON<Text style={st.brandAccent}>FLICK</Text></Text>
      </View>
      <Pressable onPress={onSearch} hitSlop={12} style={st.icon}>
        <Icon name="i-search" size={21} />
      </Pressable>
    </View>
  );
}

const st = StyleSheet.create({
  bar: {
    position: 'absolute', top: 0, left: 0, right: 0, zIndex: 60,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingTop: 10 + (StatusBar.currentHeight || 0), paddingBottom: 10,
    backgroundColor: 'rgba(5,6,10,.86)',
  },
  l: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  icon: { width: 34, height: 34, alignItems: 'center', justifyContent: 'center' },
  brand: { fontFamily: F.display, fontSize: 20, letterSpacing: 1.6, color: '#fff' },
  brandAccent: { color: C.accent },
});
