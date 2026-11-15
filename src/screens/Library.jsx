/* 片库：分类 chips + 三列网格 + 触底翻页。 */
import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, StatusBar, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import Card, { SkCard } from '../components/Card.jsx';
import Icon from '../components/Icon.jsx';
import { C, F } from '../theme.js';
import { CATS, api, norm } from '../lib/core.js';

const COLS = 3, PAD = 20, GAP = 12;

export default function Library({ cat, onCat, onOpen }) {
  const { width } = useWindowDimensions();
  const [items, setItems] = useState([]);
  const [page, setPage] = useState(1);
  const [more, setMore] = useState(true);
  const [busy, setBusy] = useState(false);
  const [firstDone, setFirstDone] = useState(false);
  const [err, setErr] = useState('');
  const cache = useRef(new Map());

  const cur = cat || '1';
  const cardW = (width - PAD * 2 - GAP * (COLS - 1)) / COLS;

  useEffect(() => {
    let dead = false;
    setFirstDone(false); setItems([]); setPage(1); setMore(true); setErr('');
    const hit = cache.current.get(cur + ':1');
    if (hit) {
      setItems(hit.items); setMore(hit.more); setFirstDone(true);
      return () => { dead = true; };
    }
    setBusy(true);
    api.list(cur, 1).then(d => {
      if (dead) return;
      const list = (d.items || []).map(norm);
      const has = !!d.more;
      cache.current.set(cur + ':1', { items: list, more: has });
      setItems(list); setMore(has); setFirstDone(true);
    }).catch(e => { if (!dead) { setErr(e.message || '加载失败'); setFirstDone(true); } })
      .finally(() => { if (!dead) setBusy(false); });
    return () => { dead = true; };
  }, [cur]);

  const loadMore = () => {
    if (busy || !more || !firstDone) return;
    const next = page + 1;
    const key = cur + ':' + next;
    const hit = cache.current.get(key);
    if (hit) { setItems(v => v.concat(hit.items)); setPage(next); setMore(hit.more); return; }
    setBusy(true);
    api.list(cur, next).then(d => {
      const list = (d.items || []).map(norm);
      const has = !!d.more;
      cache.current.set(key, { items: list, more: has });
      setItems(v => v.concat(list)); setPage(next); setMore(has);
    }).catch(() => {}).finally(() => setBusy(false));
  };

  const loading = !firstDone && !items.length;

  return (
    <View style={{ flex: 1, paddingTop: 56 + (StatusBar.currentHeight || 0) }}>
      <View style={st.head}>
        <Text style={st.k}>LIBRARY</Text>
        <Text style={st.t}>片库</Text>
      </View>
      <View style={st.chips}>
        {CATS.map(c => {
          const on = String(c.id) === String(cur);
          return (
            <Pressable key={c.id} style={[st.chip, on && st.chipOn]} onPress={() => onCat(c.id, c.name)}>
              <Text style={[st.chipTx, on && st.chipTxOn]}>{c.name}</Text>
            </Pressable>
          );
        })}
      </View>

      <FlatList
        style={{ flex: 1 }}
        data={loading ? Array.from({ length: 12 }).map((_, i) => ({ __sk: i })) : items}
        keyExtractor={(it, i) => (it.id || 'sk' + i) + ':' + i}
        numColumns={COLS}
        columnWrapperStyle={{ gap: GAP, paddingHorizontal: PAD }}
        contentContainerStyle={{ gap: 16, paddingTop: 16, paddingBottom: 140 }}
        renderItem={({ item }) => item.__sk != null
          ? <View style={{ width: cardW }}><SkCard /></View>
          : <Card s={item} width={cardW} onClick={onOpen} />}
        onEndReached={loadMore}
        onEndReachedThreshold={0.6}
        ListFooterComponent={busy && items.length ? <ActivityIndicator style={{ marginVertical: 18 }} color={C.tx3} /> : null}
        ListEmptyComponent={firstDone ? (
          <View style={st.empty}>
            <Icon name={err ? 'i-signal' : 'i-search'} size={36} color={C.tx3} />
            <Text style={st.emptyT}>{err ? '加载失败' : '暂无内容'}</Text>
            <Text style={st.emptyP}>{err || '这个分类暂时没有影片'}</Text>
            {err ? (
              <Pressable style={st.retry} onPress={() => { setErr(''); setFirstDone(false); onCat(cur, null); }}>
                <Text style={st.retryTx}>重试</Text>
              </Pressable>
            ) : null}
          </View>
        ) : null}
      />
    </View>
  );
}

const st = StyleSheet.create({
  head: { paddingHorizontal: 20, paddingTop: 6 },
  k: { fontFamily: F.bold, fontSize: 10.5, letterSpacing: 2.2, color: C.accent },
  t: { marginTop: 3, fontFamily: F.display, fontSize: 26, color: C.tx },
  chips: { flexDirection: 'row', gap: 8, paddingHorizontal: 20, paddingTop: 14 },
  chip: {
    height: 32, paddingHorizontal: 14, borderRadius: 999, justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,.07)',
  },
  chipOn: { backgroundColor: '#fff' },
  chipTx: { fontFamily: F.semi, fontSize: 12, color: C.tx2 },
  chipTxOn: { color: '#000' },
  empty: { paddingTop: 80, alignItems: 'center', gap: 8 },
  emptyT: { fontFamily: F.semi, fontSize: 15, color: C.tx },
  emptyP: { fontFamily: F.text, fontSize: 12, color: C.tx3 },
  retry: {
    marginTop: 12, height: 38, paddingHorizontal: 22, borderRadius: 10,
    justifyContent: 'center', backgroundColor: '#fff',
  },
  retryTx: { fontFamily: F.bold, fontSize: 13, color: '#0B0B0F' },
});
