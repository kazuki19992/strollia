import { useEffect, useMemo, useRef, useState } from 'react';
import { View } from 'react-native';
import MapView, { Marker } from 'react-native-maps';

import {
  type RouteCoordinate,
  type RouteCoordinateBounds,
  createRegionFromBounds,
  isValidRouteCoordinate,
} from '@/features/map/routeMapper';
import type { AppTheme } from '@/theme/theme';
import type { AppStyles } from '@/ui/appStyles';
import type { LandmarkSpotListItem } from '@/ui/hooks/useLandmarkPackState';
import { createUserCenteredRegion } from '@/ui/mapRegion';
import { LandmarkSpotNumberBadge } from './LandmarkSpotNumberBadge';

/** スポットへ寄せるときのアニメーション時間(ms)。地図画面の非アニメーション移動と同じ値に揃える。 */
const LANDMARK_SPOT_FOCUS_DURATION_MS = 250;

/** 地図へ描くスポットマーカー1件ぶんの表示データ。 */
type LandmarkSpotMarker = {
  /** スポットID。Reactのkeyとマーカー識別子に使う。 */
  spotId: string;
  /** スポット名。読み上げラベルに使う。 */
  name: string;
  /** リストと同じ1始まりの表示番号。 */
  displayNumber: number;
  /** 到達済みかどうか。バッジの配色に使う。 */
  isVisited: boolean;
  /** マーカーを置く緯度経度。 */
  coordinate: RouteCoordinate;
};

/**
 * 埋め込み地図へのズーム要求。
 *
 * spotIdだけで表すと、同じスポットへの連続タップ(ズーム→地図操作→再タップ)で値が変わらず
 * Reactが更新をスキップしてしまう。タップのたびに変わるnonceを添えて、
 * 「同じスポットへの再フォーカス要求」も新しい要求として区別できるようにする。
 */
export type LandmarkSpotFocusRequest = { spotId: string; nonce: number } | null;

/** パック詳細画面の埋め込み地図のprops。 */
export type LandmarkPackMapPreviewProps = {
  /** 表示するスポット行(order昇順)。番号バッジと同じ配列indexで番号を振る。 */
  spotItems: LandmarkSpotListItem[];
  /** ズームして中心表示したいスポットへの要求。nullなら全スポットが収まる表示範囲を保つ。 */
  focusRequest: LandmarkSpotFocusRequest;
  /** 画面共通スタイル。 */
  styles: AppStyles;
  /** 現在テーマ。 */
  theme: AppTheme;
};

/**
 * スポットパックの全スポットを番号マーカーで示す、画面に埋め込むタイプの地図。
 *
 * 初期表示はパック内の全スポット(retired含む)が収まる範囲にして、「次はどこへ行こう」を
 * 地図の広がりから読み取れるようにする。行タップで渡される `focusRequest` が変わったときだけ
 * そのスポットへ寄せ、`null` へ戻っても勝手に引き戻さない(ユーザーが動かした表示位置を尊重する)。
 */
export function LandmarkPackMapPreview({ spotItems, focusRequest, styles, theme }: LandmarkPackMapPreviewProps) {
  const mapRef = useRef<MapView | null>(null);
  /**
   * ネイティブ地図の準備完了フラグ。
   *
   * `onMapReady` 前の `animateToRegion` はネイティブ側で無視されるため、フォーカス指定が
   * 先に来ていても準備完了までは寄せない(`useMapFollowState` と同じ理由)。
   */
  const [isMapReady, setIsMapReady] = useState(false);
  /**
   * レイアウト済みマーカー数。
   *
   * バッジは画像を持たずレイアウト完了で描画が確定するので、全マーカーが並んだ時点で
   * `tracksViewChanges` を止め、地図操作のたびにスナップショットを作り直させない。
   */
  const [laidOutMarkerCount, setLaidOutMarkerCount] = useState(0);

  const markers = useMemo(() => toLandmarkSpotMarkers(spotItems), [spotItems]);
  const initialRegion = useMemo(() => createRegionFromBounds(toLandmarkSpotBounds(markers)), [markers]);

  const focusedMarker = markers.find((marker) => marker.spotId === focusRequest?.spotId) ?? null;
  // 座標を数値へ分解して依存配列に入れる。親が spotItems を毎レンダー作り直しても、
  // 同じ要求(nonce)を指している間は再フォーカスが走らないようにするため。
  const focusedLatitude = focusedMarker?.coordinate.latitude ?? null;
  const focusedLongitude = focusedMarker?.coordinate.longitude ?? null;
  const focusNonce = focusRequest?.nonce ?? null;

  useEffect(() => {
    if (!isMapReady || focusNonce === null || focusedLatitude === null || focusedLongitude === null) {
      return;
    }

    mapRef.current?.animateToRegion(
      createUserCenteredRegion({ latitude: focusedLatitude, longitude: focusedLongitude }),
      LANDMARK_SPOT_FOCUS_DURATION_MS,
    );
    // nonce をタップのたびに変えることで、同じスポットへの再タップでも
    // (座標が変わらず)確実にアニメーションを再実行する。
  }, [focusNonce, focusedLatitude, focusedLongitude, isMapReady]);

  // RouteMapPanel と同じく、描ける座標が無いときは地図を描画しない
  if (markers.length === 0) {
    return null;
  }

  const tracksViewChanges = laidOutMarkerCount < markers.length;

  return (
    <View style={styles.landmarkPackMapFrame}>
      <MapView
        ref={mapRef}
        initialRegion={initialRegion}
        scrollEnabled
        zoomEnabled
        rotateEnabled
        pitchEnabled={false}
        style={styles.landmarkPackMap}
        testID="landmark-pack-map"
        onMapReady={() => setIsMapReady(true)}
        // New Architecture等で onMapReady が発火しない環境のフォールバック。
        // region変更完了が来た時点で地図は初期化済みで animateToRegion を受け付けられる。
        onRegionChangeComplete={() => setIsMapReady(true)}
      >
        {markers.map((marker) => (
          <Marker
            key={marker.spotId}
            accessibilityLabel={`${marker.displayNumber}番目のスポット ${marker.name}`}
            coordinate={marker.coordinate}
            identifier={`landmark-spot-${marker.spotId}`}
            tracksViewChanges={tracksViewChanges}
          >
            <View
              collapsable={false}
              style={styles.landmarkPackMapMarkerContainer}
              onLayout={() => setLaidOutMarkerCount((count) => count + 1)}
            >
              <LandmarkSpotNumberBadge
                isVisited={marker.isVisited}
                number={marker.displayNumber}
                styles={styles}
                theme={theme}
                variant="map"
              />
            </View>
          </Marker>
        ))}
      </MapView>
    </View>
  );
}

/**
 * スポット行をマーカー描画データへ変換する。
 *
 * 表示番号は座標の妥当性チェックより先に配列indexから決める。こうしておけば、
 * 地図に置けないスポットがあってもリスト側(`LandmarkPackScreen`)の番号と食い違わない。
 */
function toLandmarkSpotMarkers(spotItems: LandmarkSpotListItem[]): LandmarkSpotMarker[] {
  return spotItems
    .map(({ spot, visitedLocalDate }, index) => ({
      spotId: spot.id,
      name: spot.name,
      displayNumber: index + 1,
      isVisited: visitedLocalDate !== null,
      coordinate: { latitude: spot.latitude, longitude: spot.longitude },
    }))
    .filter((marker) => isValidRouteCoordinate(marker.coordinate));
}

/**
 * マーカー群の外接境界を求める。
 *
 * `createRegionFromBounds` は境界がnullなら既定位置を返すため、1件も無い場合はnullを返す。
 */
function toLandmarkSpotBounds(markers: LandmarkSpotMarker[]): RouteCoordinateBounds | null {
  const first = markers[0];

  if (!first) {
    return null;
  }

  let minLatitude = first.coordinate.latitude;
  let maxLatitude = first.coordinate.latitude;
  let minLongitude = first.coordinate.longitude;
  let maxLongitude = first.coordinate.longitude;

  for (const { coordinate } of markers) {
    if (coordinate.latitude < minLatitude) minLatitude = coordinate.latitude;
    if (coordinate.latitude > maxLatitude) maxLatitude = coordinate.latitude;
    if (coordinate.longitude < minLongitude) minLongitude = coordinate.longitude;
    if (coordinate.longitude > maxLongitude) maxLongitude = coordinate.longitude;
  }

  return { minLatitude, maxLatitude, minLongitude, maxLongitude };
}
