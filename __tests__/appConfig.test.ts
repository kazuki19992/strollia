// eslint-disable-next-line no-restricted-imports -- src/ 外の Expo 設定ファイルを参照するため @/ エイリアス不使用
import appConfig, { shouldRelaxAppTransportSecurity } from '../app.config';
import appJson from '../app.json'; // eslint-disable-line no-restricted-imports -- src/ 外の Expo 設定ファイルを参照するため @/ エイリアス不使用

const staticExpo = appJson.expo as any;

/**
 * ConfigContext のうち app.config.ts が参照する config だけを与える。
 * ビルドプロファイルを指定した場合は EXPO_PUBLIC_STROLLIA_BUILD_PROFILE も差し替える。
 */
function buildConfig(env?: string, buildProfile?: string) {
  const original = process.env.GOOGLE_MAPS_ANDROID_API_KEY;
  const originalProfile = process.env.EXPO_PUBLIC_STROLLIA_BUILD_PROFILE;

  if (env === undefined) {
    delete process.env.GOOGLE_MAPS_ANDROID_API_KEY;
  } else {
    process.env.GOOGLE_MAPS_ANDROID_API_KEY = env;
  }

  if (buildProfile === undefined) {
    delete process.env.EXPO_PUBLIC_STROLLIA_BUILD_PROFILE;
  } else {
    process.env.EXPO_PUBLIC_STROLLIA_BUILD_PROFILE = buildProfile;
  }

  try {
    return (appConfig as any)({ config: staticExpo });
  } finally {
    if (original === undefined) {
      delete process.env.GOOGLE_MAPS_ANDROID_API_KEY;
    } else {
      process.env.GOOGLE_MAPS_ANDROID_API_KEY = original;
    }
    if (originalProfile === undefined) {
      delete process.env.EXPO_PUBLIC_STROLLIA_BUILD_PROFILE;
    } else {
      process.env.EXPO_PUBLIC_STROLLIA_BUILD_PROFILE = originalProfile;
    }
  }
}

describe('app.config.ts (Android Google Maps キー注入)', () => {
  it('環境変数のキーを android.config.googleMaps.apiKey に注入する', () => {
    const result = buildConfig('TEST_ANDROID_MAPS_KEY');

    expect(result.android.config.googleMaps.apiKey).toBe('TEST_ANDROID_MAPS_KEY');
  });

  it('環境変数が無いときは apiKey が undefined になる(iOSビルドや未設定時に壊れない)', () => {
    const result = buildConfig(undefined);

    expect(result.android.config.googleMaps.apiKey).toBeUndefined();
  });

  it('環境変数が空文字/空白のときも apiKey は undefined になる(.envテンプレのまま=未設定扱い)', () => {
    expect(buildConfig('').android.config.googleMaps.apiKey).toBeUndefined();
    expect(buildConfig('   ').android.config.googleMaps.apiKey).toBeUndefined();
  });

  it('productionビルドではiOS設定(infoPlist・bundleIdentifier)を app.json のまま保持する', () => {
    const result = buildConfig('TEST_ANDROID_MAPS_KEY', 'production');

    expect(result.ios).toEqual(staticExpo.ios);
  });

  it('plugins を app.json のまま保持する', () => {
    const result = buildConfig('TEST_ANDROID_MAPS_KEY');

    expect(result.plugins).toEqual(staticExpo.plugins);
  });

  it('Android の既存設定(package・permissions)を保持する', () => {
    const result = buildConfig('TEST_ANDROID_MAPS_KEY');

    expect(result.android.package).toBe(staticExpo.android.package);
    expect(result.android.permissions).toEqual(staticExpo.android.permissions);
  });
});

describe('ATS緩和の判定 shouldRelaxAppTransportSecurity', () => {
  it('developmentプロファイルでは緩和する', () => {
    expect(shouldRelaxAppTransportSecurity('development')).toBe(true);
  });

  it('プロファイル未指定(expo run:ios などのローカル実行)では緩和する', () => {
    expect(shouldRelaxAppTransportSecurity(undefined)).toBe(true);
  });

  it('previewプロファイルでは緩和しない', () => {
    expect(shouldRelaxAppTransportSecurity('preview')).toBe(false);
  });

  it('productionプロファイルでは緩和しない', () => {
    expect(shouldRelaxAppTransportSecurity('production')).toBe(false);
  });
});

describe('app.config.ts (ATS注入)', () => {
  it('developmentビルドではNSAllowsArbitraryLoadsを許可する(Tailscale等の非ローカルIP経由のMetro接続対応)', () => {
    const result = buildConfig('TEST_ANDROID_MAPS_KEY', 'development');

    expect(result.ios.infoPlist.NSAppTransportSecurity).toEqual({
      NSAllowsArbitraryLoads: true,
      NSAllowsLocalNetworking: true,
    });
    // 既存の infoPlist 設定は維持される
    expect(result.ios.infoPlist.CFBundleDevelopmentRegion).toBe(staticExpo.ios.infoPlist.CFBundleDevelopmentRegion);
    expect(result.ios.bundleIdentifier).toBe(staticExpo.ios.bundleIdentifier);
  });

  it('プロファイル未指定のローカル実行でもATSを緩和する', () => {
    const result = buildConfig('TEST_ANDROID_MAPS_KEY', undefined);

    expect(result.ios.infoPlist.NSAppTransportSecurity).toEqual({
      NSAllowsArbitraryLoads: true,
      NSAllowsLocalNetworking: true,
    });
  });

  it('preview / productionビルドではATS設定を注入しない(https必須の既定を維持)', () => {
    expect(buildConfig('TEST_ANDROID_MAPS_KEY', 'preview').ios.infoPlist.NSAppTransportSecurity).toBeUndefined();
    expect(buildConfig('TEST_ANDROID_MAPS_KEY', 'production').ios.infoPlist.NSAppTransportSecurity).toBeUndefined();
  });
});
