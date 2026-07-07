import { Feather } from '@expo/vector-icons';
import { Pressable, StyleProp, StyleSheet, Text, TextStyle, ViewStyle } from 'react-native';

export type ShareButtonProps = {
  /** アクセシビリティ用ラベル。 */
  accessibilityLabel: string;
  /** 無効化するか。 */
  disabled?: boolean;
  /** アイコン色。 */
  iconColor: string;
  /** アイコンサイズ。 */
  iconSize?: number;
  /** ボタン内に表示するテキスト。未指定ならアイコンのみ。 */
  label?: string;
  /** ボタンスタイル。 */
  style?: StyleProp<ViewStyle>;
  /** ラベルスタイル。 */
  textStyle?: StyleProp<TextStyle>;
  /** 押下処理。 */
  onPress: () => void;
  /** 表示バリエーション。 */
  variant?: 'icon' | 'wide';
};

/** 共有アクションで共通利用するボタン。 */
export function ShareButton({
  accessibilityLabel,
  disabled = false,
  iconColor,
  iconSize = 24,
  label,
  style,
  textStyle,
  variant = label ? 'wide' : 'icon',
  onPress,
}: ShareButtonProps) {
  return (
    <Pressable
      accessibilityLabel={accessibilityLabel}
      accessibilityRole="button"
      disabled={disabled}
      onPress={onPress}
      style={[variant === 'wide' ? shareButtonStyles.wide : shareButtonStyles.icon, style]}
    >
      <Feather name="share-2" size={iconSize} color={iconColor} />
      {label ? <Text style={[shareButtonStyles.label, textStyle]}>{label}</Text> : null}
    </Pressable>
  );
}

// AppStyles を持たないレポート系(reportStyles)のコンテキストからも利用される汎用部品のため、
// ベースレイアウトは自己完結させる(テーマ非依存の固定値のみ)。色は props で受け取る。
// eslint-disable-next-line no-restricted-syntax -- 複数のスタイル文脈から使う共通部品の意図的な自己完結スタイル
const shareButtonStyles = StyleSheet.create({
  icon: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    fontSize: 18,
    fontWeight: '400',
    lineHeight: 24,
  },
  wide: {
    alignItems: 'center',
    borderRadius: 999,
    flexDirection: 'row',
    gap: 14,
    justifyContent: 'center',
    minHeight: 66,
    paddingHorizontal: 24,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.18,
    shadowRadius: 14,
  },
});
