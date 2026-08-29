import { AutoStartStatus } from './appTypes';

/**
 * 自動記録状態を設定画面向けの説明文へ変換する。
 *
 * @param status - 自動GPS記録の現在状態。
 * @returns 設定画面に表示する日本語の補足文。
 */
export function getAutoRecordNote(status: AutoStartStatus): string {
  switch (status) {
    case 'checking':
      return '自動記録の状態を確認しています。';
    case 'recording':
      return 'GPSログをバックグラウンドで自動保存しています。';
    case 'needsPermission':
      return '位置情報権限を許可すると自動で記録を開始します。';
    case 'failed':
      return '自動記録を開始できませんでした。記録を始めるには手動で再試行してください。';
  }
}

/** 不具合レポート送信設定の永続化キー。 */
export const CRASH_REPORTING_SETTING_KEY = 'crashReportingEnabled';

/** 不具合レポートトグルのラベル(設定画面・チュートリアル共通)。 */
export const CRASH_REPORTING_TOGGLE_LABEL = '不具合レポートを送る';

/** 滞在場所の設定画面へ進む設定行の見出し。 */
export const STAY_PLACES_SETTING_LABEL = '滞在場所';

/** 滞在場所の設定行に表示する説明文。 */
export const STAY_PLACES_SETTING_DESCRIPTION =
  '登録した場所の周辺ではGPSの揺れを抑え、共有するルートから指定した範囲を隠せます。無料版では最初に登録した1か所を使えます。';

/**
 * 地図の背後で写真ライブラリの差分走査が動いていることを知らせる文言。
 *
 * 保存済みの写真はすでに表示されているため、「読み込み中」ではなく「確認中」であることが
 * 伝わる言い回しにする(設計書 §4.2)。
 */
export const PHOTO_LIBRARY_SCANNING_MESSAGE = '写真ライブラリの新しい写真を確認しています...';

/** 写真ライブラリの全件再読み込み中に出すブロッキングダイアログの見出し。 */
export const PHOTO_LIBRARY_SYNC_DIALOG_TITLE = '写真ライブラリを読み込んでいます...';

/**
 * 全件再読み込みダイアログの説明文。
 *
 * 走査中に地図を操作されると競合で1.6倍遅くなる(設計書 §2.1)。操作を止めていることが
 * 不親切に見えないよう、待つ理由が伝わる文にする。
 */
export const PHOTO_LIBRARY_SYNC_DIALOG_DESCRIPTION = 'すべての写真を確認しています。読み込みが終わるまで、そのままお待ちください。';

/** 全件再読み込みに失敗したときのタイトル。 */
export const PHOTO_LIBRARY_SYNC_FAILURE_TITLE = '写真ライブラリを読み込めませんでした';

/** 全件再読み込みに失敗したときの既定メッセージ。 */
export const PHOTO_LIBRARY_SYNC_FAILURE_MESSAGE = '時間をおいて、もう一度お試しください。';

/**
 * 走査の進捗を「N件中M件」の文言にする。
 *
 * @param progress - 総数と処理済み件数。
 * @returns 進捗を表す日本語の文言。
 */
export function formatPhotoLibrarySyncProgress(progress: { totalAssetCount: number; processedAssetCount: number }): string {
  return `${progress.totalAssetCount}件中${progress.processedAssetCount}件`;
}

/** 設定画面の不具合レポート項目の説明文。 */
export const CRASH_REPORTING_SETTING_DESCRIPTION =
  'アプリが固まったり、落ちたりしたときなどの不具合の記録を開発者に自動で送ります。あなたの位置情報や移動記録など、あなたを特定できてしまう情報は送りません。有効にしておくと不具合改善が早くなります。';

/** 初回チュートリアルの不具合レポート告知ステップのタイトル。 */
export const CRASH_REPORTING_TUTORIAL_TITLE = '不具合レポートについて';

/** 初回チュートリアルの不具合レポート告知ステップの本文段落。 */
export const CRASH_REPORTING_TUTORIAL_PARAGRAPHS = [
  'あなたの位置情報や移動記録は、これまで通り外部に送りません。',
  'ただし、アプリが固まったり落ちたりしたときの不具合の記録だけは、改善のために開発者へ自動で送ります(あなたを特定できる情報は含みません)。下のスイッチか設定画面で切り替えられます。',
  'アプリ改善にご協力をお願いします。',
];
