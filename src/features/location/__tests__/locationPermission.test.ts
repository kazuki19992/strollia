import { canRequestLocationPermissionInApp, hasRequiredLocationPermission, isWhileInUseOnlyMode } from '../locationPermission';

describe('位置情報権限ヘルパー', () => {
  it('フォアグラウンドとバックグラウンドの両方の権限を必要とする', () => {
    expect(
      hasRequiredLocationPermission({
        foregroundGranted: true,
        backgroundGranted: true,
        canAskForeground: true,
        canAskBackground: true,
      }),
    ).toBe(true);

    expect(
      hasRequiredLocationPermission({
        foregroundGranted: true,
        backgroundGranted: false,
        canAskForeground: true,
        canAskBackground: true,
      }),
    ).toBe(false);
  });

  it('フォアグラウンド権限を先に要求してからバックグラウンド権限を要求する', () => {
    expect(
      canRequestLocationPermissionInApp({
        foregroundGranted: false,
        backgroundGranted: false,
        canAskForeground: true,
        canAskBackground: false,
      }),
    ).toBe(true);

    expect(
      canRequestLocationPermissionInApp({
        foregroundGranted: true,
        backgroundGranted: false,
        canAskForeground: false,
        canAskBackground: false,
      }),
    ).toBe(false);
  });

  it('フォアグラウンドのみ許可(背景なし)を「アプリ起動中のみ記録」モードと判定する(誤るとマップに権限エラーパネルが誤表示される)', () => {
    expect(
      isWhileInUseOnlyMode({
        foregroundGranted: true,
        backgroundGranted: false,
        canAskForeground: false,
        canAskBackground: false,
      }),
    ).toBe(true);
  });

  it('背景も許可済み(常時許可)ならモードではない(誤判定すると常時記録中なのにトースト/専用パネルが誤表示される)', () => {
    expect(
      isWhileInUseOnlyMode({
        foregroundGranted: true,
        backgroundGranted: true,
        canAskForeground: false,
        canAskBackground: false,
      }),
    ).toBe(false);
  });

  it('フォアグラウンド未許可ならモードではない(誤判定すると権限要求すべき場面でエラーパネルを隠してしまう)', () => {
    expect(
      isWhileInUseOnlyMode({
        foregroundGranted: false,
        backgroundGranted: false,
        canAskForeground: true,
        canAskBackground: false,
      }),
    ).toBe(false);
  });
});
