import { View, useWindowDimensions } from 'react-native';

import type { AppUpdateNotice, AppUpdateNoticeSource } from '@/features/app-update/updateNotices';
import type { AppStyles } from '@/ui/appStyles';
import { ActionPill } from './ActionPill';
import { AppUpdateNoticeSign } from './AppUpdateNoticeSign';
import { Dialog } from './Dialog';

/** ダイアログ内容が画面高に占められる最大割合。 */
const MAX_DIALOG_CONTENT_HEIGHT_RATIO = 0.72;
/** Dialog外側余白、カードpadding、要素間gap、スワイプ案内に必要な合計高。 */
const DIALOG_CHROME_RESERVED_HEIGHT = 120;
/** Dialogの最大幅と左右paddingから導く看板の最大幅。 */
const MAX_SIGN_WIDTH = 316;
/** 画面左右からDialog内容までの合計余白。 */
const WINDOW_TO_DIALOG_CONTENT_HORIZONTAL_INSET = 92;
/** 閉じるボタンと看板が重ならないための上余白。 */
const DIALOG_CONTENT_TOP_PADDING = 22;
/** 設定起点のActionPill最小高と看板とのgap。 */
const SETTINGS_ACTION_RESERVED_HEIGHT = 52;

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
 * 看板は小さい画面でもスクロールさせず、利用可能な幅と高さへcontain相当で均等に縮小する。
 */
export function AppUpdateNoticeDialog({ visible, source, notice, styles, onClose, onOpenStorePage }: AppUpdateNoticeDialogProps) {
  const { width, height } = useWindowDimensions();
  const isVisible = visible && source !== null && notice !== null;
  const maximumContentHeight = Math.max(0, Math.min(height * MAX_DIALOG_CONTENT_HEIGHT_RATIO, height - DIALOG_CHROME_RESERVED_HEIGHT));
  const maximumSignWidth = Math.max(0, Math.min(width - WINDOW_TO_DIALOG_CONTENT_HORIZONTAL_INSET, MAX_SIGN_WIDTH));
  const reservedActionHeight = source === 'settings' ? SETTINGS_ACTION_RESERVED_HEIGHT : 0;
  const maximumSignHeight = Math.max(0, maximumContentHeight - DIALOG_CONTENT_TOP_PADDING - reservedActionHeight);

  return (
    <Dialog visible={isVisible} swipeToClose autoClose={false} styles={styles} onClose={onClose}>
      {isVisible ? (
        <View testID="app-update-notice-dialog-content" style={[styles.appUpdateNoticeDialogContent, { maxHeight: maximumContentHeight }]}>
          <AppUpdateNoticeSign notice={notice} maxWidth={maximumSignWidth} maxHeight={maximumSignHeight} />
          {source === 'settings' ? <ActionPill label="ストアページへ" styles={styles} onPress={onOpenStorePage} /> : null}
        </View>
      ) : null}
    </Dialog>
  );
}
