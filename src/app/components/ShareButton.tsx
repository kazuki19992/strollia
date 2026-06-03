import { Feather } from '@expo/vector-icons';
import { Pressable, StyleProp, Text, TextStyle, ViewStyle } from 'react-native';

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
  style: StyleProp<ViewStyle>;
  /** ラベルスタイル。 */
  textStyle?: StyleProp<TextStyle>;
  /** 押下処理。 */
  onPress: () => void;
};

/** 共有アクションで共通利用するボタン。 */
export function ShareButton({ accessibilityLabel, disabled = false, iconColor, iconSize = 24, label, style, textStyle, onPress }: ShareButtonProps) {
  return (
    <Pressable accessibilityLabel={accessibilityLabel} accessibilityRole="button" disabled={disabled} onPress={onPress} style={style}>
      <Feather name="share-2" size={iconSize} color={iconColor} />
      {label ? <Text style={textStyle}>{label}</Text> : null}
    </Pressable>
  );
}
