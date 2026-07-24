import {
  CRASH_REPORTING_SETTING_DESCRIPTION,
  CRASH_REPORTING_SETTING_KEY,
  CRASH_REPORTING_TOGGLE_LABEL,
  CRASH_REPORTING_TUTORIAL_PARAGRAPHS,
  CRASH_REPORTING_TUTORIAL_TITLE,
  getAutoRecordNote,
} from '@/ui/appText';

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

  describe('不具合レポート設定の文言', () => {
    it('設定キーとラベルが確定値と一致する', () => {
      expect(CRASH_REPORTING_SETTING_KEY).toBe('crashReportingEnabled');
      expect(CRASH_REPORTING_TOGGLE_LABEL).toBe('不具合レポートを送る');
    });

    it('設定説明文が確定文面と一致する', () => {
      expect(CRASH_REPORTING_SETTING_DESCRIPTION).toBe(
        'アプリが固まったり、落ちたりしたときなどの不具合の記録を開発者に自動で送ります。あなたの位置情報や移動記録など、あなたを特定できてしまう情報は送りません。有効にしておくと不具合改善が早くなります。',
      );
    });

    it('チュートリアル文面が確定内容と一致する', () => {
      expect(CRASH_REPORTING_TUTORIAL_TITLE).toBe('不具合レポートについて');
      expect(CRASH_REPORTING_TUTORIAL_PARAGRAPHS).toEqual([
        'あなたの位置情報や移動記録は、これまで通り外部に送りません。',
        'ただし、アプリが固まったり落ちたりしたときの不具合の記録だけは、改善のために開発者へ自動で送ります(あなたを特定できる情報は含みません)。下のスイッチか設定画面で切り替えられます。',
        'アプリ改善にご協力をお願いします。',
      ]);
    });
  });
});
