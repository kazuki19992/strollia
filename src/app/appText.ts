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
