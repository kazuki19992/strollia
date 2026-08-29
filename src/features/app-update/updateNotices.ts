export type AppUpdateNoticeKind = 'feature' | 'fix';
export type AppUpdateNoticeSource = 'automatic' | 'settings';

export type AppUpdateNotice = {
  version: string;
  kind: AppUpdateNoticeKind;
  heading: string;
  sectionTitle: string;
  items: readonly string[];
  showMore: boolean;
};

const KIND_CONTENT = {
  feature: { heading: '新機能を\n追加しました', sectionTitle: '主な新機能' },
  fix: { heading: '不具合を\nなおしました', sectionTitle: '修正した不具合' },
} as const;

export const LATEST_UPDATE_NOTICE: AppUpdateNotice | null = null;
export const LAST_ACKNOWLEDGED_UPDATE_NOTICE_VERSION_SETTING_KEY = 'lastAcknowledgedUpdateNoticeVersion';

/** 現在のアプリ版に対応し、表示内容の制約を満たす更新通知を解決する。 */
export function resolveCurrentAppUpdateNotice(
  notice: AppUpdateNotice | null,
  nativeApplicationVersion: string | null,
): AppUpdateNotice | null {
  if (!notice || !nativeApplicationVersion || notice.version !== nativeApplicationVersion) return null;
  const expected = KIND_CONTENT[notice.kind];
  const lengths = notice.items.map((item) => Array.from(item).length);
  if (notice.heading !== expected.heading || notice.sectionTitle !== expected.sectionTitle) return null;
  if (notice.items.length < 1 || notice.items.length > 2 || lengths.some((length) => length < 1 || length > 10)) return null;
  if (notice.showMore && notice.items.length !== 2) return null;
  return notice;
}

/** 初回チュートリアル完了済みの既存ユーザーへ、未読の通知だけを自動表示する。 */
export function shouldShowAutomaticAppUpdateNotice(params: {
  currentNotice: AppUpdateNotice | null;
  firstLaunchTutorialCompleted: boolean;
  lastAcknowledgedVersion: string;
}): boolean {
  return Boolean(
    params.firstLaunchTutorialCompleted && params.currentNotice && params.lastAcknowledgedVersion !== params.currentNotice.version,
  );
}
