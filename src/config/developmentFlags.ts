/** 開発用フラグの値として扱う環境変数値。 */
const ENABLED_ENV_VALUE = 'true';

/** 開発・検証用の一時フラグを集約する。 */
export const developmentFlags: Record<
  'enablePremiumAccessWithoutRevenueCat' | 'resetAchievementsOnLaunch' | 'logVisitedGridMetrics' | 'logPhotoScanMetrics',
  boolean
> = {
  /** RevenueCat導入前にStrollia Plus特典を仮に有効化する。 */
  enablePremiumAccessWithoutRevenueCat: process.env.EXPO_PUBLIC_ENABLE_PREMIUM_ACCESS_WITHOUT_REVENUECAT === ENABLED_ENV_VALUE,
  /** 開発中に起動時の実績解除状態と通知キューをリセットして再評価する。 */
  resetAchievementsOnLaunch: process.env.EXPO_PUBLIC_RESET_ACHIEVEMENTS_ON_LAUNCH === ENABLED_ENV_VALUE,
  /** Visited Grid Overlayの取得・結合・描画コストを開発中に確認する。 */
  logVisitedGridMetrics: process.env.EXPO_PUBLIC_LOG_VISITED_GRID_METRICS === ENABLED_ENV_VALUE,
  /**
   * 写真ライブラリ走査の内訳(件数・所要時間)を地図画面へ表示する。
   *
   * **走査上限の撤廃を実測で判断するための一時的な計測フラグ。** Sentryはproductionプロファイル
   * でしか送信しないため、preview ビルドで実コストを知るには画面に出すしかない。
   * 判断がついたら表示ごと削除する。
   */
  logPhotoScanMetrics: process.env.EXPO_PUBLIC_LOG_PHOTO_SCAN_METRICS === ENABLED_ENV_VALUE,
};

/**
 * 走査上限の上書き値を解釈する。
 *
 * 環境変数は文字列でしか渡せないため、`EXPO_PUBLIC_PHOTO_SCAN_LIMIT=たくさん` のような誤設定が
 * ありうる。NaNや0以下をそのまま走査上限へ流すと「写真が1枚も出ない」という壊れ方をするため、
 * **解釈できない値は上書きなし(null)へ倒し**、呼び出し側に既定の上限を使わせる。
 *
 * 小数は端数を切り捨てる。上限は件数であり、小数のまま `limit + 1` へ渡す意味がないため。
 *
 * @param rawValue - 環境変数の生の値。未設定の場合はundefined。
 * @returns 上書きとして採用できる1以上の整数。採用できない場合はnull。
 */
function parsePhotoScanLimitOverride(rawValue: string | undefined): number | null {
  if (rawValue === undefined) {
    return null;
  }

  const trimmed = rawValue.trim();
  // Number('') は 0 になり「0件走査」として通ってしまうため、空文字は先に弾く
  if (trimmed === '') {
    return null;
  }

  const parsed = Number(trimmed);

  if (!Number.isFinite(parsed) || parsed < 1) {
    return null;
  }

  return Math.floor(parsed);
}

/**
 * 写真ライブラリ走査の上限を上書きする値。
 *
 * **計測用の一時的な仕組み。** 走査上限の撤廃(Phase 2-c)を設計するために、実機で件数を変えて
 * コストを測れるようにしている。`developmentFlags` は boolean 固定の集合なので、数値である
 * この値は別の export として持つ。
 */
const photoScanLimitOverride: number | null = parsePhotoScanLimitOverride(process.env.EXPO_PUBLIC_PHOTO_SCAN_LIMIT);

/**
 * 写真ライブラリ走査の上限の上書き値を返す。
 *
 * **計測用の一時的な仕組み。** 未設定・不正値・0以下の場合はnullを返し、呼び出し側は既定の
 * 上限(`DEFAULT_PHOTO_SCAN_LIMIT`)を使う。
 *
 * @returns 上書きする走査上限。上書きしない場合はnull。
 */
export function getPhotoScanLimitOverride(): number | null {
  return photoScanLimitOverride;
}

/**
 * いずれかの開発用フラグが有効か。
 *
 * 走査上限の上書きは boolean フラグではないが、**通常と違う挙動のビルドである**ことに変わりは
 * ないため、画面上の「開発フラグ有効」表示の判定に含める。
 *
 * @returns 開発用フラグまたは走査上限の上書きが有効な場合はtrue。
 */
export function hasEnabledDevelopmentFlags(): boolean {
  return Object.values(developmentFlags).some(Boolean) || photoScanLimitOverride !== null;
}

/** 現在のビルドで起動時の実績リセット再評価を有効にするか。 */
export function shouldResetAchievementsOnLaunch(): boolean {
  return developmentFlags.resetAchievementsOnLaunch;
}
