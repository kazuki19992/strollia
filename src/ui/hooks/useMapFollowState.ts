import { useCallback, useEffect, useRef, useState } from 'react';
import MapView from 'react-native-maps';
import type { LatLng, MapType, Region, UserLocationChangeEvent } from 'react-native-maps';

import { createUserCenteredRegion, isValidMapCoordinate, shouldRestoreMapRegionOnMapOpen } from '@/ui/mapRegion';
import { getNextMapType } from '@/ui/mapType';
import { shouldApplyThrottledRegionChange } from '@/ui/regionChangeThrottle';
import type { ScreenMode } from '@/ui/appTypes';
import type { ResolvedUserLocationIcon } from '@/features/customization/customizationResolver';
import { toDisplaySpeedKmh } from './useRawLocationSpeed';

/** Android操作中のonRegionChangeを間引く間隔。エリア追従の速さとDB負荷のバランス。 */
const REGION_CHANGE_THROTTLE_MS = 150;

/**
 * ユーザー操作中とみなす最後のイベントからの無操作アイドル時間。
 * onRegionChangeComplete が届かない場合のフォールバックとして、この時間イベントが来なければ
 * Grid取得用regionを直近regionへ同期する。詳細は設計書 §3.1 を参照。
 */
const USER_MAP_GESTURE_IDLE_TIMEOUT_MS = 1000;

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
   * onMapReady または最初の onRegionChangeComplete で true になり、以後リセットされない。
   */
  isMapReady: boolean;
  /** MapView の現在表示範囲。スクロール中も追従させるために保持する。 */
  visibleRegion: Region | null;
  /**
   * Visited Grid取得用の表示範囲。
   * ユーザーがドラッグ操作中は更新しない。DB取得と大量Polygon更新をジェスチャー中に走らせないため、
   * 地図カメラ用の visibleRegion とは別に持つ（詳細は設計書 §3.1）。
   */
  gridSyncRegion: Region | null;
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
 *
 * また、Visited Grid取得用に `gridSyncRegion` を `visibleRegion` から分離して持つ。
 * ユーザーがドラッグ操作中（onPanDrag後）は `onRegionChange` が来ても `gridSyncRegion` を
 * 更新せず、DB取得と大量Polygon更新をジェスチャー中に走らせないようにする。判定は
 * onPanDragで立てるフラグのみで行い、onRegionChangeCompleteの発火有無からは推測しない
 * （プログラム移動でも発火するため）。onRegionChangeCompleteが届かないケースに備え、
 * 最後の操作から1000ms経過したら直近regionへ同期するアイドルタイマーをフォールバックとして
 * 用意する（詳細は設計書 §3.1）。
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
  /**
   * prepareMapRegionRestore を呼ぶたびにインクリメントするカウンター。
   * expo-router 環境では地図ルートがマウントされたまま他画面が push され、MapView も
   * 再マウントされない。screenMode の変化だけでは復帰センタリングの再トリガーを保証できない
   * ため、このカウンターを effect の依存に加えて地図復帰センタリングを確実にトリガーする。
   */
  const [mapRestoreTrigger, setMapRestoreTrigger] = useState(0);

  const [userCoordinate, setUserCoordinate] = useState<LatLng | null>(null);
  const [isFollowingUserLocation, setIsFollowingUserLocation] = useState(true);
  // ネイティブ地図の初期化完了フラグ。onMapReady前のanimateToRegionはネイティブ側で
  // 無視されるため、カスタムアイコンの初回センタリングは準備完了を待ってから実行する。
  // onMapReadyまたは最初のonRegionChangeCompleteでtrueになり、以後リセットされない。
  const [isMapReady, setIsMapReady] = useState(false);
  const [visibleRegion, setVisibleRegion] = useState<Region | null>(null);
  const [gridSyncRegion, setGridSyncRegion] = useState<Region | null>(null);
  const [currentSpeedKmh, setCurrentSpeedKmh] = useState(0);
  const [mapType, setMapType] = useState<MapType>('standard');
  /**
   * ユーザーがドラッグ操作中かどうかを示す抑止フラグ。
   * onPanDragで立て、onRegionChangeComplete・centerOnCoordinate・アイドルタイマー発火で下ろす。
   * onRegionChangeCompleteの発火有無からは推測しない（プログラム移動でも発火するため）。
   */
  const isUserMapGestureActiveRef = useRef(false);
  /** アイドルタイマー（USER_MAP_GESTURE_IDLE_TIMEOUT_MS）のID。setTimeoutの戻り値を保持する。 */
  const userMapGestureIdleTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  /**
   * 直近に受け取った表示範囲。
   * アイドルタイマー発火時にonRegionChangeCompleteが届いていなくても、この値へgridSyncRegionを
   * 同期するためのフォールバック用途。
   */
  const latestRegionRef = useRef<Region | null>(null);

  /**
   * ユーザー操作アイドルタイマーを張り直す。
   * 既存タイマーをclearしてから USER_MAP_GESTURE_IDLE_TIMEOUT_MS 後に再設定するため、
   * 操作が連続している間は発火しない（「最後のイベントから1000ms何も来ていない」判定になる）。
   *
   * @returns なし。
   */
  function scheduleUserMapGestureIdleSync(): void {
    if (userMapGestureIdleTimeoutRef.current != null) {
      clearTimeout(userMapGestureIdleTimeoutRef.current);
    }

    userMapGestureIdleTimeoutRef.current = setTimeout(() => {
      userMapGestureIdleTimeoutRef.current = null;
      isUserMapGestureActiveRef.current = false;

      if (latestRegionRef.current != null) {
        setGridSyncRegion(latestRegionRef.current);
      }
    }, USER_MAP_GESTURE_IDLE_TIMEOUT_MS);
  }

  /**
   * ユーザー操作アイドルタイマーを解除する。
   * onRegionChangeCompleteやcenterOnCoordinateなど、操作完了・プログラム移動が確定した契機で呼ぶ。
   *
   * @returns なし。
   */
  function clearUserMapGestureIdleSync(): void {
    if (userMapGestureIdleTimeoutRef.current != null) {
      clearTimeout(userMapGestureIdleTimeoutRef.current);
      userMapGestureIdleTimeoutRef.current = null;
    }
  }

  // アンマウント時にアイドルタイマーを掃除する。クリーンアップを怠るとアンマウント後の
  // setGridSyncRegion呼び出し（Reactの警告対象）につながる。
  useEffect(() => {
    return () => {
      clearUserMapGestureIdleSync();
    };
  }, []);

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
      latestRegionRef.current = region;
      isUserMapGestureActiveRef.current = false;
      clearUserMapGestureIdleSync();
      setGridSyncRegion(region);
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
  // これを防ぐためisMapReady（onMapReadyまたは最初のonRegionChangeCompleteでtrueになる）を
  // 待ってからセンタリングする。現在地が先に届いていれば準備完了時に、準備完了が先なら現在地
  // 到着時に、いずれの順序でも確実にセンタリングが走る。
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

  /**
   * 別画面から地図へ戻った直後に、MapViewの再マウントで広域initialRegionへ戻ることを防ぐ。
   *
   * screenMode 変化（旧 AppCompatShell 経由）と mapRestoreTrigger 増分（expo-router 経由）
   * の両方をトリガーとして受け付ける。
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
  }, [screenMode, userCoordinate, mapRestoreTrigger]);

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
    isUserMapGestureActiveRef.current = true;
    scheduleUserMapGestureIdleSync();
  }

  /**
   * 表示範囲を保存する。追従再開は現在地ボタン押下に限定し、広域表示中の意図しない引き戻しを防ぐ。
   *
   * ネイティブ地図がregion change completeを発火している時点で地図は初期化済みであり、
   * animateToRegionを受け付けられる。New Architecture環境等でonMapReadyが発火しないケースの
   * フォールバックとして、ここでもisMapReadyをtrueにする（同じ値ならReactがbail outするため
   * 再レンダリングコストは増えない）。
   *
   * @param region - MapViewの現在表示範囲。
   * @returns なし。
   */
  function handleRegionChangeComplete(region: Region): void {
    setIsMapReady(true);
    regionChangeThrottleRef.current = Date.now();
    setVisibleRegion(region);
    latestRegionRef.current = region;
    isUserMapGestureActiveRef.current = false;
    clearUserMapGestureIdleSync();
    setGridSyncRegion(region);
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
    latestRegionRef.current = region;

    // ユーザー操作中（onPanDrag済み）はGrid取得用regionを更新せず、アイドルタイマーだけ張り直す。
    // 操作中でなければプログラム移動（追従センタリング等）由来のイベントなので即時同期する。
    if (isUserMapGestureActiveRef.current) {
      scheduleUserMapGestureIdleSync();
      return;
    }

    setGridSyncRegion(region);
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
      const region = createUserCenteredRegion(userCoordinate);
      setVisibleRegion(region);
      latestRegionRef.current = region;
      isUserMapGestureActiveRef.current = false;
      clearUserMapGestureIdleSync();
      setGridSyncRegion(region);
      incrementVisitedGridRefreshVersionRef.current();
      // expo-router 環境では地図ルートがマウントされたままのため、カウンターを
      // インクリメントして restore effect を強制的にトリガーする。
      setMapRestoreTrigger((prev) => prev + 1);
    }
  }

  return {
    mapRef,
    userCoordinate,
    isFollowingUserLocation,
    isMapReady,
    visibleRegion,
    gridSyncRegion,
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
