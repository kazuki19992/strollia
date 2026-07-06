import { Feather } from '@expo/vector-icons';
import { Pressable, StyleProp, Text, TextStyle, ViewStyle } from 'react-native';

import type { AppStyles } from '@/app/appStyles';

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
  /**
   * 画面共通スタイル。
   * レポートなど appStyles を持たないコンテキストからも利用されるため省略可とする。
   * 省略時はスタイルキーを使用せず、呼び出し元の style / textStyle prop でレイアウトを制御する。
   */
  styles?: AppStyles;
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
  styles,
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
      style={[variant === 'wide' ? styles?.shareButtonWideBase : styles?.shareButtonIcon, style]}
    >
      <Feather name="share-2" size={iconSize} color={iconColor} />
      {label ? <Text style={[styles?.shareButtonLabel, textStyle]}>{label}</Text> : null}
    </Pressable>
  );
}
