import type { ReactNode } from 'react';
import { Pressable, Text, View } from 'react-native';

import type { AppStyles } from '@/ui/appStyles';

export type ActionPillProps = {
  /** アクセシビリティ用ラベル。未指定の場合は label を使用。 */
  accessibilityLabel?: string;
  /** 内容を左寄せするか。 */
  alignLeft?: boolean;
  /** 背景色を上書きする場合の色。 */
  backgroundColor?: string;
  /** 枠線色を上書きする場合の色。 */
  borderColor?: string;
  /** 危険操作かどうか。 */
  danger?: boolean;
  /** 無効化するか。 */
  disabled?: boolean;
  /** 左側アイコン。 */
  icon?: ReactNode;
  /** 表示名。 */
  label: string;
  /** 画面共通スタイル。 */
  styles: AppStyles;
  /** 文字色を上書きする場合の色。 */
  textColor?: string;
  /** 押下処理。 */
  onPress: () => void;
};

/** アウトラインのピル型アクションボタン。 */
export function ActionPill({
  accessibilityLabel,
  alignLeft = false,
  backgroundColor,
  borderColor,
  danger = false,
  disabled = false,
  icon,
  label,
  styles,
  textColor,
  onPress,
}: ActionPillProps) {
  return (
    <Pressable
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityRole="button"
      disabled={disabled}
      onPress={onPress}
      style={[
        styles.actionPill,
        danger && styles.actionPillDanger,
        alignLeft && styles.actionPillLeft,
        backgroundColor ? { backgroundColor } : null,
        borderColor ? { borderColor } : null,
        disabled && styles.buttonDisabled,
      ]}
    >
      <View style={[styles.actionPillContent, alignLeft && styles.actionPillContentLeft]}>
        {icon}
        <Text style={[styles.actionPillText, danger && styles.actionPillDangerText, textColor ? { color: textColor } : null]}>{label}</Text>
      </View>
    </Pressable>
  );
}
