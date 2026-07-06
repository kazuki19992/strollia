import { useCallback, useEffect, useRef, useState } from 'react';
import MapView from 'react-native-maps';
import type { LatLng, MapType, Region, UserLocationChangeEvent } from 'react-native-maps';

import { createUserCenteredRegion, isValidMapCoordinate, shouldRestoreMapRegionOnMapOpen } from '@/app/mapRegion';
import { getNextMapType } from '@/app/mapType';
import { shouldApplyThrottledRegionChange } from '@/app/regionChangeThrottle';
import type { ScreenMode } from '@/app/appTypes';
import type { ResolvedUserLocationIcon } from '@/features/customization/customizationResolver';
import { toDisplaySpeedKmh } from './useRawLocationSpeed';

/** Android操作中のonRegionChangeを間引く間隔。エリア追従の速さとDB負荷のバランス。 */
const REGION_CHANGE_THROTTLE_MS = 150;

/** `useMapFollowState` フックの引数。 */
export type UseMapFollowStateParams = {
  /**
   * 現在の画面モード。
   * 地図離脱時の isMapReady リセットと、地図復帰時の region 復元で参照する。
   */
  screenMode: ScreenMode;
  /**
   * 現在地アイコンの解決結果。
   * ネイティブ追従かカスタム追従かを判定するために使う。
   */
  userLocationIcon: ResolvedUserLocationIcon;
  /**
   * visitedGridRefreshVersion をインクリメントする関数への ref。
   * useVisitedGridOverlay からの戻り値を App.tsx で ref にラップして渡す。
   * ref にすることで useVisitedGridOverlay より前に useMapFollowState を呼べる
   * （フック呼び出し順序の循環依存を回避するため）。
   */
  incrementVisitedGridRefreshVersionRef: React.MutableRefObject<() => void>;
};

/** `useMapFollowState` が返す状態・ref・操作の型。 */
export type UseMapFollowStateResult = {
  /** MapView への ref。animateToRegion 等で直接操作するために使う。 */
  mapRef: React.RefObject<MapView | null>;
  /** 最後に受け取った現在地座標。未受信は null。 */
  userCoordinate: LatLng | null;
  /**
   * 現在地追従中かどうか。
   * 初期 ON、ユーザーのドラッグで OFF、現在地ボタン押下で再び ON になる。
   */
  isFollowingUserLocation: boolean;
  /**
   * ネイティブ地図の初期化完了フラグ。
   * onMapReady 前の animateToRegion はネイティブ側で無視されるため、
   * カスタムアイコンの初回センタリングは準備完了を待ってから実行する。
   */
  isMapReady: boolean;
  /** MapView の現在表示範囲。スクロール中も追従させるために保持する。 */
  visibleRegion: Region | null;
  /** 現在の走行速度（km/h）。位置更新イベントから算出する。 */
  currentSpeedKmh: number;
  /** 現在の地図種別。standard / hybrid を切り替える。 */
  mapType: MapType;
  /**
   * OS標準アイコン使用時の現在地更新コールバック。
   * react-native-maps の onUserLocationChange に渡す。
   */
  handleUserLocationChange: (event: UserLocationChangeEvent) => void;
  /**
   * 緯度経度と速度から現在地・速度表示・追従を更新する。
   * OS標準の位置イベントと前景ウォッチの両方から呼ばれる。
   */
  applyUserLocation: (latitude: number, longitude: number, speed: number | null | undefined) => void;
  /**
   * ユーザーが地図を動かしたら現在地追従を一時停止する。
   * MapView の onPanDrag に渡す。
   */
  handleMapPanDrag: () => void;
  /**
   * 表示範囲を保存する。
   * 追従再開は現在地ボタン押下に限定し、広域表示中の意図しない引き戻しを防ぐ。
   */
  handleRegionChangeComplete: (region: Region) => void;
  /**
   * 操作中の表示範囲更新（Androidのみ使用）。
   * AndroidはonRegionChangeCompleteの発火が遅いため、操作中もスロットルしながら更新する。
   */
  handleRegionChange: (region: Region) => void;
  /**
   * ネイティブ地図の初期化完了を受けて、カスタムアイコンの初回センタリングを解禁する。
   * MapView の onMapReady に渡す。
   */
  handleMapReady: () => void;
  /**
   * 指定座標が画面中心になるよう地図を移動する。
   *
   * @param coordinate - 中心へ移動したい緯度経度。
   * @param animated - アニメーション付きで移動するか。
   */
  centerOnCoordinate: (coordinate: LatLng, animated?: boolean) => void;
  /**
   * 現在地ボタン押下時に追従を再開して現在地へ戻す。
   */
  recenterOnUserLocation: () => void;
  /**
   * 標準地図とラベル付き航空写真を切り替える。
   */
  toggleMapType: () => void;
  /**
   * 地図画面へ戻るときに表示範囲の復元フラグを立てる。
   * openMap から呼んで shouldRestoreMapRegionOnOpenRef を true にする。
   */
  prepareMapRegionRestore: () => void;
};

/**
 * 地図の追従・センタリング・表示範囲・mapType を束ねるカスタムフック。
 *
 * App.tsx から以下を切り出した:
 * - state: userCoordinate / isFollowingUserLocation / isMapReady / visibleRegion /
 *          currentSpeedKmh / mapType
 * - ref: mapRef / regionChangeThrottleRef / shouldRestoreMapRegionOnOpenRef
 * - 関数: handleUserLocationChange / applyUserLocation / handleMapPanDrag /
 *         handleRegionChangeComplete / handleRegionChange / handleMapReady /
 *         centerOnCoordinate / recenterOnUserLocation / toggleMapType
 * - effect: カスタムアイコン追従センタリング / 地図離脱時 isMapReady リセット /
 *           地図復帰時 region 復元
 *
 * ユーザー向け挙動は App.tsx のそれと完全に同一に保つ。
 */
export function useMapFollowState({
  screenMode,
  userLocationIcon,
  incrementVisitedGridRefreshVersionRef,
}: UseMapFollowStateParams): UseMapFollowStateResult {
  const mapRef = useRef<MapView | null>(null);
  /** Android操作中のonRegionChangeをスロットルするための最終更新時刻。 */
  const regionChangeThrottleRef = useRef(0);
  /**
   * 地図から別画面へ遷移したことを示すフラグ。
   * 地図へ戻ったときに MapView が再マウントされて広域 initialRegion へ戻ることを防ぐ。
   */
  const shouldRestoreMapRegionOnOpenRef = useRef(false);

  const [userCoordinate, setUserCoordinate] = useState<LatLng | null>(null);
  const [isFollowingUserLocation, setIsFollowingUserLocation] = useState(true);
  // ネイティブ地図の初期化完了フラグ。onMapReady前のanimateToRegionはネイティブ側で
  // 無視されるため、カスタムアイコンの初回センタリングは準備完了を待ってから実行する。
  const [isMapReady, setIsMapReady] = useState(false);
  const [visibleRegion, setVisibleRegion] = useState<Region | null>(null);
  const [currentSpeedKmh, setCurrentSpeedKmh] = useState(0);
  const [mapType, setMapType] = useState<MapType>('standard');

  /**
   * 指定座標が画面中心になるよう地図を移動する。
   *
   * @param coordinate - 中心へ移動したい緯度経度。
   * @param animated - アニメーション付きで移動するか。
   * @returns なし。
   */
  const centerOnCoordinate = useCallback(
    (coordinate: LatLng, animated = true): void => {
      if (!isValidMapCoordinate(coordinate)) {
        return;
      }

      const region = createUserCenteredRegion(coordinate);
      setVisibleRegion(region);
      incrementVisitedGridRefreshVersionRef.current();
      mapRef.current?.animateToRegion(region, animated ? 500 : 250);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps -- 既存挙動維持のため依存配列を変更しない
    [],
  );

  // カスタムアイコン時はネイティブのfollowsUserLocationが使えないため、このeffectが唯一の
  // オーナーとして追従センタリングを担う（applyUserLocation側はOS標準時のみセンタリングする）。
  // 追従中は現在地更新のたびにアプリ側でセンタリングし、OS標準のfollowsUserLocationと同じ挙動にする。
  //
  // 起動直後は前景ウォッチの初回更新（getLastKnownPositionAsync）がネイティブ地図の初期化完了より
  // 先に届くことがあり、その時点のanimateToRegionはネイティブ側で無視される。さらに静止中は
  // watchPositionAsyncが再発火しないため再センタリングの機会がなく、広域initialRegionで固定されてしまう。
  // これを防ぐためisMapReady（onMapReady）を待ってからセンタリングする。現在地が先に届いていれば
  // 準備完了時に、準備完了が先なら現在地到着時に、いずれの順序でも確実にセンタリングが走る。
  useEffect(() => {
    if (screenMode !== 'map' || userLocationIcon.useNativeUserLocation) {
      return;
    }

    if (!isMapReady || !isFollowingUserLocation || !userCoordinate) {
      return;
    }

    centerOnCoordinate(userCoordinate, false);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- 既存挙動維持のため依存配列を変更しない
  }, [screenMode, userLocationIcon.useNativeUserLocation, isMapReady, isFollowingUserLocation, userCoordinate]);

  // MapViewは地図画面でのみマウントされる。地図から離れたら準備完了フラグを倒し、再表示時の
  // 新しいネイティブ地図がonMapReadyを発火するまでカスタムセンタリングを待たせる。
  useEffect(() => {
    if (screenMode !== 'map') {
      setIsMapReady(false);
    }
  }, [screenMode]);

  /**
   * 別画面から地図へ戻った直後に、MapViewの再マウントで広域initialRegionへ戻ることを防ぐ。
   */
  useEffect(() => {
    if (screenMode !== 'map' || !shouldRestoreMapRegionOnOpenRef.current) {
      return;
    }

    shouldRestoreMapRegionOnOpenRef.current = false;

    if (!userCoordinate) {
      return;
    }

    centerOnCoordinate(userCoordinate, false);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- 既存挙動維持のため依存配列を変更しない
  }, [screenMode, userCoordinate]);

  /**
   * 現在地更新を受け取り、追従中であれば地図中心も更新する。
   *
   * @param event - react-native-mapsから渡される現在地更新イベント。
   * @returns なし。
   */
  function handleUserLocationChange(event: UserLocationChangeEvent): void {
    const coordinate = event.nativeEvent.coordinate;

    if (!coordinate) {
      return;
    }

    applyUserLocation(coordinate.latitude, coordinate.longitude, coordinate.speed);
  }

  /**
   * 緯度経度と速度から現在地・速度表示・追従を更新する。
   * OS標準の位置イベントと前景ウォッチの両方から呼ばれる。
   *
   * @param latitude - 緯度。
   * @param longitude - 経度。
   * @param speed - m/s単位の速度。取得できない場合はnull/undefined。
   * @returns なし。
   */
  function applyUserLocation(latitude: number, longitude: number, speed: number | null | undefined): void {
    const nextCoordinate = { latitude, longitude };
    if (!isValidMapCoordinate(nextCoordinate)) {
      return;
    }

    setUserCoordinate(nextCoordinate);
    const nextSpeedKmh = toDisplaySpeedKmh(speed ?? null);

    if (nextSpeedKmh != null) {
      setCurrentSpeedKmh(nextSpeedKmh);
    }

    // OS標準アイコン時のみここでセンタリングする。カスタムアイコン時は専用effectが
    // 唯一のオーナーとして追従するため、ここで重複してanimateToRegionを呼ばない。
    if (isFollowingUserLocation && userLocationIcon.useNativeUserLocation) {
      centerOnCoordinate(nextCoordinate, false);
    }
  }

  /**
   * ユーザーが地図を動かしたら現在地追従を一時停止する。
   *
   * @returns なし。
   */
  function handleMapPanDrag(): void {
    setIsFollowingUserLocation(false);
  }

  /**
   * 表示範囲を保存する。追従再開は現在地ボタン押下に限定し、広域表示中の意図しない引き戻しを防ぐ。
   *
   * @param region - MapViewの現在表示範囲。
   * @returns なし。
   */
  function handleRegionChangeComplete(region: Region): void {
    regionChangeThrottleRef.current = Date.now();
    setVisibleRegion(region);
  }

  /**
   * 操作中の表示範囲更新（Androidのみ使用）。
   *
   * AndroidはonRegionChangeCompleteの発火が遅く、広域縮小時にエリア表示の追従が遅れて見えるため、
   * 操作中もスロットルしながら表示範囲を更新してエリア集約を追従させる。
   * visibleRegionはグリッド集約の計算にのみ使い地図カメラへは戻さないため、ジェスチャーは妨げない。
   *
   * @param region - MapViewの現在表示範囲。
   * @returns なし。
   */
  function handleRegionChange(region: Region): void {
    const now = Date.now();

    if (!shouldApplyThrottledRegionChange(regionChangeThrottleRef.current, now, REGION_CHANGE_THROTTLE_MS)) {
      return;
    }

    regionChangeThrottleRef.current = now;
    setVisibleRegion(region);
  }

  /**
   * ネイティブ地図の初期化完了を受けて、カスタムアイコンの初回センタリングを解禁する。
   *
   * @returns なし。
   */
  function handleMapReady(): void {
    setIsMapReady(true);
  }

  /**
   * 現在地ボタン押下時に追従を再開して現在地へ戻す。
   *
   * @returns なし。
   */
  function recenterOnUserLocation(): void {
    if (!userCoordinate) {
      return;
    }

    setIsFollowingUserLocation(true);
    centerOnCoordinate(userCoordinate);
  }

  /**
   * 標準地図とラベル付き航空写真を切り替える。
   *
   * @returns なし。
   */
  function toggleMapType(): void {
    setMapType(getNextMapType);
  }

  /**
   * 地図画面へ戻るときに表示範囲の復元フラグを立て、現在地中心の region を先行設定する。
   * openMap から呼ぶことで、MapView 再マウント後の広域 initialRegion への引き戻しを防ぐ。
   *
   * @returns なし。
   */
  function prepareMapRegionRestore(): void {
    if (shouldRestoreMapRegionOnMapOpen({ userCoordinate, isFollowingUserLocation }) && userCoordinate) {
      shouldRestoreMapRegionOnOpenRef.current = true;
      setVisibleRegion(createUserCenteredRegion(userCoordinate));
      incrementVisitedGridRefreshVersionRef.current();
    }
  }

  return {
    mapRef,
    userCoordinate,
    isFollowingUserLocation,
    isMapReady,
    visibleRegion,
    currentSpeedKmh,
    mapType,
    handleUserLocationChange,
    applyUserLocation,
    handleMapPanDrag,
    handleRegionChangeComplete,
    handleRegionChange,
    handleMapReady,
    centerOnCoordinate,
    recenterOnUserLocation,
    toggleMapType,
    prepareMapRegionRestore,
  };
}
