import { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Text, View } from 'react-native';
import MapView, { Circle, Marker } from 'react-native-maps';

import {
  type LandmarkMapRegion,
  createLandmarkSpotFocusRegion,
  formatLandmarkUnlockCondition,
  shouldShowLandmarkSpotDetails,
} from '@/features/landmarks/landmarkSpotMapDetails';
import {
  type RouteCoordinate,
  type RouteCoordinateBounds,
  createRegionFromBounds,
  isValidRouteCoordinate,
} from '@/features/map/routeMapper';
import type { AppTheme } from '@/theme/theme';
import type { AppStyles } from '@/ui/appStyles';
import { LANDMARK_SPOT_VISITED_LABEL } from '@/ui/appText';
import type { LandmarkSpotListItem } from '@/ui/hooks/useLandmarkPackState';
import { LandmarkSpotNumberBadge } from './LandmarkSpotNumberBadge';

/** スポットへ寄せるときのアニメーション時間(ms)。地図画面の非アニメーション移動と同じ値に揃える。 */
const LANDMARK_SPOT_FOCUS_DURATION_MS = 250;

/** スポット詳細(スポット名・解放条件)のフェード時間(ms)。寄る/離れる操作に遅れて見えない程度の短さにする。 */
const LANDMARK_SPOT_DETAIL_FADE_DURATION_MS = 220;

/** 地図へ描くスポットマーカー1件ぶんの表示データ。 */
type LandmarkSpotMarker = {
  /** スポットID。Reactのkeyとマーカー識別子に使う。 */
  spotId: string;
  /** スポット名。読み上げラベルと拡大時のラベルに使う。 */
  name: string;
  /** リストと同じ1始まりの表示番号。 */
  displayNumber: number;
  /** 到達済みかどうか。バッジの配色に使う。 */
  isVisited: boolean;
  /** マーカーを置く緯度経度。 */
  coordinate: RouteCoordinate;
  /** 到達エリアの半径(m)。拡大時の円と、詳細を出すしきい値・寄る範囲の計算に使う。 */
  radiusMeters: number;
  /** バッジ下に出す解放条件(到達済みなら「到達済み」)。 */
  conditionLabel: string;
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
 *
 * 拡大してスポットごとのしきい値(到達エリアの大きさに連動)を超えると、そのスポットの
 * スポット名(バッジの上)・解放条件(バッジの下)・到達エリアの円をフェードインで出し、縮小すると消す。
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
  /**
   * 詳細(スポット名・解放条件・円)を表示するスポットIDを、ソートして連結したキー。
   *
   * 地図操作のたびに region は変わるが、表示可否の集合が同じなら同じ文字列になるため、
   * setState が同値として無視され余計な再描画が起きない。
   */
  const [visibleSpotKey, setVisibleSpotKey] = useState('');
  /**
   * フェード中のスポットID。
   *
   * Android の Marker はカスタムビューをビットマップで撮るため、opacity の変化を反映させるには
   * フェード中だけ `tracksViewChanges` を true にする必要がある。完了したら外して撮り直しを止める。
   */
  const [fadingSpotIds, setFadingSpotIds] = useState<ReadonlySet<string>>(() => new Set());
  /**
   * スポットごとの詳細ラベルの opacity。スポットIDをキーに遅延生成し、再描画をまたいで保持する。
   *
   * 描画中に参照するため ref ではなく、setter を使わない state として同じ Map を持ち続ける。
   */
  const [detailOpacities] = useState(() => new Map<string, Animated.Value>());
  /** スポットごとに最後に指示したフェードの目標(表示=true)。同じ目標への再アニメーションを避ける。 */
  const detailTargetsRef = useRef(new Map<string, boolean>());

  const markers = useMemo(() => toLandmarkSpotMarkers(spotItems), [spotItems]);
  const initialRegion = useMemo(() => createRegionFromBounds(toLandmarkSpotBounds(markers)), [markers]);

  const focusedMarker = markers.find((marker) => marker.spotId === focusRequest?.spotId) ?? null;
  // 座標を数値へ分解して依存配列に入れる。親が spotItems を毎レンダー作り直しても、
  // 同じ要求(nonce)を指している間は再フォーカスが走らないようにするため。
  const focusedLatitude = focusedMarker?.coordinate.latitude ?? null;
  const focusedLongitude = focusedMarker?.coordinate.longitude ?? null;
  const focusedRadiusMeters = focusedMarker?.radiusMeters ?? null;
  const focusNonce = focusRequest?.nonce ?? null;
  const visibleSpotIds = useMemo(() => new Set(visibleSpotKey === '' ? [] : visibleSpotKey.split('\n')), [visibleSpotKey]);

  useEffect(() => {
    if (!isMapReady || focusNonce === null || focusedLatitude === null || focusedLongitude === null || focusedRadiusMeters === null) {
      return;
    }

    // 円より狭く寄ると到達エリアの端が分からないため、円が余白付きで収まる範囲へ寄せる。
    // この範囲は詳細表示のしきい値と連動しているので、寄った後は必ずスポット名・解放条件・円が出る。
    mapRef.current?.animateToRegion(
      createLandmarkSpotFocusRegion({ latitude: focusedLatitude, longitude: focusedLongitude }, focusedRadiusMeters),
      LANDMARK_SPOT_FOCUS_DURATION_MS,
    );
    // nonce をタップのたびに変えることで、同じスポットへの再タップでも
    // (座標が変わらず)確実にアニメーションを再実行する。
  }, [focusNonce, focusedLatitude, focusedLongitude, focusedRadiusMeters, isMapReady]);

  // アンマウント時に走行中のフェードを止める。停止時の完了コールバックは finished=false になり state を触らない。
  useEffect(() => {
    return () => {
      for (const opacity of detailOpacities.values()) {
        opacity.stopAnimation();
      }
    };
  }, [detailOpacities]);

  // RouteMapPanel と同じく、描ける座標が無いときは地図を描画しない
  if (markers.length === 0) {
    return null;
  }

  const isInitialLayoutPending = laidOutMarkerCount < markers.length;

  /** 表示範囲の変化を受け、詳細を出すスポットの集合を更新する。 */
  const handleRegionChangeComplete = (region: LandmarkMapRegion) => {
    // New Architecture等で onMapReady が発火しない環境のフォールバック。
    // region変更完了が来た時点で地図は初期化済みで animateToRegion を受け付けられる。
    setIsMapReady(true);

    const nextVisibleSpotIds = markers
      .filter((marker) => shouldShowLandmarkSpotDetails(region, marker.radiusMeters))
      .map((marker) => marker.spotId);
    const startedSpotIds = startDetailFades(nextVisibleSpotIds);

    if (startedSpotIds.length > 0) {
      setFadingSpotIds((current) => new Set([...current, ...startedSpotIds]));
    }
    setVisibleSpotKey([...nextVisibleSpotIds].sort().join('\n'));
  };

  /**
   * 表示可否が変わったスポットだけフェードを開始し、開始したスポットIDを返す。
   *
   * 地図操作のたびに呼ばれるため、前回と同じ目標のスポットはアニメーションを作り直さない。
   */
  const startDetailFades = (nextVisibleSpotIds: string[]): string[] => {
    const nextVisible = new Set(nextVisibleSpotIds);
    const startedSpotIds: string[] = [];

    for (const { spotId } of markers) {
      const shouldShow = nextVisible.has(spotId);

      if ((detailTargetsRef.current.get(spotId) ?? false) === shouldShow) {
        continue;
      }

      detailTargetsRef.current.set(spotId, shouldShow);
      startedSpotIds.push(spotId);
      // opacity は JS ドライバで動かす。Android のマーカーはビューをビットマップへ撮り直して描くため、
      // ネイティブドライバで React を経由せず変えた値がスナップショットへ確実に乗るとは限らない。
      // 対象はパック内の数件だけなので JS ドライバでも負荷は小さい。
      Animated.timing(getDetailOpacity(detailOpacities, spotId), {
        toValue: shouldShow ? 1 : 0,
        duration: LANDMARK_SPOT_DETAIL_FADE_DURATION_MS,
        useNativeDriver: false,
      }).start(({ finished }) => {
        // 途中で逆向きのフェードに差し替えられた場合(finished=false)は、後発側の完了で外す
        if (!finished) {
          return;
        }

        setFadingSpotIds((current) => withoutSpotId(current, spotId));
      });
    }

    return startedSpotIds;
  };

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
        onRegionChangeComplete={handleRegionChangeComplete}
      >
        {markers.map((marker) => {
          const isFading = fadingSpotIds.has(marker.spotId);
          // フェードアウト中も中身を残し、完了してから外す(いきなり消えないように)
          const isDetailMounted = visibleSpotIds.has(marker.spotId) || isFading;

          return isDetailMounted ? (
            // react-native-maps の Circle は opacity を持たず、fill/stroke の色をフレームごとに差し替えると
            // ネイティブのオーバーレイ更新が毎フレーム走るため、ラベルと同じ期間だけマウントする切り替えで代替する。
            <Circle
              key={`circle-${marker.spotId}`}
              center={marker.coordinate}
              fillColor={`${theme.colors.primary}24`}
              radius={marker.radiusMeters}
              strokeColor={theme.colors.primary}
              strokeWidth={1}
              testID={`landmark-spot-circle-${marker.spotId}`}
            />
          ) : null;
        })}
        {markers.map((marker) => {
          const isFading = fadingSpotIds.has(marker.spotId);
          const isDetailMounted = visibleSpotIds.has(marker.spotId) || isFading;
          const opacity = getDetailOpacity(detailOpacities, marker.spotId);

          return (
            <Marker
              key={marker.spotId}
              accessibilityLabel={`${marker.displayNumber}番目のスポット ${marker.name}`}
              // 上下のラベル行は同じ高さなので、中心アンカーでバッジがスポット座標に重なる
              anchor={{ x: 0.5, y: 0.5 }}
              coordinate={marker.coordinate}
              identifier={`landmark-spot-${marker.spotId}`}
              tracksViewChanges={isInitialLayoutPending || isFading}
            >
              <View
                collapsable={false}
                style={styles.landmarkPackMapMarkerContainer}
                testID={`landmark-spot-marker-${marker.spotId}`}
                onLayout={() => setLaidOutMarkerCount((count) => count + 1)}
              >
                {/* 非表示時も行の高さは保ち、中身だけを外す(バッジの位置を動かさないため) */}
                <Animated.View pointerEvents="none" style={[styles.landmarkPackMapLabelRow, { opacity }]}>
                  {isDetailMounted ? <LandmarkSpotMapLabel label={marker.name} styles={styles} /> : null}
                </Animated.View>
                <LandmarkSpotNumberBadge
                  isVisited={marker.isVisited}
                  number={marker.displayNumber}
                  styles={styles}
                  theme={theme}
                  variant="map"
                />
                <Animated.View pointerEvents="none" style={[styles.landmarkPackMapLabelRow, { opacity }]}>
                  {isDetailMounted ? <LandmarkSpotMapLabel label={marker.conditionLabel} styles={styles} /> : null}
                </Animated.View>
              </View>
            </Marker>
          );
        })}
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
    .map(({ spot, visitedLocalDate }, index) => {
      const isVisited = visitedLocalDate !== null;

      return {
        spotId: spot.id,
        name: spot.name,
        displayNumber: index + 1,
        isVisited,
        coordinate: { latitude: spot.latitude, longitude: spot.longitude },
        radiusMeters: spot.radiusMeters,
        // 到達済みに滞在条件を出すと「まだ解放されていない」と誤読されるため、状態だけを示す
        conditionLabel: isVisited ? LANDMARK_SPOT_VISITED_LABEL : formatLandmarkUnlockCondition(spot.dwellSeconds),
      };
    })
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

/** 地図上のラベル1行(角丸の半透明の座布団に1行の文字)。長い名前は末尾を省略して行の高さを保つ。 */
function LandmarkSpotMapLabel({ label, styles }: { label: string; styles: AppStyles }) {
  return (
    <View style={styles.landmarkPackMapLabelCushion}>
      <Text numberOfLines={1} style={styles.landmarkPackMapLabelText}>
        {label}
      </Text>
    </View>
  );
}

/** スポットの詳細ラベル用 opacity を取得する。未作成なら非表示(0)で作って保持する。 */
function getDetailOpacity(opacities: Map<string, Animated.Value>, spotId: string): Animated.Value {
  const existing = opacities.get(spotId);

  if (existing) {
    return existing;
  }

  const created = new Animated.Value(0);
  opacities.set(spotId, created);

  return created;
}

/** 集合から1件を除いた新しい集合を返す。含まれていなければ同じ参照を返し、無駄な再描画を避ける。 */
function withoutSpotId(spotIds: ReadonlySet<string>, spotId: string): ReadonlySet<string> {
  if (!spotIds.has(spotId)) {
    return spotIds;
  }

  const next = new Set(spotIds);
  next.delete(spotId);

  return next;
}
