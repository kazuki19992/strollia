import { Text, View } from 'react-native';

import type { AppStyles } from '@/ui/appStyles';
import {
  PHOTO_DELETED_DIALOG_MESSAGE,
  PHOTO_DELETED_DIALOG_TITLE,
  PHOTO_LIBRARY_RELOAD_LABEL,
  PHOTO_UNAVAILABLE_DIALOG_MESSAGE,
  PHOTO_UNAVAILABLE_DIALOG_TITLE,
} from '@/ui/appText';
import type { PhotoUnavailableReason } from '@/ui/hooks/usePhotoUnavailableReason';
import { ActionPill } from './ActionPill';
import { Dialog } from './Dialog';

export type PhotoUnavailableDialogProps = {
  /** 案内すべき理由。案内不要な場合はnull。 */
  reason: PhotoUnavailableReason | null;
  /** 画面共通スタイル。 */
  styles: AppStyles;
  /** 案内を閉じる処理。 */
  onClose: () => void;
  /** 写真ライブラリを全件読み込み直す処理。 */
  onReloadPhotoLibrary: () => void;
};

/**
 * 拡大表示で画像を出せなかったときの案内ダイアログ。
 *
 * **削除済みと取得不可で文言も導線も分ける。** 削除は再読み込みで解消するが、iCloudに本体がある
 * だけの写真は再読み込みしても変わらない。後者に再読み込みボタンを置くと、押しても直らない導線を
 * 出すことになる(設計書 §4.5)。
 *
 * @param props - 理由、スタイル、閉じる処理、再読み込み処理。
 * @returns 案内ダイアログ。
 */
export function PhotoUnavailableDialog({ reason, styles, onClose, onReloadPhotoLibrary }: PhotoUnavailableDialogProps) {
  const isDeleted = reason === 'deleted';

  return (
    <Dialog visible={reason !== null} swipeToClose={false} styles={styles} onClose={onClose}>
      <View style={styles.gifRangeContent}>
        <Text style={styles.gifProgressTitle}>{isDeleted ? PHOTO_DELETED_DIALOG_TITLE : PHOTO_UNAVAILABLE_DIALOG_TITLE}</Text>
        <Text style={styles.gifProgressBody}>{isDeleted ? PHOTO_DELETED_DIALOG_MESSAGE : PHOTO_UNAVAILABLE_DIALOG_MESSAGE}</Text>
        {isDeleted ? <ActionPill label={PHOTO_LIBRARY_RELOAD_LABEL} styles={styles} onPress={onReloadPhotoLibrary} /> : null}
      </View>
    </Dialog>
  );
}
