import type { AppStyles } from '@/ui/appStyles';
import { PLUS_BADGE_LABEL } from '@/ui/appText';
import { LabelBadge } from './LabelBadge';

/** PlusBadge のprops。 */
export type PlusBadgeProps = {
  /** 画面共通スタイル。 */
  styles: AppStyles;
};

/** Plus用の機能・パックであることを示すラベル。汎用の {@link LabelBadge} に「Plus」を渡すだけの薄いラッパー。 */
export function PlusBadge({ styles }: PlusBadgeProps) {
  return <LabelBadge label={PLUS_BADGE_LABEL} styles={styles} />;
}
