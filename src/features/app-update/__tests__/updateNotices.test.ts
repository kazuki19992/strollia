import {
  getAppUpdateNoticeText,
  LATEST_UPDATE_NOTICE,
  resolveCurrentAppUpdateNotice,
  shouldShowAutomaticAppUpdateNotice,
  type AppUpdateNotice,
} from '@/features/app-update/updateNotices';

const featureNotice: AppUpdateNotice = {
  version: '1.3.0',
  kind: 'feature',
  items: ['地図を改善', '検索を追加', '表示を改善'],
};

describe('アプリ更新通知定義', () => {
  test('現在版と通知版が完全一致する場合だけ通知を解決する', () => {
    expect(resolveCurrentAppUpdateNotice(featureNotice, '1.3.0')).toEqual(featureNotice);
    expect(resolveCurrentAppUpdateNotice(featureNotice, '1.3.1')).toBeNull();
    expect(resolveCurrentAppUpdateNotice(featureNotice, '1.3')).toBeNull();
    expect(resolveCurrentAppUpdateNotice(featureNotice, null)).toBeNull();
  });

  test('通知定義がないリリースでは表示しない', () => {
    expect(resolveCurrentAppUpdateNotice(null, '1.3.0')).toBeNull();
  });

  test('v1.2.0の更新通知は承認済みの重要順で定義されている', () => {
    expect(LATEST_UPDATE_NOTICE).toEqual({
      version: '1.2.0',
      kind: 'feature',
      items: ['滞在場所機能を追加', '地図・写真などアプリの高速化', 'GPX取込を高速化'],
    });
  });

  test('種別から固定の見出しと内容欄見出しを導出する', () => {
    expect(getAppUpdateNoticeText('feature')).toEqual({ heading: '新機能を\n追加しました', sectionTitle: '主な新機能' });
    expect(getAppUpdateNoticeText('fix')).toEqual({ heading: '不具合を\nなおしました', sectionTitle: '修正した不具合' });
  });

  test('項目数または文字数が不正なら表示しない', () => {
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => undefined);

    try {
      expect(resolveCurrentAppUpdateNotice({ ...featureNotice, items: [] }, '1.3.0')).toBeNull();
      expect(resolveCurrentAppUpdateNotice({ ...featureNotice, items: [''] }, '1.3.0')).toBeNull();
      expect(resolveCurrentAppUpdateNotice({ ...featureNotice, items: ['123456789012345678901'] }, '1.3.0')).toBeNull();
    } finally {
      warnSpy.mockRestore();
    }
  });

  test('不正な更新項目は開発時に内容を警告して表示しない', () => {
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => undefined);

    try {
      expect(resolveCurrentAppUpdateNotice({ ...featureNotice, items: [''] }, '1.3.0')).toBeNull();
      expect(warnSpy).toHaveBeenCalledWith('App update notice is ignored due to invalid items:', ['']);
    } finally {
      warnSpy.mockRestore();
    }
  });

  test('重要順の3件以上の更新項目を持つ定義も解決する', () => {
    expect(resolveCurrentAppUpdateNotice(featureNotice, '1.3.0')).toEqual(featureNotice);
  });

  test('Unicode文字は20文字まで表示し、21文字は表示しない', () => {
    const twentyCodePoints = '🚀'.repeat(20);
    const twentyOneCodePoints = '🚀'.repeat(21);
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => undefined);

    try {
      expect(resolveCurrentAppUpdateNotice({ ...featureNotice, items: [twentyCodePoints] }, '1.3.0')).not.toBeNull();
      expect(resolveCurrentAppUpdateNotice({ ...featureNotice, items: [twentyOneCodePoints] }, '1.3.0')).toBeNull();
    } finally {
      warnSpy.mockRestore();
    }
  });

  test('既存ユーザーかつ未読の現在版だけ自動表示する', () => {
    expect(
      shouldShowAutomaticAppUpdateNotice({
        currentNotice: featureNotice,
        firstLaunchTutorialCompleted: true,
        lastAcknowledgedVersion: '',
      }),
    ).toBe(true);
    expect(
      shouldShowAutomaticAppUpdateNotice({
        currentNotice: featureNotice,
        firstLaunchTutorialCompleted: false,
        lastAcknowledgedVersion: '',
      }),
    ).toBe(false);
    expect(
      shouldShowAutomaticAppUpdateNotice({
        currentNotice: featureNotice,
        firstLaunchTutorialCompleted: true,
        lastAcknowledgedVersion: '1.3.0',
      }),
    ).toBe(false);
  });
});
