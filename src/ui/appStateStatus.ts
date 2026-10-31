import type { AppStateStatus } from 'react-native';

/** AppStateStatus として扱える既知の状態。 */
const KNOWN_APP_STATE_STATUSES: readonly AppStateStatus[] = ['active', 'background', 'inactive', 'extension', 'unknown'];

/**
 * AppState.currentState の値を AppStateStatus に変換する。
 *
 * React Native 0.88 から AppState.currentState の型が `string | null | undefined` に広がったため、
 * 起動直後でまだ状態を取得できていない場合や未知の値は 'unknown' として扱う。
 */
export function resolveAppStateStatus(state: string | null | undefined): AppStateStatus {
  return KNOWN_APP_STATE_STATUSES.find((status) => status === state) ?? 'unknown';
}
