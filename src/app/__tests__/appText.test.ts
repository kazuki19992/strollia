import { getAutoRecordNote } from '../appText';

describe('自動記録ステータス文言 getAutoRecordNote', () => {
  it('記録中の場合はバックグラウンド保存中であることを説明する', () => {
    expect(getAutoRecordNote('recording')).toContain('バックグラウンド');
  });

  it('権限待ちの場合は権限許可が必要であることを説明する', () => {
    expect(getAutoRecordNote('needsPermission')).toContain('位置情報権限');
  });
});
