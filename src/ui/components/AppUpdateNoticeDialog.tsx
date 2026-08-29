import { ScrollView, useWindowDimensions } from 'react-native';

import type { AppUpdateNotice, AppUpdateNoticeSource } from '@/features/app-update/updateNotices';
import type { AppStyles } from '@/ui/appStyles';
import { ActionPill } from './ActionPill';
import { AppUpdateNoticeSign } from './AppUpdateNoticeSign';
import { Dialog } from './Dialog';

/** 更新通知ダイアログのprops。 */
export type AppUpdateNoticeDialogProps = {
  /** 親が要求する表示状態。通知または表示元がない場合は非表示になる。 */
  visible: boolean;
  /** 表示を開始した導線。設定画面からの場合だけストアへの導線を出す。 */
  source: AppUpdateNoticeSource | null;
  /** 表示する更新通知。nullの場合はダイアログを表示しない。 */
  notice: AppUpdateNotice | null;
  /** 画面共通スタイル。 */
  styles: AppStyles;
  /** ダイアログを閉じる処理。 */
  onClose: () => void;
  /** 現在OS向けのストアページを開く処理。 */
  onOpenStorePage: () => void;
};

/**
 * 工事看板形式の更新内容を既存のスワイプ可能なダイアログで表示する。
 *
 * 看板とストア導線を小さい画面でも欠けずに表示できるよう、ダイアログ本文だけを画面高の72%までスクロール可能にする。
 */
export function AppUpdateNoticeDialog({ visible, source, notice, styles, onClose, onOpenStorePage }: AppUpdateNoticeDialogProps) {
  const { height } = useWindowDimensions();
  const isVisible = visible && source !== null && notice !== null;

  return (
    <Dialog visible={isVisible} swipeToClose autoClose={false} styles={styles} onClose={onClose}>
      {isVisible ? (
        <ScrollView
          style={[styles.appUpdateNoticeDialogScroll, { maxHeight: height * 0.72 }]}
          contentContainerStyle={styles.appUpdateNoticeDialogContent}
        >
          <AppUpdateNoticeSign notice={notice} />
          {source === 'settings' ? <ActionPill label="ストアページへ" styles={styles} onPress={onOpenStorePage} /> : null}
        </ScrollView>
      ) : null}
    </Dialog>
  );
}
