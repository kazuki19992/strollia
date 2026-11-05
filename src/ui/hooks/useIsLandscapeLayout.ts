// useWindowDimensionsはテストで寸法を差し替えるため名前空間経由で参照する。
import * as ReactNative from 'react-native';

import { isLandscapeLayout } from '@/ui/landscapeLayout';

/** 現在のウィンドウが横画面レイアウト対象かを返す。回転・分割表示の寸法変化に追従する。 */
export function useIsLandscapeLayout(): boolean {
  const { width, height } = ReactNative.useWindowDimensions();
  return isLandscapeLayout(width, height);
}
