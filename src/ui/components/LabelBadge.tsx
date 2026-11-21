import { Text, View } from 'react-native';

import type { AppStyles } from '@/ui/appStyles';

/** LabelBadge のprops。 */
export type LabelBadgeProps = {
  /** ラベルに表示する文字。 */
  label: string;
  /** 画面共通スタイル。 */
  styles: AppStyles;
};

/**
 * 行のタイトル横などに添える小さなピル型ラベル(Plus・複数スポットなど)。
 *
 * 読み上げは行全体の accessibilityLabel に含める前提のため、ラベル単体には accessibilityLabel を付けない。
 */
export function LabelBadge({ label, styles }: LabelBadgeProps) {
  return (
    <View style={styles.labelBadge}>
      <Text style={styles.labelBadgeText}>{label}</Text>
    </View>
  );
}
