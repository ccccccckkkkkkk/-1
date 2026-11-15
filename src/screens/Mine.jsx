/* 我的：收藏网格 + 观看记录列表（可逐条删除）。 */
import React from 'react';
import { Image, Pressable, ScrollView, StatusBar, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import Card from '../components/Card.jsx';
import Icon from '../components/Icon.jsx';
import { C, F } from '../theme.js';
import { dropHist, norm, useFav, useHist } from '../lib/core.js';
import { getBase } from '../lib/config.js';

const COLS = 3, PAD = 20, GAP = 12;

export default function Mine({ onOpen, onSettings }) {
  const { width } = useWindowDimensions();
  const fav = useFav();
  const hist = useHist();
  const cardW = (width - PAD * 2 - GAP * (COLS - 1)) / COLS;

  const rec = Object.entries(hist || {})
    .filter(([, h]) => h && h.title)
    .sort((a, b) => (b[1].d || 0) - (a[1].d || 0))
    .slice(0, 20);

  return (
    <ScrollView
      style={{ flex: 1 }}
      contentContainerStyle={{ paddingTop: 56 + (StatusBar.currentHeight || 0), paddingBottom: 140 }}
    >
      <View style={st.head}>
        <Text style={st.k}>LIBRARY</Text>
        <Text style={st.t}>我的片单</Text>
      </View>

      {fav.length ? (
        <View style={st.grid}>
          {fav.map((f, i) => (
            <View key={(f.id || i) + ':' + i} style={{ width: cardW }}>
              <Card s={norm(f)} width={cardW} onClick={onOpen} />
            </View>
          ))}
        </View>
      ) : (
        <View style={st.empty}>
          <Icon name="i-bookmark" size={38} color={C.tx3} />
          <Text style={st.emptyT}>片单是空的</Text>
          <Text style={st.emptyP}>点开任意影片，按「＋」把它放进这里</Text>
        </View>
      )}

      <View style={st.sec}>
        <Pressable style={st.entry} onPress={onSettings}>
          <Icon name="i-signal" size={17} color={C.tx2} />
          <Text style={st.entryT}>片源服务器</Text>
          <Text style={st.entryV} numberOfLines={1}>{getBase()}</Text>
          <Icon name="i-back" size={15} color={C.tx3} />
        </Pressable>
      </View>

      {rec.length ? (
        <>
          <View style={[st.head, { marginTop: 8 }]}>
            <Text style={st.k}>HISTORY</Text>
            <Text style={st.t}>观看记录</Text>
          </View>
          <View style={st.rows}>
            {rec.map(([id, h]) => (
              <Pressable key={id} style={st.row} onPress={() => onOpen(norm({ id, title: h.title, poster: h.poster, year: h.year }), null)}>
                <View style={st.rowArt}>
                  {h.poster ? (
                    <Image source={{ uri: h.poster }} style={st.rowImg} resizeMode="cover" />
                  ) : (
                    <View style={{ flex: 1, backgroundColor: C.card2 }} />
                  )}
                </View>
                <View style={st.rowBody}>
                  <Text style={st.rowT} numberOfLines={1}>{h.title}</Text>
                  <Text style={st.rowM} numberOfLines={1}>
                    {(h.p > 0.01 && h.p < 0.96 ? '已看 ' + Math.round(h.p * 100) + '%' : '未开始')}
                    {' · '}
                    {h.d ? new Date(h.d).toLocaleDateString('zh-CN') : ''}
                  </Text>
                </View>
                <Pressable
                  hitSlop={12}
                  style={st.rowX}
                  onPress={() => dropHist(id)}
                >
                  <Icon name="i-trash" size={17} color={C.tx3} />
                </Pressable>
              </Pressable>
            ))}
          </View>
        </>
      ) : null}
    </ScrollView>
  );
}

const st = StyleSheet.create({
  head: { paddingHorizontal: 20, paddingTop: 6 },
  k: { fontFamily: F.bold, fontSize: 10.5, letterSpacing: 2.2, color: C.accent },
  t: { marginTop: 3, fontFamily: F.display, fontSize: 26, color: C.tx },
  grid: {
    flexDirection: 'row', flexWrap: 'wrap', gap: GAP,
    paddingHorizontal: PAD, paddingTop: 16,
  },
  empty: { paddingTop: 70, paddingBottom: 30, alignItems: 'center', gap: 8 },
  emptyT: { fontFamily: F.semi, fontSize: 15, color: C.tx },
  emptyP: { fontFamily: F.text, fontSize: 12, color: C.tx3 },
  rows: { paddingHorizontal: 20, paddingTop: 12, gap: 8 },
  row: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingVertical: 8, borderRadius: 12,
  },
  rowArt: { width: 54, aspectRatio: 2 / 3, borderRadius: 9, overflow: 'hidden' },
  rowImg: { width: '100%', height: '100%' },
  sec: { paddingHorizontal: 20, paddingTop: 20 },
  entry: {
    flexDirection: 'row', alignItems: 'center', gap: 10, height: 52, paddingHorizontal: 14,
    borderRadius: 14, backgroundColor: C.card,
    borderWidth: StyleSheet.hairlineWidth, borderColor: C.line,
  },
  entryT: { fontFamily: F.semi, fontSize: 12.5, color: C.tx },
  entryV: { flex: 1, textAlign: 'right', fontFamily: F.text, fontSize: 11, color: C.tx3 },
  entryIcon: {},
  rowBody: { flex: 1 },
  rowT: { fontFamily: F.semi, fontSize: 13.5, color: C.tx },
  rowM: { marginTop: 3, fontFamily: F.text, fontSize: 11, color: C.tx3 },
  rowX: { width: 34, height: 34, alignItems: 'center', justifyContent: 'center' },
});
