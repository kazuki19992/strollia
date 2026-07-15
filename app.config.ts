import type { ConfigContext, ExpoConfig } from 'expo/config';

/**
 * ATS(App Transport Security)を緩和してよいビルドプロファイルか判定する。
 *
 * RN 0.86 / SDK 57 のビルドは既定で `NSAllowsArbitraryLoads: false` +
 * `NSAllowsLocalNetworking: true` となり、Tailscale(100.64.0.0/10)などの
 * 非ローカルIP経由では Metro の http バンドル取得が ATS にブロックされる。
 * development ビルドおよびプロファイル未指定のローカル実行(`expo run:ios` 等)のみ
 * ATS を緩和する。未知のプロファイル名は安全側に倒して緩和しない(fail closed)。
 */
export function shouldRelaxAppTransportSecurity(buildProfile: string | undefined): boolean {
  return buildProfile === undefined || buildProfile === 'development';
}

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
  ios: {
    ...config.ios,
    infoPlist: {
      ...config.ios?.infoPlist,
      // 開発時のみ Metro への http 接続を許可する(Tailscale 等の非ローカルIP対応)
      ...(shouldRelaxAppTransportSecurity(process.env.EXPO_PUBLIC_STROLLIA_BUILD_PROFILE)
        ? { NSAppTransportSecurity: { NSAllowsArbitraryLoads: true, NSAllowsLocalNetworking: true } }
        : {}),
    },
  },
  android: {
    ...config.android,
    config: {
      ...config.android?.config,
      googleMaps: {
        ...config.android?.config?.googleMaps,
        // 空文字（.env テンプレのまま等）は未設定として扱い、不正キーの注入を防ぐ。
        apiKey: process.env.GOOGLE_MAPS_ANDROID_API_KEY?.trim() || undefined,
      },
    },
  },
});
