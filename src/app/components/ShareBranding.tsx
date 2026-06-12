import { Image, StyleProp, StyleSheet, Text, View, ViewStyle } from 'react-native';

export type ShareBrandingProps = {
  /** 配置の上書き（既定は右下に絶対配置）。 */
  style?: StyleProp<ViewStyle>;
};

/**
 * 共有画像の右下に表示するアプリのブランディング（アイコン＋アプリ名）。
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

const styles = StyleSheet.create({
  branding: {
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.45)',
    borderRadius: 8,
    bottom: 12,
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 8,
    paddingVertical: 6,
    position: 'absolute',
    right: 12,
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
