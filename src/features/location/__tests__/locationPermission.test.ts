import { canRequestLocationPermissionInApp, hasRequiredLocationPermission } from '../locationPermission';

describe('locationPermission helpers', () => {
  it('requires both foreground and background permission', () => {
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

  it('requests foreground first, then background', () => {
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
