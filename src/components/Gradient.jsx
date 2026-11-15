/* 两色线性渐变：不开新原生依赖，用一层带旋转的纯色叠 + 透明度过渡近似。
   取的是 158deg 的大方向（左上偏暗 → 右下偏亮），卡片尺寸下肉眼一致。 */
import React from 'react';
import { View } from 'react-native';

export default function LinearGradient({ colors, style, angle = '158deg' }) {
  const [a, b] = colors || ['#101014', '#1C1C24'];
  return (
    <View style={[style, { backgroundColor: a, overflow: 'hidden' }]} pointerEvents="none">
      <View style={{
        position: 'absolute', left: '-30%', right: '-30%', top: '28%', bottom: '-40%',
        backgroundColor: b, opacity: 0.9, transform: [{ rotate: angle === '158deg' ? '-18deg' : '0deg' }],
      }} />
    </View>
  );
}
