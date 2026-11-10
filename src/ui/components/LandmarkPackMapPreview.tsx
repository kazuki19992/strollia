import { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Text, View } from 'react-native';
import MapView, { Circle, Marker } from 'react-native-maps';

import {
  type LandmarkMapRegion,
  createLandmarkSpotFocusRegion,
  createLandmarkSpotsBounds,
  formatLandmarkUnlockCondition,
  shouldShowLandmarkSpotDetails,
} from '@/features/landmarks/landmarkSpotMapDetails';
import { type RouteCoordinate, createRegionFromBounds, isValidRouteCoordinate } from '@/features/map/routeMapper';
import type { AppTheme } from '@/theme/theme';
import type { AppStyles } from '@/ui/appStyles';
import { LANDMARK_SPOT_VISITED_LABEL } from '@/ui/appText';
import type { LandmarkSpotListItem } from '@/ui/hooks/useLandmarkPackState';
import { LandmarkSpotNumberBadge } from './LandmarkSpotNumberBadge';

/** スポットへ寄せるときのアニメーション時間(ms)。地図画面の非アニメーション移動と同じ値に揃える。 */
const LANDMARK_SPOT_FOCUS_DURATION_MS = 250;

/** スポット詳細(スポット名・解放条件)のフェード時間(ms)。寄る/離れる操作に遅れて見えない程度の短さにする。 */
const LANDMARK_SPOT_DETAIL_FADE_DURATION_MS = 220;

/**
 * マーカーの表示内容(到達状態・ラベル)が変わったあと、ビュー変化を追跡し続ける時間(ms)。
 *
 * Android の Marker は `tracksViewChanges` が false の間、前回のビットマップを使い続ける。
 * 固定高さのラベル行で文字だけが変わってもレイアウトイベントは来ないため、`onLayout` には頼らず、
 * 内容が変わったマーカーだけ一定時間追跡して撮り直させる。描画が確定するまでの余裕を見た値。
 */
const LANDMARK_SPOT_CONTENT_REFRESH_MS = 500;

/**
 * 到達エリアの円の塗りの不透明度(16進2桁)。滞在場所の設定画面の円と同じ薄さ。
 *
 * react-native-maps の `Circle` は値を変えるたびに地図から外して付け直すため、
 * 色や大きさを段階的に変えるトランジションは iOS で途中が描かれず不安定になる。
 * そこで円は表示範囲に関わらず常にこの薄さで描いておき、拡大するにつれて自然に見えてくるようにする。
 */
const LANDMARK_SPOT_CIRCLE_FILL_ALPHA_HEX = '24';

/** 地図へ描くスポットマーカー1件ぶんの表示データ。 */
type LandmarkSpotMarker = {
  /** 地点ID。Reactのkeyとマーカー識別子に使う。円1つのスポットではスポットIDと同じ。 */
  areaId: string;
  /** 地点が属するスポットのID。ズーム要求との突き合わせに使う。 */
  spotId: string;
  /** 地点名。読み上げラベルと拡大時のラベルに使う。 */
  name: string;
  /** リストと同じ1始まりの表示番号。 */
  displayNumber: number;
  /** 到達済みかどうか。バッジの配色に使う。 */
  isVisited: boolean;
  /** マーカーを置く緯度経度。 */
  coordinate: RouteCoordinate;
  /** 到達エリアの半径(m)。常に描く円と、詳細を出すしきい値・寄る範囲の計算に使う。 */
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
 * スポット名(バッジの上)・解放条件(バッジの下)をフェードインで出し、縮小すると消す。
 * 到達エリアの円は表示範囲に関わらず常に描く(縮尺に合わせて大きさが変わり、拡大につれて見えてくる)。
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
   * 詳細(スポット名・解放条件)を表示するスポットIDを、ソートして連結したキー。
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
  /** 表示内容が変わり、Android のビットマップを撮り直している最中のスポットID。 */
  const [refreshingSpotIds, setRefreshingSpotIds] = useState<ReadonlySet<string>>(() => new Set());
  /** 前回描画時のスポットごとの表示内容。初回は比較対象が無いため null。 */
  const previousMarkerContentsRef = useRef<Map<string, string> | null>(null);
  /** スポットごとの撮り直し終了タイマー。内容が続けて変わったら延長する。 */
  const refreshTimersRef = useRef(new Map<string, ReturnType<typeof setTimeout>>());

  const markers = useMemo(() => toLandmarkSpotMarkers(spotItems), [spotItems]);
  // 親が spotItems を作り直しても、表示内容が同じなら同じ文字列になり撮り直しは走らない
  const markerContentKey = markers.map(toMarkerContentLine).join('\n');
  const initialRegion = useMemo(
    () =>
      createRegionFromBounds(
        createLandmarkSpotsBounds(
          markers.map(({ coordinate, radiusMeters }) => ({ latitude: coordinate.latitude, longitude: coordinate.longitude, radiusMeters })),
        ),
      ),
    [markers],
  );

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
    // この範囲は詳細表示のしきい値と連動しているので、寄った後は必ずスポット名・解放条件が出る。
    mapRef.current?.animateToRegion(
      createLandmarkSpotFocusRegion({ latitude: focusedLatitude, longitude: focusedLongitude }, focusedRadiusMeters),
      LANDMARK_SPOT_FOCUS_DURATION_MS,
    );
    // nonce をタップのたびに変えることで、同じスポットへの再タップでも
    // (座標が変わらず)確実にアニメーションを再実行する。
  }, [focusNonce, focusedLatitude, focusedLongitude, focusedRadiusMeters, isMapReady]);

  useEffect(() => {
    const nextContents = parseMarkerContentKey(markerContentKey);
    const previousContents = previousMarkerContentsRef.current;
    previousMarkerContentsRef.current = nextContents;

    // 初回は初回レイアウトの追跡(isInitialLayoutPending)が撮影を担う
    if (previousContents === null) {
      return;
    }

    const changedSpotIds = [...nextContents]
      .filter(([spotId, content]) => previousContents.has(spotId) && previousContents.get(spotId) !== content)
      .map(([spotId]) => spotId);

    if (changedSpotIds.length === 0) {
      return;
    }

    setRefreshingSpotIds((current) => new Set([...current, ...changedSpotIds]));

    for (const spotId of changedSpotIds) {
      const timers = refreshTimersRef.current;
      clearTimeout(timers.get(spotId));
      timers.set(
        spotId,
        setTimeout(() => {
          timers.delete(spotId);
          setRefreshingSpotIds((current) => withoutSpotId(current, spotId));
        }, LANDMARK_SPOT_CONTENT_REFRESH_MS),
      );
    }
  }, [markerContentKey]);

  // アンマウント時に撮り直し終了タイマーを止め、外れたコンポーネントの state を触らない
  useEffect(() => {
    const timers = refreshTimersRef.current;

    return () => {
      for (const timer of timers.values()) {
        clearTimeout(timer);
      }
      timers.clear();
    };
  }, []);

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
      .map((marker) => marker.areaId);
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
  const startDetailFades = (nextVisibleAreaIds: string[]): string[] => {
    const nextVisible = new Set(nextVisibleAreaIds);
    const startedSpotIds: string[] = [];

    for (const { areaId } of markers) {
      const shouldShow = nextVisible.has(areaId);

      if ((detailTargetsRef.current.get(areaId) ?? false) === shouldShow) {
        continue;
      }

      detailTargetsRef.current.set(areaId, shouldShow);
      startedSpotIds.push(areaId);
      // opacity は JS ドライバで動かす。Android のマーカーはビューをビットマップへ撮り直して描くため、
      // ネイティブドライバで React を経由せず変えた値がスナップショットへ確実に乗るとは限らない。
      // 対象はパック内の数件だけなので JS ドライバでも負荷は小さい。
      Animated.timing(getDetailOpacity(detailOpacities, areaId), {
        toValue: shouldShow ? 1 : 0,
        duration: LANDMARK_SPOT_DETAIL_FADE_DURATION_MS,
        useNativeDriver: false,
      }).start(({ finished }) => {
        // 途中で逆向きのフェードに差し替えられた場合(finished=false)は、後発側の完了で外す
        if (!finished) {
          return;
        }

        setFadingSpotIds((current) => withoutSpotId(current, areaId));
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
        {markers.map((marker) => (
          // 円は常に描く。縮尺に合わせて大きさが変わるので、引いた表示では小さくなるだけで邪魔にならない。
          // 輪郭は描かず、塗りだけの薄い円にする
          <Circle
            key={`circle-${marker.areaId}`}
            center={marker.coordinate}
            fillColor={`${theme.colors.primary}${LANDMARK_SPOT_CIRCLE_FILL_ALPHA_HEX}`}
            radius={marker.radiusMeters}
            strokeColor="transparent"
            strokeWidth={0}
            testID={`landmark-spot-circle-${marker.areaId}`}
          />
        ))}
        {markers.map((marker) => {
          const isFading = fadingSpotIds.has(marker.areaId);
          const isDetailMounted = visibleSpotIds.has(marker.areaId) || isFading;
          const opacity = getDetailOpacity(detailOpacities, marker.areaId);

          return (
            <Marker
              key={marker.areaId}
              accessibilityLabel={`${marker.displayNumber}番目のスポット ${marker.name}`}
              // 上下のラベル行は同じ高さなので、中心アンカーでバッジがスポット座標に重なる
              anchor={{ x: 0.5, y: 0.5 }}
              coordinate={marker.coordinate}
              identifier={`landmark-spot-${marker.areaId}`}
              tracksViewChanges={isInitialLayoutPending || isFading || refreshingSpotIds.has(marker.areaId)}
            >
              <View
                collapsable={false}
                style={styles.landmarkPackMapMarkerContainer}
                testID={`landmark-spot-marker-${marker.areaId}`}
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
    .flatMap(({ spot, visitedLocalDate }, index) => {
      const isVisited = visitedLocalDate !== null;

      // 複数地点スポットは地点ごとにマーカーを作る。番号はスポットの番号を共有する
      return spot.areas.map((area) => ({
        areaId: area.id,
        spotId: spot.id,
        name: area.name,
        displayNumber: index + 1,
        isVisited,
        coordinate: { latitude: area.latitude, longitude: area.longitude },
        radiusMeters: area.radiusMeters,
        // 到達済みに滞在条件を出すと「まだ解放されていない」と誤読されるため、状態だけを示す
        conditionLabel: isVisited ? LANDMARK_SPOT_VISITED_LABEL : formatLandmarkUnlockCondition(area.dwellSeconds),
      }));
    })
    .filter((marker) => isValidRouteCoordinate(marker.coordinate));
}

/** 地図上のラベル1行(角丸の半透明の座布団に1行の文字)。長い名前は末尾を省略して行の高さを保つ。 */
function LandmarkSpotMapLabel({ label, styles }: { label: string; styles: AppStyles }) {
  return (
    <View style={styles.landmarkPackMapLabelCushion}>
      {/* 行の高さを固定しているため、端末の文字サイズ設定で拡大するとバッジへ重なる。地図上の固定UIと同じく拡大しない */}
      <Text allowFontScaling={false} numberOfLines={1} style={styles.landmarkPackMapLabelText}>
        {label}
      </Text>
    </View>
  );
}

/**
 * マーカー1件の表示内容を、比較用の1行(タブ区切り、先頭は地点ID)にする。
 *
 * Android で撮り直しが必要になる見た目の要素(番号・到達状態・スポット名・解放条件)だけを含める。
 */
function toMarkerContentLine(marker: LandmarkSpotMarker): string {
  return [marker.areaId, marker.displayNumber, marker.isVisited, marker.name, marker.conditionLabel].join('\t');
}

/** `toMarkerContentLine` を連結したキーを、スポットIDごとの表示内容へ戻す。 */
function parseMarkerContentKey(contentKey: string): Map<string, string> {
  const contents = new Map<string, string>();

  for (const line of contentKey === '' ? [] : contentKey.split('\n')) {
    contents.set(line.split('\t')[0], line);
  }

  return contents;
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
