import { Text, View } from 'react-native';

import type { AppTheme } from '@/theme/theme';
import type { AppStyles } from '@/ui/appStyles';

/** スポット番号バッジのprops。 */
export type LandmarkSpotNumberBadgeProps = {
  /** 表示する番号(1始まり)。 */
  number: number;
  /** 到達済みかどうか。塗りつぶし/線囲みの見た目を切り替える。 */
  isVisited: boolean;
  /** 画面共通スタイル。 */
  styles: AppStyles;
  /** 現在テーマ。 */
  theme: AppTheme;
};

/**
 * スポットパック詳細画面の行先頭に表示する円形の番号バッジ。
 *
 * 到達済みは塗りつぶし円+白文字、未到達は線囲み円+ミュート文字で見分けられるようにする。
 * `AppListItem` の `leading` スロットへ差し込んで使う汎用コンポーネント。
 */
export function LandmarkSpotNumberBadge({ number, isVisited, styles }: LandmarkSpotNumberBadgeProps) {
  return (
    <View style={[styles.landmarkSpotNumberBadge, isVisited ? styles.landmarkSpotNumberBadgeVisited : styles.landmarkSpotNumberBadgeUnvisited]}>
      <Text style={isVisited ? styles.landmarkSpotNumberBadgeTextVisited : styles.landmarkSpotNumberBadgeTextUnvisited}>{number}</Text>
    </View>
  );
}
