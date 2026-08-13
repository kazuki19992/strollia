import { Text, View } from 'react-native';

import type { AppStyles } from '@/ui/appStyles';
import type { AppTheme } from '@/theme/theme';
import { formatDistanceKilometers } from './dashboardScaling';
import { Dialog } from './Dialog';
import { IndeterminateProgressBar } from './IndeterminateProgressBar';

/** GPXインポートの現在段階。 */
export type GpxImportProgressStage = 'selecting' | 'parsing' | 'saving' | 'refreshing';

export type GpxImportProgressDialogProps = {
  /** 表示状態。 */
  visible: boolean;
  /** 画面共通スタイル。 */
  styles: AppStyles;
  /** 配色テーマ（将来の拡張用）。 */
  theme: AppTheme;
  /** 取り込み開始時点の通算距離。単位はm。 */
  odometerDistanceMeters: number;
  /** 現在の処理段階。 */
  stage: GpxImportProgressStage;
};

/**
 * GPXインポート処理中に表示する、閉じられないブロッキングダイアログ。
 * インポートが終わるまで他の操作（削除など）を防ぐ。
 */
export function GpxImportProgressDialog({ visible, styles, odometerDistanceMeters, stage }: GpxImportProgressDialogProps) {
  const [integer, decimal] = formatDistanceKilometers(odometerDistanceMeters).split('.');

  return (
    <Dialog visible={visible} dismissible={false} swipeToClose={false} styles={styles} onClose={() => undefined}>
      <View style={styles.gifRangeContent}>
        <Text style={styles.gifProgressTitle}>{getProgressTitle(stage)}</Text>
        <Text style={styles.gifProgressBody}>取り込みが終わるまで少しお待ちください。画面を閉じないでください。</Text>
        <IndeterminateProgressBar styles={styles} animating={visible} />
        <View testID="gpx-import-odometer" style={styles.gpxImportOdometer}>
          <Text style={styles.gpxImportOdometerLabel}>ODO</Text>
          <Text style={styles.gpxImportOdometerInteger}>{integer}</Text>
          <Text style={styles.gpxImportOdometerNumber}>.</Text>
          <Text style={styles.gpxImportOdometerDecimal}>{decimal}</Text>
          <Text style={styles.gpxImportOdometerUnit}>km</Text>
        </View>
      </View>
    </Dialog>
  );
}

/** 処理段階を待機中のユーザーへ分かりやすく伝える見出しを返す。 */
function getProgressTitle(stage: GpxImportProgressStage): string {
  switch (stage) {
    case 'selecting':
      return 'GPXファイルを準備しています…';
    case 'parsing':
      return 'GPXを解析しています…';
    case 'saving':
      return 'GPXを保存しています…';
    case 'refreshing':
      return '表示を更新しています…';
  }
}
