/* 根组件：路由、详情浮层、播放器浮层、搜索、设置、toast。
   RN 没有 DOM，所以详情不是 clip-path 洞，而是整页 transform 从卡片矩形放大；收起反向。 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Animated, BackHandler, Easing, FlatList, ScrollView, StatusBar, StyleSheet, Text, View,
  useWindowDimensions,
} from 'react-native';
import Home from './screens/Home.jsx';
import Library from './screens/Library.jsx';
import Mine from './screens/Mine.jsx';
import Detail from './screens/Detail.jsx';
import Player from './screens/Player.jsx';
import Search from './screens/Search.jsx';
import Settings from './screens/Settings.jsx';
import Topbar from './components/Topbar.jsx';
import Tabbar from './components/Tabbar.jsx';
import Icon from './components/Icon.jsx';
import Card from './components/Card.jsx';
import { C, F } from './theme.js';
import { api, hydrate, norm, onToast } from './lib/core.js';
import { loadBase } from './lib/config.js';

export default function App() {
  const [ready, setReady] = useState(false);
  const [needBase, setNeedBase] = useState(false);
  const hadBase = useRef(false);   // 之前成功连过，就允许从设置页退回来
  const [route, setRoute] = useState('home');
  const [tab, setTab] = useState('home');
  const [libCat, setLibCat] = useState(null);
  const [libTitle, setLibTitle] = useState('');
  const [list, setList] = useState(null);

  const [data, setData] = useState({ hero: [], sections: [] });
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');

  const [sheet, setSheet] = useState(null);       // {show, from, autoPlay}
  const closeSheetRef = useRef(null);
  const curSheet = useRef(null);
  const [player, setPlayer] = useState(null);
  const [searchOpen, setSearchOpen] = useState(false);
  const homeScroll = useRef(null);
  const [toastMsg, setToastMsg] = useState('');
  const toastT = useRef(null);

  /* 启动：先读后端地址与本地记录，再拉首页 */
  useEffect(() => {
    let dead = false;
    (async () => {
      const b = await loadBase();
      await hydrate();
      if (dead) return;
      try {
        await api.ping();
        if (!dead) { hadBase.current = true; setNeedBase(false); }
      } catch (e) {
        if (!dead) setNeedBase(true);
      }
    })();
    return () => { dead = true; };
  }, []);

  const loadHome = useCallback(async () => {
    setLoading(true); setErr('');
    try {
      const d = await api.home();
      setData({ hero: d.hero || [], sections: (d.sections || []).filter(s => s.items && s.items.length >= 3) });
    } catch (e) {
      setErr(e.message || '网络异常');
    } finally { setLoading(false); }
  }, []);

  useEffect(() => {
    if (needBase) return undefined;
    let dead = false;
    loadHome().then(() => { if (!dead) setTimeout(() => setReady(true), 120); });
    return () => { dead = true; };
  }, [needBase, loadHome]);

  useEffect(() => onToast(m => {
    setToastMsg(m);
    clearTimeout(toastT.current);
    toastT.current = setTimeout(() => setToastMsg(''), 2100);
  }), []);

  const openDetail = useCallback((s, from, autoPlay) => {
    const item = { show: norm(s), from: from || null, autoPlay: !!autoPlay };
    curSheet.current = item;
    setSheet(item);
    setSearchOpen(false);
  }, []);

  const closeDetail = useCallback(() => {
    curSheet.current = null;
    setSheet(null);
  }, []);

  const play = useCallback(it => {
    if (!it) return;
    setPlayer(it);
    closeDetail();
  }, [closeDetail]);

  const go = useCallback(n => {
    setRoute(n); setTab(n); setList(null);
    if (n !== 'library') { setLibCat(null); setLibTitle(''); }
  }, []);

  const onCat = useCallback((id, name) => {
    setLibCat(id); setLibTitle(name || ''); setRoute('library'); setTab('library'); setList(null);
  }, []);

  const onAll = useCallback((name, items) => { setList({ name, items }); }, []);

  /* Android 返回键：先关最上层浮层 */
  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (searchOpen) { setSearchOpen(false); return true; }
      if (player) { setPlayer(null); return true; }
      if (sheet) {
        if (closeSheetRef.current) closeSheetRef.current();
        return true;
      }
      if (list) { setList(null); return true; }
      if (route !== 'home') { go('home'); return true; }
      return false;
    });
    return () => sub.remove();
  }, [searchOpen, player, sheet, list, route, go]);

  if (needBase) {
    return (
      <View style={st.root}>
        <StatusBar barStyle="light-content" backgroundColor={C.bg} />
        <Settings onDone={() => setNeedBase(false)} canCancel={hadBase.current} />
      </View>
    );
  }

  return (
    <View style={st.root}>
      <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />

      {!ready ? (
        <View style={st.boot}>
          <Icon name="i-mark" size={44} color="rgba(255,255,255,.5)" />
          <Text style={st.bootName}>NEON<Text style={{ color: C.accent }}>FLICK</Text></Text>
          <View style={st.bootLine}><BootBar /></View>
        </View>
      ) : (
        <View style={{ flex: 1 }}>
          <Topbar
            back={route !== 'home' || !!list}
            onBack={() => { if (list) setList(null); else go('home'); }}
            onSearch={() => setSearchOpen(true)}
          />

          {list ? (
            <SimplerList list={list} onOpen={openDetail} />
          ) : route === 'library' ? (
            <Library cat={libCat} onCat={onCat} onOpen={openDetail} />
          ) : route === 'mylist' ? (
            <Mine onOpen={openDetail} onSettings={() => setNeedBase(true)} />
          ) : (
            <HomeScreen
              scrollRef={homeScroll}
              data={data} loading={loading} err={err} onRetry={loadHome}
              onOpen={openDetail} onPlay={it => openDetail(it, null, true)}
              onCat={onCat} onAll={onAll}
            />
          )}

          {!sheet && !player && !searchOpen ? <Tabbar route={tab} onNav={go} /> : null}
        </View>
      )}

      {sheet ? (
        <Detail
          key={sheet.show.id}
          show={sheet.show}
          from={sheet.from}
          autoPlay={sheet.autoPlay}
          onClose={closeDetail}
          onPlay={play}
          onRelated={s => openDetail(s, null, false)}
          closeRef={closeSheetRef}
        />
      ) : null}

      {player ? <Player item={player} onClose={() => setPlayer(null)} /> : null}

      {searchOpen ? (
        <Search onClose={() => setSearchOpen(false)} onOpen={(s, from) => {
          setSearchOpen(false);
          setTimeout(() => openDetail(s, from, false), 60);
        }} />
      ) : null}

      {toastMsg ? (
        <View style={st.toast} pointerEvents="none">
          <Text style={st.toastTx}>{toastMsg}</Text>
        </View>
      ) : null}
    </View>
  );
}

/* 启动条的循环扫光：纯合成动画，不占 JS 线程 */
function BootBar() {
  const x = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(Animated.timing(x, {
      toValue: 1, duration: 1100, easing: Easing.inOut(Easing.quad), useNativeDriver: true,
    }));
    loop.start();
    return () => loop.stop();
  }, [x]);
  return (
    <Animated.View
      style={[st.bootFill, {
        transform: [{ translateX: x.interpolate({ inputRange: [0, 1], outputRange: [-46, 120] }) }],
      }]}
    />
  );
}

/* 首页独立一层，避免把 data 相关 memo 塞进根组件 */
function HomeScreen({ scrollRef, ...props }) {
  return (
    <ScrollView
      ref={scrollRef}
      style={{ flex: 1 }}
      contentContainerStyle={{ paddingTop: 0 }}
      showsVerticalScrollIndicator={false}
    >
      <Home {...props} onTop={() => scrollRef.current && scrollRef.current.scrollTo({ y: 0, animated: true })} />
    </ScrollView>
  );
}

/* 「全部」入口：把某个轨道的 items 铺成三列 */
function SimplerList({ list, onOpen }) {
  const { width } = useWindowDimensions();
  const cardW = (width - 40 - 24) / 3;
  const items = (list && list.items) || [];
  return (
    <View style={{ paddingTop: 56 + (StatusBar.currentHeight || 0), flex: 1 }}>
      <View style={st.sect}>
        <Text style={st.sectK}>COLLECTION</Text>
        <Text style={st.sectT}>{(list && list.name) || '全部'}</Text>
      </View>
      <FlatList
        style={{ flex: 1 }}
        data={items}
        keyExtractor={(it, i) => (it.id || i) + ':' + i}
        numColumns={3}
        columnWrapperStyle={{ gap: 12, paddingHorizontal: 20 }}
        contentContainerStyle={{ gap: 16, paddingTop: 16, paddingBottom: 140 }}
        renderItem={({ item }) => (
          <View style={{ width: cardW }}>
            <Card s={item} width={cardW} onClick={onOpen} />
          </View>
        )}
      />
    </View>
  );
}

const st = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },
  boot: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  bootName: { fontFamily: F.display, fontSize: 26, letterSpacing: 5, color: '#fff' },
  bootLine: {
    marginTop: 6, width: 120, height: 2, borderRadius: 1, overflow: 'hidden',
    backgroundColor: 'rgba(255,255,255,.12)',
  },
  bootFill: { width: 46, height: 2, borderRadius: 1, backgroundColor: C.accent },
  sect: { paddingHorizontal: 20, paddingTop: 6 },
  sectK: { fontFamily: F.bold, fontSize: 10.5, letterSpacing: 2.2, color: C.accent },
  sectT: { marginTop: 3, fontFamily: F.display, fontSize: 26, color: C.tx },
  toast: {
    position: 'absolute', left: 40, right: 40, bottom: 104, alignItems: 'center',
    paddingVertical: 10, paddingHorizontal: 14, borderRadius: 999,
    backgroundColor: 'rgba(20,20,26,.94)',
    borderWidth: StyleSheet.hairlineWidth, borderColor: C.line2,
  },
  toastTx: { fontFamily: F.semi, fontSize: 12, color: C.tx, textAlign: 'center' },
});
