/* 首页：大图轮播 + 分类 chips + 继续观看 + 各分区轨道 + 分类卡网格。 */
import React from 'react';
import { Pressable, StatusBar, StyleSheet, Text, View } from 'react-native';
import Hero from '../components/Hero.jsx';
import Rail, { SkeletonRail } from '../components/Rail.jsx';
import Icon from '../components/Icon.jsx';
import { C, F } from '../theme.js';
import { CATS, metaLine, norm, useHist } from '../lib/core.js';

export default function Home({ data, loading, err, onRetry, onOpen, onPlay, onCat, onAll, onTop }) {
  const hist = useHist();
  const hero = (data.hero || []).map(norm).filter(x => x.title).slice(0, 6);
  const secs = (data.sections || []).filter(s => s.items && s.items.length >= 3);

  const cont = Object.entries(hist || {})
    .filter(([, h]) => h && h.p > 0.01 && h.p < 0.96 && h.title)
    .sort((a, b) => b[1].d - a[1].d)
    .slice(0, 12)
    .map(([id, h]) => norm({ id, title: h.title, poster: h.poster, year: h.year }));

  if (loading && !hero.length) {
    return (
      <View style={{ paddingTop: 56 + (StatusBar.currentHeight || 0) }}>
        <View style={{ height: 420, backgroundColor: C.card }} />
        <SkeletonRail />
        <SkeletonRail />
      </View>
    );
  }

  if (err && !hero.length) {
    return (
      <View style={st.empty}>
        <Icon name="i-signal" size={38} color={C.tx3} />
        <Text style={st.emptyT}>片源加载失败</Text>
        <Text style={st.emptyP}>{String(err)}</Text>
        <Pressable style={st.retry} onPress={onRetry}><Text style={st.retryTx}>重试</Text></Pressable>
      </View>
    );
  }

  return (
    <View style={{ paddingBottom: 120 }}>
      <Hero items={hero} onOpen={onOpen} onPlay={onPlay} />

      <View style={st.chips}>
        <Pressable style={[st.chip, st.chipOn]} onPress={onTop}>
          <Text style={[st.chipTx, st.chipTxOn]}>全部</Text>
        </Pressable>
        {CATS.map(c => (
          <Pressable key={c.id} style={st.chip} onPress={() => onCat(c.id, c.name)}>
            <Text style={st.chipTx}>{c.name}</Text>
          </Pressable>
        ))}
      </View>

      {cont.length ? (
        <Rail title="继续观看" items={cont} subOf={s => {
          const h = hist[s.id];
          return h ? '已看 ' + Math.round((h.p || 0) * 100) + '%' : metaLine(s);
        }} onOpen={onOpen} more={false} />
      ) : null}

      {secs.map((sec, i) => (
        <Rail
          key={(sec.name || '') + ':' + i}
          title={sec.name}
          items={(sec.items || []).map(norm)}
          onOpen={onOpen}
          onMore={onAll ? () => onAll(sec.name, (sec.items || []).map(norm)) : undefined}
        />
      ))}

      {secs.length ? (
        <View style={st.catgrid}>
          {CATS.map(c => (
            <Pressable key={c.id} style={st.catcard} onPress={() => onCat(c.id, c.name)}>
              <Text style={st.catK}>{c.kick}</Text>
              <Text style={st.catN}>{c.name}</Text>
            </Pressable>
          ))}
        </View>
      ) : null}
    </View>
  );
}

const st = StyleSheet.create({
  chips: { flexDirection: 'row', gap: 8, paddingHorizontal: 20, paddingTop: 18 },
  chip: {
    height: 32, paddingHorizontal: 14, borderRadius: 999, justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,.07)',
  },
  chipOn: { backgroundColor: '#fff' },
  chipTx: { fontFamily: F.semi, fontSize: 12, color: C.tx2 },
  chipTxOn: { color: '#000' },
  catgrid: {
    flexDirection: 'row', flexWrap: 'wrap', gap: 12,
    paddingHorizontal: 20, paddingTop: 26,
  },
  catcard: {
    flexGrow: 1, flexBasis: '46%', minHeight: 74, justifyContent: 'center',
    paddingHorizontal: 16, borderRadius: 16,
    backgroundColor: C.card, borderWidth: StyleSheet.hairlineWidth, borderColor: C.line,
  },
  catK: { fontFamily: F.bold, fontSize: 9, letterSpacing: 1.8, color: C.accent },
  catN: { marginTop: 4, fontFamily: F.display, fontSize: 20, color: C.tx },
  empty: { paddingTop: 140, alignItems: 'center', gap: 8 },
  emptyT: { marginTop: 6, fontFamily: F.semi, fontSize: 15, color: C.tx },
  emptyP: { fontFamily: F.text, fontSize: 12, color: C.tx3, textAlign: 'center', paddingHorizontal: 40 },
  retry: {
    marginTop: 12, height: 38, paddingHorizontal: 22, borderRadius: 10,
    justifyContent: 'center', backgroundColor: '#fff',
  },
  retryTx: { fontFamily: F.bold, fontSize: 13, color: '#0B0B0F' },
});
