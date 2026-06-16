import appConfig from '../app.config';
import appJson from '../app.json';

const staticExpo = appJson.expo as any;

/** ConfigContext のうち app.config.ts が参照する config だけを与える。 */
function buildConfig(env?: string) {
  const original = process.env.GOOGLE_MAPS_ANDROID_API_KEY;

  if (env === undefined) {
    delete process.env.GOOGLE_MAPS_ANDROID_API_KEY;
  } else {
    process.env.GOOGLE_MAPS_ANDROID_API_KEY = env;
  }

  try {
    return (appConfig as any)({ config: staticExpo });
  } finally {
    if (original === undefined) {
      delete process.env.GOOGLE_MAPS_ANDROID_API_KEY;
    } else {
      process.env.GOOGLE_MAPS_ANDROID_API_KEY = original;
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

  it('iOS設定(infoPlist・bundleIdentifier)を app.json のまま保持する', () => {
    const result = buildConfig('TEST_ANDROID_MAPS_KEY');

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
