import {
  resolveCurrentAppUpdateNotice,
  shouldShowAutomaticAppUpdateNotice,
  type AppUpdateNotice,
} from '@/features/app-update/updateNotices';

const featureNotice: AppUpdateNotice = {
  version: '1.3.0',
  kind: 'feature',
  heading: '新機能を\n追加しました',
  sectionTitle: '主な新機能',
  items: ['地図を改善', '検索を追加'],
  showMore: true,
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

  test('項目数・文字数・種別固定文言が不正なら表示しない', () => {
    expect(resolveCurrentAppUpdateNotice({ ...featureNotice, items: [] }, '1.3.0')).toBeNull();
    expect(resolveCurrentAppUpdateNotice({ ...featureNotice, items: ['12345678901'] }, '1.3.0')).toBeNull();
    expect(resolveCurrentAppUpdateNotice({ ...featureNotice, heading: '任意見出し' }, '1.3.0')).toBeNull();
    expect(resolveCurrentAppUpdateNotice({ ...featureNotice, showMore: true, items: ['地図を改善'] }, '1.3.0')).toBeNull();
  });

  test('更新項目が3件ある定義は表示しない', () => {
    expect(resolveCurrentAppUpdateNotice({ ...featureNotice, items: ['地図を改善', '検索を追加', '表示を改善'] }, '1.3.0')).toBeNull();
  });

  test('Unicode文字は10文字まで表示し、11文字は表示しない', () => {
    const tenCodePoints = '🚀'.repeat(10);
    const elevenCodePoints = '🚀'.repeat(11);
    expect(resolveCurrentAppUpdateNotice({ ...featureNotice, items: [tenCodePoints], showMore: false }, '1.3.0')).not.toBeNull();
    expect(resolveCurrentAppUpdateNotice({ ...featureNotice, items: [elevenCodePoints], showMore: false }, '1.3.0')).toBeNull();
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
