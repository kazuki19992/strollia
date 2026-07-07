import { Image, StyleProp, StyleSheet, Text, View, ViewStyle } from 'react-native';

export type ShareBrandingProps = {
  /** 配置の上書き（既定は右下に絶対配置）。 */
  style?: StyleProp<ViewStyle>;
};

/**
 * 共有画像に表示するアプリのブランディング（アイコン＋アプリ名）。
 * 画像内の他要素と重ならないよう通常フローで配置し、右寄せにする（中身の末尾に置く想定）。
 * どの画面のキャプチャでも使えるよう、スタイルは自己完結させている。
 */
export function ShareBranding({ style }: ShareBrandingProps) {
  return (
    <View style={[styles.branding, style]}>
      <Image source={require('../../../assets/icon.png')} style={styles.icon} />
      <View style={styles.textWrap}>
        <Text style={styles.tagline}>おさんぽ記録アプリ</Text>
        <Text style={styles.name}>すとろりあ</Text>
      </View>
    </View>
  );
}

// 共有画像用ブランディングは画像内で常に同じ見た目にするためテーマ非依存の固定色を使う意図的な自己完結スタイル。
// eslint-disable-next-line no-restricted-syntax -- テーマ非依存の固定色（rgba(0,0,0,0.45) / #ffffff）を使うため appStyles への移動対象外
const styles = StyleSheet.create({
  branding: {
    alignItems: 'center',
    alignSelf: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.45)',
    borderRadius: 8,
    flexDirection: 'row',
    gap: 8,
    marginTop: 16,
    paddingHorizontal: 8,
    paddingVertical: 6,
  },
  icon: {
    borderRadius: 6,
    height: 34,
    width: 34,
  },
  textWrap: {
    justifyContent: 'center',
  },
  tagline: {
    color: '#ffffff',
    fontSize: 9,
    lineHeight: 11,
  },
  name: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '900',
    lineHeight: 16,
  },
});
