import { Text, View } from 'react-native';

import type { AppStyles } from '@/ui/appStyles';
import { PHOTO_DELETED_DIALOG_MESSAGE, PHOTO_DELETED_DIALOG_TITLE, PHOTO_LIBRARY_RELOAD_LABEL } from '@/ui/appText';
import { ActionPill } from './ActionPill';
import { Dialog } from './Dialog';

export type PhotoDeletedDialogProps = {
  /** 削除済みと確認できた写真を開いているかどうか。 */
  visible: boolean;
  /** 画面共通スタイル。 */
  styles: AppStyles;
  /** 案内を閉じる処理。 */
  onClose: () => void;
  /** 写真ライブラリを全件読み込み直す処理。 */
  onReloadPhotoLibrary: () => void;
};

/**
 * 削除済みと確認できた写真を開いたときの案内ダイアログ。
 *
 * **モーダルで止めるのは削除済みのときだけである。** 削除は再読み込みで解消するため、操作を止めて
 * その場で導線を出す価値がある。iCloudに本体があるだけの写真は再読み込みしても変わらず、開くたびに
 * モーダルが出ると邪魔になるので、拡大表示の中の控えめな案内(`PhotoPreviewModals`)へ回す(設計書 §4.5)。
 *
 * @param props - 表示可否、スタイル、閉じる処理、再読み込み処理。
 * @returns 案内ダイアログ。
 */
export function PhotoDeletedDialog({ visible, styles, onClose, onReloadPhotoLibrary }: PhotoDeletedDialogProps) {
  return (
    <Dialog visible={visible} swipeToClose={false} styles={styles} onClose={onClose}>
      <View style={styles.gifRangeContent}>
        <Text style={styles.gifProgressTitle}>{PHOTO_DELETED_DIALOG_TITLE}</Text>
        <Text style={styles.gifProgressBody}>{PHOTO_DELETED_DIALOG_MESSAGE}</Text>
        <ActionPill label={PHOTO_LIBRARY_RELOAD_LABEL} styles={styles} onPress={onReloadPhotoLibrary} />
      </View>
    </Dialog>
  );
}
