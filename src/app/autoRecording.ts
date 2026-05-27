import { hasRequiredLocationPermission, LocationPermissionState } from '../features/location/locationPermission';

/** 自動GPS記録開始判定に必要な状態。 */
export type AutoRecordingDecisionInput = {
  /** 現在の位置情報権限状態。 */
  permissions: LocationPermissionState;
  /** Expo Locationのバックグラウンド更新が開始済みか。 */
  isRecording: boolean;
  /** 自動開始処理がすでに実行中か。 */
  isAutoStartInFlight: boolean;
};

/** 権限許可後にGPS記録を自動開始すべきか返す。 */
export function shouldStartRecordingAutomatically({
  permissions,
  isRecording,
  isAutoStartInFlight,
}: AutoRecordingDecisionInput): boolean {
  return hasRequiredLocationPermission(permissions) && !isRecording && !isAutoStartInFlight;
}
