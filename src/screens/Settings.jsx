/* 后端地址设置：APK 里没有同源概念，必须自己填服务器地址。
   保存后 ping 一次，通了才允许进主界面。 */
import React, { useState } from 'react';
import {
  ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View,
} from 'react-native';
import Icon from '../components/Icon.jsx';
import { C, F } from '../theme.js';
import { api } from '../lib/core.js';
import { DEFAULT_BASE, saveBase } from '../lib/config.js';

export default function Settings({ initial, onDone, canCancel }) {
  const [v, setV] = useState(initial || DEFAULT_BASE);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');

  const test = async () => {
    setBusy(true); setMsg('');
    try {
      const r = await api.ping(v);   // 先按输入框里的地址探一次
      if (!r || !r.ok) { setMsg('服务器没有正常响应'); return; }
      const b = await saveBase(v);   // 探通了才落盘，错地址不写进存储
      setMsg('连接成功');
      onDone && onDone(b);
    } catch (e) {
      setMsg('连不上：' + ((e && e.message) || '请检查地址与同一局域网'));
    } finally { setBusy(false); }
  };

  return (
    <View style={st.wrap}>
      <View style={st.head}>
        <Icon name="i-mark" size={40} color={C.accent} />
        <Text style={st.brand}>NEON<Text style={{ color: C.accent }}>FLICK</Text></Text>
        <Text style={st.sub}>填一下片源服务器地址</Text>
      </View>

      <View style={st.field}>
        <Text style={st.label}>服务器</Text>
        <TextInput
          style={st.input}
          value={v}
          onChangeText={setV}
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="url"
          placeholder="http://192.168.1.2:8099"
          placeholderTextColor={C.tx3}
          selectionColor={C.accent}
        />
      </View>
      <Text style={st.hint}>和手机在同一个网络里跑着 server.js 的地址，带端口。</Text>

      {msg ? <Text style={st.msg}>{msg}</Text> : null}

      <Pressable style={st.btn} onPress={test} disabled={busy}>
        {busy ? <ActivityIndicator color="#0B0B0F" /> : <Text style={st.btnTx}>保存并连接</Text>}
      </Pressable>

      {canCancel ? (
        <Pressable style={st.cancel} onPress={() => onDone && onDone(initial)}>
          <Text style={st.cancelTx}>取消</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const st = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: C.bg, paddingHorizontal: 24, paddingTop: 90 },
  head: { alignItems: 'center', gap: 10, marginBottom: 34 },
  brand: { fontFamily: F.display, fontSize: 26, letterSpacing: 3.4, color: '#fff' },
  sub: { fontFamily: F.text, fontSize: 12.5, color: C.tx3 },
  field: { gap: 8 },
  label: { fontFamily: F.semi, fontSize: 11, letterSpacing: 1.2, color: C.tx3 },
  input: {
    height: 46, paddingHorizontal: 14, borderRadius: 12, backgroundColor: C.card,
    fontFamily: F.text, fontSize: 13.5, color: C.tx,
    borderWidth: StyleSheet.hairlineWidth, borderColor: C.line2,
  },
  hint: { marginTop: 8, fontFamily: F.text, fontSize: 11, lineHeight: 16, color: C.tx3 },
  msg: { marginTop: 14, fontFamily: F.text, fontSize: 12, color: C.gold },
  btn: {
    marginTop: 22, height: 48, borderRadius: 12, alignItems: 'center', justifyContent: 'center',
    backgroundColor: '#fff',
  },
  btnTx: { fontFamily: F.bold, fontSize: 14, color: '#0B0B0F' },
  cancel: { marginTop: 12, height: 40, alignItems: 'center', justifyContent: 'center' },
  cancelTx: { fontFamily: F.semi, fontSize: 12.5, color: C.tx3 },
});
