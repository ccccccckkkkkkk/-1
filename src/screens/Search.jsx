/* 搜索：300ms 防抖，空态给提示，结果三列。 */
import React, { useEffect, useRef, useState } from 'react';
import {
  FlatList, Pressable, StatusBar, StyleSheet, Text, TextInput, View, useWindowDimensions,
} from 'react-native';
import Card, { SkCard } from '../components/Card.jsx';
import Icon from '../components/Icon.jsx';
import { C, F } from '../theme.js';
import { api, norm } from '../lib/core.js';

const COLS = 3, PAD = 20, GAP = 12;

export default function Search({ onOpen, onClose }) {
  const { width } = useWindowDimensions();
  const [q, setQ] = useState('');
  const [items, setItems] = useState(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const t = useRef(null);
  const cardW = (width - PAD * 2 - GAP * (COLS - 1)) / COLS;

  useEffect(() => {
    clearTimeout(t.current);
    const k = q.trim();
    if (!k) { setItems(null); setErr(''); setBusy(false); return undefined; }
    setBusy(true); setErr('');
    t.current = setTimeout(() => {
      api.search(k).then(d => setItems((d.items || []).map(norm)))
        .catch(e => setErr(e.message || '搜索失败'))
        .finally(() => setBusy(false));
    }, 300);
    return () => clearTimeout(t.current);
  }, [q]);

  return (
    <View style={st.wrap}>
      <View style={st.bar}>
        <Icon name="i-search" size={18} color={C.tx3} />
        <TextInput
          style={st.input}
          value={q}
          onChangeText={setQ}
          placeholder="搜片名、剧名、频道…"
          placeholderTextColor={C.tx3}
          autoFocus
          returnKeyType="search"
          selectionColor={C.accent}
        />
        <Pressable onPress={onClose} hitSlop={12} style={st.x}>
          <Icon name="i-close" size={18} color={C.tx2} />
        </Pressable>
      </View>

      {busy && !items ? (
        <View style={st.grid}>
          {Array.from({ length: 6 }).map((_, i) => (
            <View key={i} style={{ width: cardW }}><SkCard /></View>
          ))}
        </View>
      ) : null}

      {err ? <Text style={st.err}>{err}</Text> : null}

      {!q.trim() ? (
        <View style={st.empty}>
          <Icon name="i-search" size={36} color={C.tx3} />
          <Text style={st.emptyT}>搜点什么</Text>
          <Text style={st.emptyP}>片名、演员、类型都可以</Text>
        </View>
      ) : null}

      {items && items.length ? (
        <>
          <Text style={st.hd}>结果 · {items.length}</Text>
          <FlatList
            style={{ flex: 1 }}
            data={items}
            keyExtractor={(it, i) => (it.id || i) + ':' + i}
            numColumns={COLS}
            columnWrapperStyle={{ gap: GAP, paddingHorizontal: PAD }}
            contentContainerStyle={{ gap: 16, paddingBottom: 140 }}
            keyboardShouldPersistTaps="handled"
            renderItem={({ item }) => (
              <View style={{ width: cardW }}>
                <Card s={item} width={cardW} onClick={onOpen} />
              </View>
            )}
          />
        </>
      ) : null}

      {items && !items.length && q.trim() && !busy ? (
        <View style={st.empty}>
          <Icon name="i-search" size={36} color={C.tx3} />
          <Text style={st.emptyT}>没有找到「{q.trim()}」</Text>
          <Text style={st.emptyP}>换个关键词试试</Text>
        </View>
      ) : null}
    </View>
  );
}

const st = StyleSheet.create({
  wrap: { ...StyleSheet.absoluteFillObject, backgroundColor: C.bg, paddingTop: 46 + (StatusBar.currentHeight || 0) },
  bar: {
    flexDirection: 'row', alignItems: 'center', gap: 10, marginHorizontal: 16,
    height: 46, paddingHorizontal: 12, borderRadius: 12, backgroundColor: C.card,
  },
  input: { flex: 1, fontFamily: F.text, fontSize: 13.5, color: C.tx, padding: 0 },
  x: { width: 30, height: 30, alignItems: 'center', justifyContent: 'center' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: GAP, paddingHorizontal: PAD, paddingTop: 18 },
  hd: { paddingHorizontal: 20, paddingTop: 18, paddingBottom: 4, fontFamily: F.semi, fontSize: 12, color: C.tx3 },
  err: { paddingHorizontal: 20, paddingTop: 14, fontFamily: F.text, fontSize: 12, color: '#F5A5B4' },
  empty: { paddingTop: 90, alignItems: 'center', gap: 8 },
  emptyT: { marginTop: 6, fontFamily: F.semi, fontSize: 15, color: C.tx },
  emptyP: { fontFamily: F.text, fontSize: 12, color: C.tx3 },
});
