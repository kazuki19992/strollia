import { Text, View } from 'react-native';

import type { AppStyles } from '@/ui/appStyles';
import { ANNUAL_REPORT_AGGREGATING_DIALOG_MESSAGE, ANNUAL_REPORT_AGGREGATING_DIALOG_TITLE } from '@/ui/appText';
import { Dialog } from './Dialog';

/** 年間レポート集計中の案内ダイアログの props。 */
export type AnnualReportAggregatingDialogProps = {
  /** 表示状態。 */
  visible: boolean;
  /** 画面共通スタイル。 */
  styles: AppStyles;
  /** 閉じる処理。 */
  onClose: () => void;
};

/**
 * 公開期間中だが年間レポートの集計がまだ終わっていないときに、ふりかえりボタンを押すと出す案内ダイアログ。
 * 待つしかない案内なので操作ボタンは置かず、スワイプ(または×)で閉じられるようにする。
 * 完成したら通知で知らせるため、その旨も本文で伝える。
 *
 * @param props - 表示状態、スタイル、閉じる処理。
 * @returns 案内ダイアログ。
 */
export function AnnualReportAggregatingDialog({ visible, styles, onClose }: AnnualReportAggregatingDialogProps) {
  return (
    <Dialog visible={visible} swipeToClose styles={styles} onClose={onClose}>
      <View style={styles.gifRangeContent}>
        <Text style={styles.gifProgressTitle}>{ANNUAL_REPORT_AGGREGATING_DIALOG_TITLE}</Text>
        <Text style={styles.gifProgressBody}>{ANNUAL_REPORT_AGGREGATING_DIALOG_MESSAGE}</Text>
      </View>
    </Dialog>
  );
}
