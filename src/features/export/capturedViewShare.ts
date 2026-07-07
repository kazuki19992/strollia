import { Alert } from 'react-native';
import * as Sharing from 'expo-sharing';
import { captureRef } from 'react-native-view-shot';
import type { View } from 'react-native';
import type { CaptureOptions } from 'react-native-view-shot';

/** ビューキャプチャ共有のオプション。 */
export type ShareCapturedViewOptions = {
  /** 共有シートに表示するダイアログタイトル。 */
  dialogTitle: string;
  /**
   * 共有失敗時に表示するフォールバックメッセージ。
   * エラーが `Error` インスタンスの場合はそのメッセージを優先する。
   */
  errorFallbackMessage: string;
  /**
   * `captureRef` に渡すオプション。指定しない場合は PNG・品質 1・tmpfile を使う。
   * 3画面はすべて同じオプションを使っているため、通常は省略してよい。
   */
  captureOptions?: CaptureOptions;
  /**
   * キャプチャ前に実行する非同期処理。
   * 地図タイル描画完了の待機など、画面によって異なる前処理をここで行う。
   * 処理後に共有を中断すべき場合は、`shouldAbort` を一緒に渡すこと。
   */
  onBeforeCapture?: () => Promise<void>;
  /**
   * キャプチャ直前（`onBeforeCapture` 完了後）と直後に呼ばれる中断判定。
   * `true` を返すと共有処理を中断する。
   * 画面から離れたり非同期操作が外部からキャンセルされた場合に使う。
   */
  shouldAbort?: () => boolean;
  /**
   * `finally` ブロックで実行する後処理。
   * 共有フラグのリセットなど画面ごとのクリーンアップに使う。
   */
  onFinally?: () => void;
};

/**
 * 指定したビューをPNG画像にキャプチャし、OSの共有シートで共有する。
 *
 * AchievementDialog・DailyLogDetailScreen・MonthlyReportScreen の3画面が持つ
 * ほぼ同一の「captureRef → isAvailableAsync → shareAsync」フローを一か所に集約する。
 * 画面ごとの差分（ダイアログタイトル・エラー文言・前処理・中断判定・後処理）は
 * オプション引数で吸収する。
 *
 * 共有不可な環境・キャプチャ失敗・共有失敗のいずれも Alert で通知し、
 * Promise は常に正常終了する（エラーは内部で処理する）。
 *
 * @param viewRef キャプチャ対象の View への ref。
 * @param options 共有動作を制御するオプション。
 */
export async function shareViewAsPng(viewRef: React.RefObject<View | null>, options: ShareCapturedViewOptions): Promise<void> {
  const { dialogTitle, errorFallbackMessage, captureOptions, onBeforeCapture, shouldAbort, onFinally } = options;

  try {
    if (onBeforeCapture) {
      await onBeforeCapture();
    }

    // onBeforeCapture 完了後（地図ロード待ち等）に中断判定する。
    if (shouldAbort?.()) {
      return;
    }

    if (!(await Sharing.isAvailableAsync())) {
      Alert.alert('共有できません', 'この環境では共有シートを利用できません。');
      return;
    }

    if (!viewRef.current) {
      return;
    }

    const resolvedCaptureOptions: CaptureOptions = captureOptions ?? { format: 'png', quality: 1, result: 'tmpfile' };
    const uri = await captureRef(viewRef.current, resolvedCaptureOptions);

    // キャプチャ後にも中断判定する（非同期待機中に画面を離れた場合を考慮）。
    if (shouldAbort?.()) {
      return;
    }

    await Sharing.shareAsync(uri, {
      dialogTitle,
      mimeType: 'image/png',
      UTI: 'public.png',
    });
  } catch (error: unknown) {
    // shouldAbort が true の場合は画面を離れたことによる中断であり、アラートは出さない。
    if (!shouldAbort?.()) {
      Alert.alert('共有失敗', error instanceof Error ? error.message : errorFallbackMessage);
    }
  } finally {
    onFinally?.();
  }
}
