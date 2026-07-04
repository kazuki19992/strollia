import { shouldStartRecordingAutomatically } from '@/app/autoRecording';
import { LocationPermissionState } from '@/features/location/locationPermission';

const grantedPermissions: LocationPermissionState = {
  foregroundGranted: true,
  backgroundGranted: true,
  canAskForeground: true,
  canAskBackground: true,
};

describe('自動GPS記録判定 shouldStartRecordingAutomatically', () => {
  it('権限が揃っていて未記録なら自動開始する', () => {
    expect(
      shouldStartRecordingAutomatically({
        permissions: grantedPermissions,
        isRecording: false,
        isAutoStartInFlight: false,
      }),
    ).toBe(true);
  });

  it('すでに記録中なら自動開始しない', () => {
    expect(
      shouldStartRecordingAutomatically({
        permissions: grantedPermissions,
        isRecording: true,
        isAutoStartInFlight: false,
      }),
    ).toBe(false);
  });

  it('バックグラウンド権限がない場合は自動開始しない', () => {
    expect(
      shouldStartRecordingAutomatically({
        permissions: { ...grantedPermissions, backgroundGranted: false },
        isRecording: false,
        isAutoStartInFlight: false,
      }),
    ).toBe(false);
  });

  it('フォアグラウンド権限がない場合は自動開始しない', () => {
    expect(
      shouldStartRecordingAutomatically({
        permissions: { ...grantedPermissions, foregroundGranted: false },
        isRecording: false,
        isAutoStartInFlight: false,
      }),
    ).toBe(false);
  });

  it('自動開始処理中なら重複して開始しない', () => {
    expect(
      shouldStartRecordingAutomatically({
        permissions: grantedPermissions,
        isRecording: false,
        isAutoStartInFlight: true,
      }),
    ).toBe(false);
  });
});
