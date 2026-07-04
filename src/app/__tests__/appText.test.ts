import { getAutoRecordNote } from '@/app/appText';

describe('自動記録ステータス文言 getAutoRecordNote', () => {
  it('確認中の場合は自動記録の状態確認中であることを説明する', () => {
    expect(getAutoRecordNote('checking')).toBe('自動記録の状態を確認しています。');
  });

  it('記録中の場合はバックグラウンドで自動保存中であることを説明する', () => {
    expect(getAutoRecordNote('recording')).toBe('GPSログをバックグラウンドで自動保存しています。');
  });

  it('権限待ちの場合は権限許可後に自動開始することを説明する', () => {
    expect(getAutoRecordNote('needsPermission')).toBe('位置情報権限を許可すると自動で記録を開始します。');
  });

  it('失敗時は手動再試行できることを説明する', () => {
    expect(getAutoRecordNote('failed')).toBe('自動記録を開始できませんでした。記録を始めるには手動で再試行してください。');
  });
});
