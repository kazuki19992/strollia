import { View } from 'react-native';

import type { AppStyles } from '@/ui/appStyles';

export type DeterminateProgressBarProps = {
  /** 画面共通スタイル。track/fill のスタイルを使う。 */
  styles: AppStyles;
  /** 進捗割合(0〜1)。範囲外・数値でない値は安全側へ丸める。 */
  progress: number;
};

/**
 * 進捗割合が分かる処理向けの確定(determinate)プログレスバー。
 *
 * `IndeterminateProgressBar` とトラック・塗りのスタイルを共有し、同じ見た目のまま
 * 「どこまで進んだか」だけを表せるようにする。総数が分かる前は不定形の方を使う。
 *
 * @param props - スタイルと進捗割合。
 * @returns 進捗バー。
 */
export function DeterminateProgressBar({ styles, progress }: DeterminateProgressBarProps) {
  // 呼び出し側の割り算が 0/0 になっても表示が壊れないよう、NaN は0%へ倒す
  const clampedProgress = Number.isFinite(progress) ? Math.min(1, Math.max(0, progress)) : 0;

  return (
    <View style={styles.gifProgressTrack}>
      <View testID="determinate-progress-fill" style={[styles.gifProgressFill, { width: `${Math.round(clampedProgress * 100)}%` }]} />
    </View>
  );
}
