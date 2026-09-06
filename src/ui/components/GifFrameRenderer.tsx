import { forwardRef } from 'react';
import { Image, Text, View } from 'react-native';
import MapView, { Polyline, Region } from 'react-native-maps';

import { toPrivacyRouteSegments } from '@/features/stayPlaces/privacyRouteSegments';
import type { StayPlace } from '@/features/stayPlaces/stayPlaceTypes';
import type { AppTheme } from '@/theme/theme';
import type { LocationPoint } from '@/types/gps';
import type { AppStyles } from '@/ui/appStyles';

export type GifFrameRendererProps = {
  /** 全コマ共通の固定表示範囲。 */
  region: Region;
  /** このコマで表示する累積ポイント。 */
  points: LocationPoint[];
  /** GIF共有時の非表示半径を適用する有効な滞在場所。未解決時はnull。 */
  activeStayPlaces: StayPlace[] | null;
  /** 左上に表示する時刻ラベル（スペース埋め H:MM）。 */
  timeLabel: string;
  /** 時刻の下に表示する日付ラベル（YYYY年M月D日 (曜)）。 */
  dateLabel: string;
  /** 画面共通スタイル。 */
  styles: AppStyles;
  /** 現在テーマ。 */
  theme: AppTheme;
  /** 地図がタイル含め描画完了したときの通知（最初のコマを撮る前に待つ）。 */
  onMapLoaded: () => void;
};

/** 画面外にマウントしてGIFの1コマをキャプチャするための地図View。 */
export const GifFrameRenderer = forwardRef<View, GifFrameRendererProps>(function GifFrameRenderer(
  { region, points, activeStayPlaces, timeLabel, dateLabel, styles, theme, onMapLoaded },
  ref,
) {
  const routeSegments = activeStayPlaces == null ? [] : toPrivacyRouteSegments(points, activeStayPlaces);

  return (
    <View ref={ref} collapsable={false} style={styles.gifFrameContainer}>
      <MapView
        style={styles.gifFrameMap}
        initialRegion={region}
        scrollEnabled={false}
        zoomEnabled={false}
        rotateEnabled={false}
        pitchEnabled={false}
        onMapLoaded={onMapLoaded}
      >
        {routeSegments.map((segment) => (
          <Polyline key={segment.id} coordinates={segment.coordinates} strokeColor={theme.colors.mapLine} strokeWidth={5} />
        ))}
      </MapView>
      <View style={styles.gifFrameTimeBadge}>
        <Text style={styles.gifFrameTimeText}>{timeLabel}</Text>
        <Text style={styles.gifFrameDateText}>{dateLabel}</Text>
      </View>
      <View style={styles.gifFrameBranding}>
        <Image source={require('../../../assets/icon.png')} style={styles.gifFrameBrandingIcon} />
        <View style={styles.gifFrameBrandingTextWrap}>
          <Text style={styles.gifFrameBrandingTagline}>おさんぽ記録アプリ</Text>
          <Text style={styles.gifFrameBrandingName}>すとろりあ</Text>
        </View>
      </View>
    </View>
  );
});
