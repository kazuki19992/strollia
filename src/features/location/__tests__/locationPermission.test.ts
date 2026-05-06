import { canRequestLocationPermissionInApp, hasRequiredLocationPermission } from '../locationPermission';

describe('位置情報権限ヘルパー', () => {
  it('フォアグラウンドとバックグラウンドの両方の権限を必要とする', () => {
    expect(hasRequiredLocationPermission({
      foregroundGranted: true,
      backgroundGranted: true,
      canAskForeground: true,
      canAskBackground: true,
    })).toBe(true);

    expect(hasRequiredLocationPermission({
      foregroundGranted: true,
      backgroundGranted: false,
      canAskForeground: true,
      canAskBackground: true,
    })).toBe(false);
  });

  it('フォアグラウンド権限を先に要求してからバックグラウンド権限を要求する', () => {
    expect(canRequestLocationPermissionInApp({
      foregroundGranted: false,
      backgroundGranted: false,
      canAskForeground: true,
      canAskBackground: false,
    })).toBe(true);

    expect(canRequestLocationPermissionInApp({
      foregroundGranted: true,
      backgroundGranted: false,
      canAskForeground: false,
      canAskBackground: false,
    })).toBe(false);
  });
});
