/* 横向轨道：标题 + 右侧「全部」+ 可横滑的卡片列表。 */
import React from 'react';
import { ScrollView, StyleSheet, Text, Pressable, View } from 'react-native';
import Card, { SkCard } from './Card.jsx';
import { C, F } from '../theme.js';

const CARD_W = 118;

export default function Rail({ title, items, wide, ranked, more = true, onMore, onOpen, subOf }) {
  return (
    <View style={st.wrap}>
      <View style={st.head}>
        <View style={st.titleWrap}>
          <View style={st.bar} />
          <Text style={st.title}>{title}</Text>
        </View>
        {more ? (
          <Pressable onPress={onMore} hitSlop={10} style={st.more}>
            <Text style={st.moreTx}>全部</Text>
          </Pressable>
        ) : null}
      </View>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={st.track}
        decelerationRate="fast"
        snapToInterval={CARD_W + 12}
        snapToAlignment="start"
      >
        {items.map((s, i) => (
          <Card
            key={(s.id || i) + ':' + i}
            s={s}
            width={wide ? CARD_W * 1.6 : CARD_W}
            wide={wide}
            rank={ranked ? i + 1 : 0}
            sub={subOf ? subOf(s) : undefined}
            onClick={onOpen}
          />
        ))}
      </ScrollView>
    </View>
  );
}

export function SkeletonRail({ n = 6 }) {
  return (
    <View style={st.wrap}>
      <View style={st.head}>
        <View style={[st.skTitle, { backgroundColor: C.card2, borderRadius: 5 }]} />
      </View>
      <View style={[st.track, { flexDirection: 'row' }]}>
        {Array.from({ length: n }).map((_, i) => (
          <View key={i} style={{ width: CARD_W, marginRight: 12 }}>
            <SkCard />
          </View>
        ))}
      </View>
    </View>
  );
}

const st = StyleSheet.create({
  wrap: { marginTop: 26 },
  head: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingBottom: 12,
  },
  titleWrap: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  title: { fontFamily: F.display, fontSize: 21, color: C.tx, letterSpacing: .3 },
  bar: { width: 3, height: 15, borderRadius: 2, backgroundColor: C.accent },
  more: { paddingVertical: 8, paddingHorizontal: 4 },
  moreTx: { fontFamily: F.semi, fontSize: 11.5, color: C.tx3 },
  track: { gap: 12, paddingHorizontal: 20, paddingTop: 2, paddingBottom: 6 },
  skTitle: { width: 108, height: 18 },
});
