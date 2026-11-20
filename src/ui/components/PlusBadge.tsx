import { Text, View } from 'react-native';

import type { AppStyles } from '@/ui/appStyles';
import { PLUS_BADGE_LABEL } from '@/ui/appText';

/** PlusBadge のprops。 */
export type PlusBadgeProps = {
  /** 画面共通スタイル。 */
  styles: AppStyles;
};

/**
 * Plus用の機能・パックであることを示す小さなピル型ラベル。
 *
 * 読み上げは行全体の accessibilityLabel に含める前提のため、ラベル単体には accessibilityLabel を付けない。
 */
export function PlusBadge({ styles }: PlusBadgeProps) {
  return (
    <View style={styles.plusBadge}>
      <Text style={styles.plusBadgeText}>{PLUS_BADGE_LABEL}</Text>
    </View>
  );
}
