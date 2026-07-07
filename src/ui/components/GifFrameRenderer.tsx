import { forwardRef } from 'react';
import { Image, Text, View } from 'react-native';
import MapView, { Polyline, Region } from 'react-native-maps';

import { toRenderRouteCoordinates } from '@/features/map/routeMapper';
import type { AppTheme } from '@/theme/theme';
import type { LocationPoint } from '@/types/gps';
import type { AppStyles } from '@/ui/appStyles';

export type GifFrameRendererProps = {
  /** 全コマ共通の固定表示範囲。 */
  region: Region;
  /** このコマで表示する累積ポイント。 */
  points: LocationPoint[];
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
  { region, points, timeLabel, dateLabel, styles, theme, onMapLoaded },
  ref,
) {
  const routeCoordinates = toRenderRouteCoordinates(points);

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
        {routeCoordinates.length > 1 ? (
          <Polyline coordinates={routeCoordinates} strokeColor={theme.colors.mapLine} strokeWidth={5} />
        ) : null}
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
