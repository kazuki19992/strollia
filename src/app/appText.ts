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
      return '自動記録は有効です。GPSログをバックグラウンドで保存します。';
    case 'needsPermission':
      return '自動記録は待機中です。位置情報権限を許可すると記録できます。';
    case 'failed':
      return '自動記録を開始できませんでした。設定から権限と記録状態を確認してください。';
  }
}
