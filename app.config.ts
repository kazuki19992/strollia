import type { ConfigContext, ExpoConfig } from 'expo/config';

/**
 * app.json を基にした動的設定。
 *
 * iOS 側の設定（infoPlist・plugins など）は app.json をそのまま引き継ぎ、
 * Android のみ Google Maps APIキーを環境変数から注入する。
 * 静的な app.json では process.env を読めないため、この dynamic config を経由する。
 *
 * キーは `.env.local`（ローカル）および EAS 環境変数（ビルド）に
 * `GOOGLE_MAPS_ANDROID_API_KEY` という名前で設定する。
 */
export default ({ config }: ConfigContext): ExpoConfig => ({
  ...(config as ExpoConfig),
  android: {
    ...config.android,
    config: {
      ...config.android?.config,
      googleMaps: {
        ...config.android?.config?.googleMaps,
        apiKey: process.env.GOOGLE_MAPS_ANDROID_API_KEY,
      },
    },
  },
});
