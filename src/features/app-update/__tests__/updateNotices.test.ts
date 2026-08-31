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

  test('リリース準備前の既定通知は未提供(null)である', () => {
    expect(LATEST_UPDATE_NOTICE).toBeNull();
  });

  test('種別から固定の見出しと内容欄見出しを導出する', () => {
    expect(getAppUpdateNoticeText('feature')).toEqual({ heading: '新機能を\n追加しました', sectionTitle: '主な新機能' });
    expect(getAppUpdateNoticeText('fix')).toEqual({ heading: '不具合を\nなおしました', sectionTitle: '修正した不具合' });
  });

  test('項目数または文字数が不正なら表示しない', () => {
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => undefined);

    expect(resolveCurrentAppUpdateNotice({ ...featureNotice, items: [] }, '1.3.0')).toBeNull();
    expect(resolveCurrentAppUpdateNotice({ ...featureNotice, items: [''] }, '1.3.0')).toBeNull();
    expect(resolveCurrentAppUpdateNotice({ ...featureNotice, items: ['12345678901'] }, '1.3.0')).toBeNull();

    warnSpy.mockRestore();
  });

  test('不正な更新項目は開発時に内容を警告して表示しない', () => {
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => undefined);

    expect(resolveCurrentAppUpdateNotice({ ...featureNotice, items: [''] }, '1.3.0')).toBeNull();
    expect(warnSpy).toHaveBeenCalledWith('App update notice is ignored due to invalid items:', ['']);

    warnSpy.mockRestore();
  });

  test('重要順の3件以上の更新項目を持つ定義も解決する', () => {
    expect(resolveCurrentAppUpdateNotice(featureNotice, '1.3.0')).toEqual(featureNotice);
  });

  test('Unicode文字は10文字まで表示し、11文字は表示しない', () => {
    const tenCodePoints = '🚀'.repeat(10);
    const elevenCodePoints = '🚀'.repeat(11);
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => undefined);

    expect(resolveCurrentAppUpdateNotice({ ...featureNotice, items: [tenCodePoints] }, '1.3.0')).not.toBeNull();
    expect(resolveCurrentAppUpdateNotice({ ...featureNotice, items: [elevenCodePoints] }, '1.3.0')).toBeNull();

    warnSpy.mockRestore();
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
