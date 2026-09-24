import { View } from 'react-native';

import type { AppTheme } from '@/theme/theme';
import type { AppStyles } from '@/ui/appStyles';

export type AppProgressBarProps = {
  /** 進捗の割合。0〜1の範囲外は丸める。 */
  ratio: number;
  /** 画面共通スタイル。 */
  styles: AppStyles;
  /** 現在テーマ。 */
  theme: AppTheme;
  /** スクリーンリーダー向けのラベル。 */
  accessibilityLabel: string;
};

/**
 * 割合だけを受け取る汎用プログレスバー。
 *
 * 呼び出し側の型に依存させない。スポット実績は分数、将来の高速道路走破実績は
 * パーセントというようにラベル表記が異なるため、表記は呼び出し側が決める。
 */
export function AppProgressBar({ ratio, styles, theme, accessibilityLabel }: AppProgressBarProps) {
  const clampedRatio = Number.isFinite(ratio) ? Math.min(Math.max(ratio, 0), 1) : 0;

  return (
    <View
      accessibilityLabel={accessibilityLabel}
      accessibilityRole="progressbar"
      accessibilityValue={{ min: 0, max: 100, now: Math.round(clampedRatio * 100) }}
      style={styles.appProgressBarTrack}
    >
      <View style={[styles.appProgressBarFill, { width: `${clampedRatio * 100}%`, backgroundColor: theme.colors.primary }]} />
    </View>
  );
}
