/** Strollia の App Store 公開ページ URL。 */
export const STROLLIA_APP_STORE_URL = 'https://apps.apple.com/jp/app/id6777709044';

/** Strollia の Google Play 公開ページ URL。 */
export const STROLLIA_PLAY_STORE_URL = 'https://play.google.com/store/apps/details?id=com.kazuki19992.strollia';

/**
 * 実行中の OS に対応する Strollia のストア公開ページ URL を返す。
 *
 * Android 以外は、現在の公開先であり既存共有文言とも互換のある App Store を使う。
 */
export function getStrolliaStoreUrl(platformOS: string): string {
  return platformOS === 'android' ? STROLLIA_PLAY_STORE_URL : STROLLIA_APP_STORE_URL;
}
