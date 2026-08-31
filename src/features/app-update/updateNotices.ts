/** 更新通知の内容種別。 */
export type AppUpdateNoticeKind = 'feature' | 'fix';

/** 更新通知を表示する導線。 */
export type AppUpdateNoticeSource = 'automatic' | 'settings';

/** アプリ更新時に表示する通知の定義。 */
export type AppUpdateNotice = {
  version: string;
  /** 種別に応じて固定の見出し・内容欄見出しを導出する。 */
  kind: AppUpdateNoticeKind;
  /** 重要度順の更新項目。看板には先頭2件だけを描画し、3件目以降は「など……」で示す。 */
  items: readonly string[];
};

/** 種別ごとに固定された看板の見出し。 */
const KIND_TEXT = {
  feature: { heading: '新機能を\n追加しました', sectionTitle: '主な新機能' },
  fix: { heading: '不具合を\nなおしました', sectionTitle: '修正した不具合' },
} as const;

/** 現行リリースに対応する更新通知。未提供のリリースではnullを維持する。 */
export const LATEST_UPDATE_NOTICE: AppUpdateNotice | null = {
  version: '1.2.0',
  kind: 'feature',
  items: ['滞在場所機能を追加', '地図・写真などアプリの高速化', 'GPX取込を高速化'],
};

/** SQLiteのapp_settingsに保存する、更新通知の最終既読版キー。 */
export const LAST_ACKNOWLEDGED_UPDATE_NOTICE_VERSION_SETTING_KEY = 'lastAcknowledgedUpdateNoticeVersion';

/** 種別から、工事看板に表示する固定の見出しと内容欄見出しを返す。 */
export function getAppUpdateNoticeText(kind: AppUpdateNoticeKind): (typeof KIND_TEXT)[AppUpdateNoticeKind] {
  return KIND_TEXT[kind];
}

/** 現在のアプリ版に対応し、表示内容の制約を満たす更新通知を解決する。 */
export function resolveCurrentAppUpdateNotice(
  notice: AppUpdateNotice | null,
  nativeApplicationVersion: string | null,
): AppUpdateNotice | null {
  if (!notice || !nativeApplicationVersion || notice.version !== nativeApplicationVersion) return null;
  const invalidItems = notice.items.filter((item) => {
    const length = Array.from(item).length;
    return length < 1 || length > 20;
  });
  if (notice.items.length < 1 || invalidItems.length > 0) {
    if (process.env.NODE_ENV !== 'production') {
      console.warn('App update notice is ignored due to invalid items:', invalidItems);
    }
    return null;
  }
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
