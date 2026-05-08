import { useEffect } from 'react';
import { AppStateStatus } from 'react-native';
import { activateKeepAwakeAsync, deactivateKeepAwake } from 'expo-keep-awake';

/** 画面ON維持hookの引数。 */
export type UseKeepScreenAwakeArgs = {
  /** 画面ON維持設定。 */
  enabled: boolean;
  /** 現在のアプリ状態。 */
  appState: AppStateStatus;
  /** expo-keep-awakeへ渡すタグ。 */
  tag: string;
};

/** フォアグラウンド中だけ画面ON維持を有効化し、終了時に必ず解除する。 */
export function useKeepScreenAwake({ enabled, appState, tag }: UseKeepScreenAwakeArgs): void {
  useEffect(() => {
    if (enabled && appState === 'active') {
      activateKeepAwakeAsync(tag).catch(() => undefined);
      return;
    }

    deactivateKeepAwake(tag).catch(() => undefined);
  }, [appState, enabled, tag]);

  useEffect(() => {
    return () => {
      deactivateKeepAwake(tag).catch(() => undefined);
    };
  }, [tag]);
}
