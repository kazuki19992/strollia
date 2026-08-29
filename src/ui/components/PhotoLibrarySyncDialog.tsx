import { Text, View } from 'react-native';

import type { PhotoScanProgress } from '@/features/photos/photoLibrary';
import type { AppStyles } from '@/ui/appStyles';
import { formatPhotoLibrarySyncProgress, PHOTO_LIBRARY_SYNC_DIALOG_DESCRIPTION, PHOTO_LIBRARY_SYNC_DIALOG_TITLE } from '@/ui/appText';
import { DeterminateProgressBar } from './DeterminateProgressBar';
import { Dialog } from './Dialog';
import { IndeterminateProgressBar } from './IndeterminateProgressBar';

export type PhotoLibrarySyncDialogProps = {
  /** 表示状態。 */
  visible: boolean;
  /** 走査の進捗。総数が分かる前はnull。 */
  progress: PhotoScanProgress | null;
  /** 画面共通スタイル。 */
  styles: AppStyles;
};

/**
 * 写真ライブラリの全件再読み込み中に表示する、閉じられないブロッキングダイアログ。
 *
 * **操作を止めるのは意図的である。** 走査中に地図を操作するとネイティブリソースの取り合いで
 * 1.6倍遅くなる実測があり(設計書 §2.1)、操作させないことで結果的に早く終わる。
 *
 * 総数は `exeForMetadata()` を終えて初めて分かるため、それまでは不定形の進捗バーにし、
 * 分かってからは「N件中M件」と確定進捗バーへ切り替える(設計書 §4.4)。
 *
 * @param props - 表示状態、進捗、スタイル。
 * @returns ブロッキングダイアログ。
 */
export function PhotoLibrarySyncDialog({ visible, progress, styles }: PhotoLibrarySyncDialogProps) {
  return (
    <Dialog visible={visible} dismissible={false} swipeToClose={false} styles={styles} onClose={() => undefined}>
      <View style={styles.gifRangeContent}>
        <Text style={styles.gifProgressTitle}>{PHOTO_LIBRARY_SYNC_DIALOG_TITLE}</Text>
        <Text style={styles.gifProgressBody}>{PHOTO_LIBRARY_SYNC_DIALOG_DESCRIPTION}</Text>
        {progress === null ? (
          <IndeterminateProgressBar styles={styles} animating={visible} />
        ) : (
          <>
            <Text style={styles.gifProgressBody}>{formatPhotoLibrarySyncProgress(progress)}</Text>
            <DeterminateProgressBar
              styles={styles}
              progress={progress.totalAssetCount === 0 ? 0 : progress.processedAssetCount / progress.totalAssetCount}
            />
          </>
        )}
      </View>
    </Dialog>
  );
}
