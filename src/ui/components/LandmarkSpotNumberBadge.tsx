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
  /**
   * 表示先。
   *
   * `'list'`(既定)はパック詳細画面のリスト行向けで、到達済み=塗りつぶし円/未到達=線囲み円のまま。
   * `'map'` は埋め込み地図のマーカー向けで、OSの地図タイル色がライト/ダーク/衛星と変わっても
   * 視認できるよう、到達済み・未到達の両方を塗りつぶし円にし、白リング+影を重ねてコントラストを確保する。
   */
  variant?: 'list' | 'map';
};

/**
 * スポットパック詳細画面の行先頭・埋め込み地図のマーカーに表示する円形の番号バッジ。
 *
 * `variant='list'`(既定)は到達済み=塗りつぶし円+白文字、未到達=線囲み円+ミュート文字で見分けられるようにする。
 * `variant='map'` は地図タイルの上でも視認できるよう、到達済み・未到達とも塗りつぶし円+白リング+白文字にする。
 * `AppListItem` の `leading` スロット、または `LandmarkPackMapPreview` のマーカーへ差し込んで使う汎用コンポーネント。
 */
export function LandmarkSpotNumberBadge({ number, isVisited, styles, variant = 'list' }: LandmarkSpotNumberBadgeProps) {
  const containerStyle =
    variant === 'map'
      ? [
          styles.landmarkSpotNumberBadge,
          styles.landmarkSpotNumberBadgeMap,
          isVisited ? styles.landmarkSpotNumberBadgeMapVisited : styles.landmarkSpotNumberBadgeMapUnvisited,
        ]
      : [styles.landmarkSpotNumberBadge, isVisited ? styles.landmarkSpotNumberBadgeVisited : styles.landmarkSpotNumberBadgeUnvisited];
  const textStyle =
    variant === 'map'
      ? styles.landmarkSpotNumberBadgeTextMap
      : isVisited
        ? styles.landmarkSpotNumberBadgeTextVisited
        : styles.landmarkSpotNumberBadgeTextUnvisited;

  return (
    <View style={containerStyle}>
      <Text style={textStyle}>{number}</Text>
    </View>
  );
}
