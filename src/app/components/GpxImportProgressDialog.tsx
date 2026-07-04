import { Text, View } from 'react-native';

import type { AppStyles } from '@/app/appStyles';
import type { AppTheme } from '@/theme/theme';
import { Dialog } from './Dialog';
import { IndeterminateProgressBar } from './IndeterminateProgressBar';

export type GpxImportProgressDialogProps = {
  /** 表示状態。 */
  visible: boolean;
  /** 画面共通スタイル。 */
  styles: AppStyles;
  /** 配色テーマ（将来の拡張用）。 */
  theme: AppTheme;
};

/**
 * GPXインポート処理中に表示する、閉じられないブロッキングダイアログ。
 * インポートが終わるまで他の操作（削除など）を防ぐ。
 */
export function GpxImportProgressDialog({ visible, styles }: GpxImportProgressDialogProps) {
  return (
    <Dialog visible={visible} dismissible={false} swipeToClose={false} styles={styles} onClose={() => undefined}>
      <View style={styles.gifRangeContent}>
        <Text style={styles.gifProgressTitle}>GPXを取り込んでいます…</Text>
        <Text style={styles.gifProgressBody}>取り込みが終わるまで少しお待ちください。画面を閉じないでください。</Text>
        <IndeterminateProgressBar styles={styles} animating={visible} />
      </View>
    </Dialog>
  );
}
