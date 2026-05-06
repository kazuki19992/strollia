import { AntDesign, Entypo, Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { activateKeepAwakeAsync, deactivateKeepAwake } from 'expo-keep-awake';
import * as Location from 'expo-location';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  AppState,
  AppStateStatus,
  Linking,
  Animated,
  Easing,
  Pressable,
  SafeAreaView,
  ScrollView,
  Switch,
  Text,
  useColorScheme,
  View,
} from 'react-native';
import MapView, { Polyline, Region, UserLocationChangeEvent } from 'react-native-maps';

import { initializeDatabase } from '../db/database';
import { shareGpx } from '../features/export/gpxExporter';
import {
  isBackgroundLocationRecording,
  startBackgroundLocationRecording,
  stopBackgroundLocationRecording,
} from '../features/location/locationService';
import {
  canRequestLocationPermissionInApp,
  getLocationPermissionState,
  hasRequiredLocationPermission,
  LocationPermissionState,
} from '../features/location/locationPermission';
import { deleteAllLogData, getAllLocationPoints, getDailyLogs } from '../features/logs/logRepository';
import { isRegionCenteredOnCoordinate } from '../features/map/followUserLocation';
import { getBooleanSetting, setSetting } from '../features/settings/settingsRepository';
import { DailyLogSummary, LocationPoint } from '../types/gps';
import type { LatLng, MapType } from 'react-native-maps';
import { getAppTheme } from '../theme/theme';
import { getAreaNameFromAddress } from './areaName';
import { createStyles } from './appStyles';
import { getAutoRecordNote } from './appText';
import { AutoStartStatus, ScreenMode } from './appTypes';
import { DailyLogCard } from './components/DailyLogCard';
import { useMapRouteState } from './hooks/useMapRouteState';
import { useMenuAnimation } from './hooks/useMenuAnimation';
import { getNextMapType } from './mapType';

/** expo-keep-awakeでこの画面のロック抑止を識別するタグ。 */
const KEEP_AWAKE_TAG = 'strollia-foreground-map';
/** 画面ON維持設定をSQLiteへ保存するキー。 */
const KEEP_SCREEN_AWAKE_SETTING_KEY = 'keepScreenAwake';
/** メニュー開閉が軽く感じる短めのアニメーション時間。 */
const MENU_ANIMATION_DURATION_MS = 220;
/** 画面切り替えのちらつきを抑えるフェード時間。 */
const SCREEN_TRANSITION_DURATION_MS = 180;

/** 権限状態を取得する前にUIが参照する安全な初期値。 */
const EMPTY_PERMISSION_STATE: LocationPermissionState = {
  foregroundGranted: false,
  backgroundGranted: false,
  canAskForeground: true,
  canAskBackground: true,
};

/** Strolliaの画面状態、地図表示、端末API連携を束ねるルートコンポーネント。 */
export default function App() {
  const colorScheme = useColorScheme();
  const theme = useMemo(() => getAppTheme(colorScheme), [colorScheme]);
  const styles = useMemo(() => createStyles(theme), [theme]);
  const mapRef = useRef<MapView | null>(null);
  const autoStartAttemptedRef = useRef(false);
  const recenterButtonOpacity = useRef(new Animated.Value(0)).current;
  const screenTransitionOpacity = useRef(new Animated.Value(1)).current;
  const [isReady, setIsReady] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [screenMode, setScreenMode] = useState<ScreenMode>('map');
  const [dailyLogs, setDailyLogs] = useState<DailyLogSummary[]>([]);
  const [points, setPoints] = useState<LocationPoint[]>([]);
  const [message, setMessage] = useState('起動後に自動でGPS記録を開始します。');
  const [autoStartStatus, setAutoStartStatus] = useState<AutoStartStatus>('checking');
  const [permissionState, setPermissionState] = useState<LocationPermissionState>(EMPTY_PERMISSION_STATE);
  const [keepScreenAwake, setKeepScreenAwake] = useState(false);
  const [appState, setAppState] = useState<AppStateStatus>(AppState.currentState);
  const [userCoordinate, setUserCoordinate] = useState<LatLng | null>(null);
  const [isFollowingUserLocation, setIsFollowingUserLocation] = useState(true);
  const [currentAreaName, setCurrentAreaName] = useState('現在地を確認中');
  const [visibleRegion, setVisibleRegion] = useState<Region | null>(null);
  const [mapType, setMapType] = useState<MapType>('standard');

  const { renderRouteCoordinates, visibleRouteCoordinates, initialRegion, distance } = useMapRouteState(
    points,
    dailyLogs,
    visibleRegion,
  );
  const { isMenuVisible, menuProgress, resetMenuImmediately } = useMenuAnimation(isMenuOpen, MENU_ANIMATION_DURATION_MS);
  const hasRequiredPermission = hasRequiredLocationPermission(permissionState);
  const shouldOpenSettingsForPermission = !canRequestLocationPermissionInApp(permissionState);

  /** DB、記録状態、権限状態をまとめて再読み込みし、画面表示を同期する。 */
  const refreshData = useCallback(async () => {
    const [logs, allPoints, recording, permissions] = await Promise.all([
      getDailyLogs(),
      getAllLocationPoints(),
      isBackgroundLocationRecording(),
      getLocationPermissionState(),
    ]);

    setDailyLogs(logs);
    setPoints(allPoints);
    setIsRecording(recording);
    setPermissionState(permissions);

    return { logs, allPoints, recording, permissions };
  }, []);

  /** GPSバックグラウンド記録を開始し、結果をユーザー向けメッセージへ反映する。 */
  const startRecording = useCallback(
    async (reason: 'auto' | 'manual' = 'manual'): Promise<void> => {
      try {
        await startBackgroundLocationRecording();
        const result = await refreshData();
        setMessage(reason === 'auto' ? 'GPS記録を自動開始しました。' : 'バックグラウンドGPS記録を開始しました。');
        setAutoStartStatus(hasRequiredLocationPermission(result.permissions) ? 'recording' : 'needsPermission');
      } catch (error: unknown) {
        await refreshData().catch(() => undefined);
        setMessage(error instanceof Error ? error.message : 'GPS記録の開始に失敗しました。');
        setAutoStartStatus('failed');
      }
    },
    [refreshData],
  );

  /** GPSバックグラウンド記録を停止し、最新状態を再読み込みする。 */
  const stopRecording = useCallback(async (): Promise<void> => {
    try {
      await stopBackgroundLocationRecording();
      await refreshData();
      setMessage('GPS記録を停止しました。');
      setAutoStartStatus('needsPermission');
    } catch (error: unknown) {
      setMessage(error instanceof Error ? error.message : 'GPS記録の停止に失敗しました。');
    }
  }, [refreshData]);

  /** 権限状態に応じてアプリ内要求またはOS設定画面への誘導を行う。 */
  const requestLocationPermission = useCallback(async (): Promise<void> => {
    if (shouldOpenSettingsForPermission) {
      await Linking.openSettings();
      return;
    }

    await startRecording('manual');
  }, [shouldOpenSettingsForPermission, startRecording]);

  /** 全期間のGPSログをGPXとして共有する。 */
  const exportAllLogs = useCallback(async (): Promise<void> => {
    try {
      await shareGpx(points, 'all');
    } catch (error: unknown) {
      Alert.alert('エクスポート失敗', error instanceof Error ? error.message : 'GPX出力に失敗しました。');
    }
  }, [points]);


  /** 確認ダイアログを挟んで保存済みGPSログを全削除する。 */
  const deleteAllData = useCallback(async (): Promise<void> => {
    Alert.alert('すべてのデータを削除', '保存済みのGPSログをすべて削除します。この操作は取り消せません。', [
      { text: 'キャンセル', style: 'cancel' },
      {
        text: '削除する',
        style: 'destructive',
        onPress: () => {
          deleteAllLogData()
            .then(async () => {
              await refreshData();
              setMessage('保存済みGPSログをすべて削除しました。');
            })
            .catch((error: unknown) => {
              Alert.alert('削除失敗', error instanceof Error ? error.message : 'データを削除できませんでした。');
            });
        },
      },
    ]);
  }, [refreshData]);

  /** 画面ON維持設定をUI状態とSQLiteの両方へ反映する。 */
  const updateKeepScreenAwake = useCallback(async (enabled: boolean): Promise<void> => {
    setKeepScreenAwake(enabled);
    await setSetting(KEEP_SCREEN_AWAKE_SETTING_KEY, enabled);
  }, []);

  /**
   * 初回起動時にDBと永続設定を読み込み、アプリを描画可能な状態へ進める。
   */
  useEffect(() => {
    initializeDatabase()
      .then(async () => {
        const savedKeepScreenAwake = await getBooleanSetting(KEEP_SCREEN_AWAKE_SETTING_KEY, false);
        setKeepScreenAwake(savedKeepScreenAwake);
        await refreshData();
      })
      .catch((error: unknown) => {
        setMessage(error instanceof Error ? error.message : 'DB初期化に失敗しました。');
      })
      .finally(() => setIsReady(true));
  }, [refreshData]);

  /**
   * アプリ準備完了後に一度だけバックグラウンドGPS記録の自動開始を試みる。
   */
  useEffect(() => {
    if (!isReady || autoStartAttemptedRef.current) {
      return;
    }

    autoStartAttemptedRef.current = true;

    isBackgroundLocationRecording()
      .then((recording) => {
        if (!recording) {
          return startRecording('auto');
        }

        setIsRecording(true);
        setAutoStartStatus('recording');
        setMessage('GPS記録はすでに開始されています。');
      })
      .catch((error: unknown) => {
        setAutoStartStatus('failed');
        setMessage(error instanceof Error ? error.message : '自動記録の確認に失敗しました。');
      });
  }, [isReady, startRecording]);

  /**
   * フォアグラウンド復帰時にDBと権限状態を再同期する。
   */
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state: AppStateStatus) => {
      setAppState(state);
      if (state === 'active') {
        refreshData().catch((error: unknown) => {
          setMessage(error instanceof Error ? error.message : 'GPSログの再読み込みに失敗しました。');
        });
      }
    });

    return () => subscription.remove();
  }, [refreshData]);


  /**
   * 更新ボタンを不要にするため、フォアグラウンド中は定期的にログを再読み込みする。
   */
  useEffect(() => {
    if (!isReady || appState !== 'active') {
      return;
    }

    const intervalId = setInterval(() => {
      refreshData().catch((error: unknown) => {
        setMessage(error instanceof Error ? error.message : 'GPSログの自動更新に失敗しました。');
      });
    }, 10_000);

    return () => clearInterval(intervalId);
  }, [appState, isReady, refreshData]);

  /**
   * 画面ON維持設定が有効でフォアグラウンドの場合だけロック抑止を有効化する。
   */
  useEffect(() => {
    if (keepScreenAwake && appState === 'active') {
      activateKeepAwakeAsync(KEEP_AWAKE_TAG).catch(() => undefined);
      return;
    }

    deactivateKeepAwake(KEEP_AWAKE_TAG).catch(() => undefined);
  }, [appState, keepScreenAwake]);

  /**
   * アンマウント時にロック抑止を解除し、次回起動や他アプリへ影響を残さない。
   */
  useEffect(() => {
    return () => {
      deactivateKeepAwake(KEEP_AWAKE_TAG).catch(() => undefined);
    };
  }, []);



  /**
   * 逆ジオコーディングは現在地ピルの市区町村表示にだけ使う。
   */
  useEffect(() => {
    if (!userCoordinate || appState !== 'active') {
      return;
    }

    let cancelled = false;

    Location.reverseGeocodeAsync(userCoordinate)
      .then((addresses) => {
        if (cancelled) {
          return;
        }

        setCurrentAreaName(getAreaNameFromAddress(addresses[0]));
      })
      .catch(() => {
        if (!cancelled) {
          setCurrentAreaName('現在地付近');
        }
      });

    return () => {
      cancelled = true;
    };
  }, [appState, userCoordinate]);

  /**
   * 現在地追従が外れた時だけ現在地ボタンをフェード表示する。
   */
  useEffect(() => {
    Animated.timing(recenterButtonOpacity, {
      toValue: isFollowingUserLocation ? 0 : 1,
      duration: 500,
      useNativeDriver: true,
    }).start();
  }, [isFollowingUserLocation, recenterButtonOpacity]);

  /**
   * 画面切り替え時に軽いフェード/スライドを入れて遷移の唐突さを抑える。
   */
  useEffect(() => {
    screenTransitionOpacity.setValue(0);
    Animated.timing(screenTransitionOpacity, {
      toValue: 1,
      duration: SCREEN_TRANSITION_DURATION_MS,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [screenMode, screenTransitionOpacity]);

  /**
   * 初回の現在地取得前だけ、保存済みルート全体が見えるよう地図をフィットする。
   */
  useEffect(() => {
    if (screenMode !== 'map' || renderRouteCoordinates.length < 2 || userCoordinate) {
      return;
    }

    mapRef.current?.fitToCoordinates(renderRouteCoordinates, {
      animated: true,
      edgePadding: { bottom: 180, left: 48, right: 48, top: 96 },
    });
  }, [renderRouteCoordinates, screenMode, userCoordinate]);


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

    const nextCoordinate = { latitude: coordinate.latitude, longitude: coordinate.longitude };
    setUserCoordinate(nextCoordinate);

    if (isFollowingUserLocation) {
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
   * 表示範囲を保存し、中心が現在地付近に戻った場合は追従を再開する。
   *
   * @param region - MapViewの現在表示範囲。
   * @returns なし。
   */
  function handleRegionChangeComplete(region: Region): void {
    setVisibleRegion(region);

    if (!userCoordinate) {
      return;
    }

    if (isRegionCenteredOnCoordinate(region, userCoordinate)) {
      setIsFollowingUserLocation(true);
    }
  }

  /**
   * 指定座標が画面中心になるよう地図を移動する。
   *
   * @param coordinate - 中心へ移動したい緯度経度。
   * @param animated - アニメーション付きで移動するか。
   * @returns なし。
   */
  function centerOnCoordinate(coordinate: LatLng, animated = true): void {
    mapRef.current?.animateToRegion(
      {
        latitude: coordinate.latitude,
        longitude: coordinate.longitude,
        latitudeDelta: 0.01,
        longitudeDelta: 0.01,
      },
      animated ? 500 : 250,
    );
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

  /** 軽い選択操作に使うタプティックを鳴らす。 */
  function triggerSelectionHaptic(): void {
    Haptics.selectionAsync().catch(() => undefined);
  }

  /** 画面遷移など少し強い操作に使うタプティックを鳴らす。 */
  function triggerLightImpactHaptic(): void {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => undefined);
  }

  /** 右上メニューを開閉する。 */
  function toggleMenu(): void {
    triggerSelectionHaptic();
    setIsMenuOpen((open) => !open);
  }

  /** 背景タップなどでメニューを閉じる。通常操作では閉じアニメーションを残す。 */
  function closeMenu(): void {
    if (isMenuOpen) {
      triggerSelectionHaptic();
    }

    setIsMenuOpen(false);
  }

  /** メニューから別画面へ移動する。背景のちらつきを避けるため即時アンマウントはしない。 */
  function navigateToScreen(nextScreenMode: ScreenMode): void {
    triggerLightImpactHaptic();
    setIsMenuOpen(false);
    setScreenMode(nextScreenMode);
  }

  /** 日ごとの記録画面へ移動する。 */
  function openDailyLogs(): void {
    navigateToScreen('dailyLogs');
  }

  /** 地図画面へ戻る。戻る時は残留メニューを確実に掃除する。 */
  function openMap(): void {
    triggerLightImpactHaptic();
    resetMenuImmediately();
    setScreenMode('map');
  }

  /** 設定画面へ移動する。 */
  function openSettings(): void {
    navigateToScreen('settings');
  }

  /**
   * 標準地図とラベル付き航空写真を切り替える。
   *
   * @returns なし。
   */
  function toggleMapType(): void {
    triggerSelectionHaptic();
    setMapType(getNextMapType);
    setIsMenuOpen(false);
  }

  /** 未実装のインポート導線として予定メッセージを表示する。 */
  function showImportPlaceholder(): void {
    triggerSelectionHaptic();
    Alert.alert('インポート', 'GPX / KML インポートは今後実装予定です。');
  }

  /**
   * 全履歴ルートを表示するメイン地図画面を描画する。
   *
   * @returns メイン地図画面のReact要素。
   */
  function renderMapScreen() {
    return (
      <View style={styles.container}>
        <MapView
          ref={mapRef}
          style={styles.map}
          initialRegion={initialRegion}
          mapType={mapType}
          showsCompass
          showsUserLocation
          followsUserLocation={isFollowingUserLocation}
          onUserLocationChange={handleUserLocationChange}
          onPanDrag={handleMapPanDrag}
          onRegionChangeComplete={handleRegionChangeComplete}
          legalLabelInsets={{ bottom: 8, left: 8, right: 8, top: 8 }}
          mapPadding={{ bottom: 96, left: 0, right: 0, top: 58 }}
        >
          {visibleRouteCoordinates.length > 1 && (
            <Polyline coordinates={visibleRouteCoordinates} strokeColor={theme.colors.mapLine} strokeWidth={5} />
          )}
        </MapView>

        <SafeAreaView pointerEvents="box-none" style={styles.overlay}>
          {isMenuVisible && (
            <Animated.View pointerEvents={isMenuOpen ? 'auto' : 'none'} style={[styles.menuScrim, { opacity: menuProgress }]}>
              <Pressable onPress={closeMenu} style={styles.menuScrimPressable} />
            </Animated.View>
          )}

          <View style={styles.topBar}>
            <View style={styles.statusPill}>
              <View style={[styles.statusDot, isRecording && styles.statusDotActive]} />
              <Text style={styles.statusText}>{isRecording ? '記録中' : '停止中'}</Text>
            </View>
            <View style={styles.rightControls}>
              <Pressable onPress={toggleMenu} style={styles.menuButton}>
                <Entypo name="dots-three-vertical" size={24} color={theme.colors.text} />
              </Pressable>
            </View>
          </View>

          {isMenuVisible && (
            <Animated.View
              style={[
                styles.menuCard,
                {
                  opacity: menuProgress,
                  transform: [
                    { translateY: menuProgress.interpolate({ inputRange: [0, 1], outputRange: [-8, 0] }) },
                    { scale: menuProgress.interpolate({ inputRange: [0, 1], outputRange: [0.96, 1] }) },
                  ],
                },
              ]}
            >
              <Pressable onPress={openDailyLogs} style={styles.menuItem}>
                <Feather name="calendar" size={22} color={theme.colors.text} />
                <Text style={styles.menuItemText}>日ごとの記録</Text>
              </Pressable>
              <Pressable onPress={toggleMapType} style={styles.menuItem}>
                <MaterialCommunityIcons
                  name={mapType === 'standard' ? 'satellite-variant' : 'map-outline'}
                  size={23}
                  color={theme.colors.text}
                />
                <Text style={styles.menuItemText}>{mapType === 'standard' ? '航空写真に切替' : '標準地図に切替'}</Text>
              </Pressable>
              <Pressable onPress={openSettings} style={styles.menuItem}>
                <Feather name="settings" size={22} color={theme.colors.text} />
                <Text style={styles.menuItemText}>設定</Text>
              </Pressable>
            </Animated.View>
          )}


          {points.length === 0 && (
            <View style={styles.emptyCard}>
              <Text style={styles.emptyTitle}>まだ足あとがありません</Text>
              <Text style={styles.emptyText}>起動後に自動で記録を開始します。権限を許可して歩いてみましょう。</Text>
            </View>
          )}

          {!hasRequiredPermission && (
            <View style={styles.permissionCard}>
              <Text style={styles.permissionTitle}>位置情報の常時許可が必要です</Text>
              <Text style={styles.permissionText}>バックグラウンドでGPSログを残すには、位置情報を常に許可してください。</Text>
              <Pressable onPress={requestLocationPermission} style={styles.permissionButton}>
                <Text style={styles.permissionButtonText}>{shouldOpenSettingsForPermission ? '設定を開く' : '権限を付与する'}</Text>
              </Pressable>
            </View>
          )}

          <View pointerEvents="box-none" style={styles.bottomBar}>
            <View style={styles.bottomSideSpacer} />
            <View style={styles.locationPill}>
              <Text style={styles.locationName}>{currentAreaName}</Text>
              <Text style={styles.locationMeta}>{(distance / 1000).toFixed(2)} km · {points.length} pts</Text>
            </View>
            <Animated.View
              pointerEvents={isFollowingUserLocation ? 'none' : 'auto'}
              style={[styles.recenterButtonContainer, { opacity: recenterButtonOpacity }]}
            >
              <Pressable onPress={recenterOnUserLocation} style={styles.recenterButton}>
                <AntDesign name="aim" size={24} color={theme.colors.primary} />
              </Pressable>
            </Animated.View>
          </View>
        </SafeAreaView>
      </View>
    );
  }

  /**
   * 日別ログ一覧画面を描画する。
   *
   * @returns 日別ログ一覧画面のReact要素。
   */
  function renderDailyLogsScreen() {
    return (
      <SafeAreaView style={styles.dailyContainer}>
        <View style={styles.dailyHeader}>
          <Pressable onPress={openMap} style={styles.backButton}>
            <Text style={styles.backButtonText}>地図へ</Text>
          </Pressable>
          <Text style={styles.dailyTitle}>日ごとの記録</Text>
          <View style={styles.headerSpacer} />
        </View>

        {dailyLogs.length === 0 ? (
          <View style={styles.dailyEmptyCard}>
            <Text style={styles.emptyTitle}>日別ログはまだありません</Text>
            <Text style={styles.emptyText}>GPSログが保存されると、この画面に日ごとの記録が並びます。</Text>
          </View>
        ) : (
          <ScrollView contentContainerStyle={styles.dailyList}>
            {dailyLogs.map((log) => (
              <DailyLogCard key={log.localDate} log={log} styles={styles} theme={theme} />
            ))}
          </ScrollView>
        )}
      </SafeAreaView>
    );
  }

  /**
   * GPS記録、画面ON維持、データ操作をまとめた設定画面を描画する。
   *
   * @returns 設定画面のReact要素。
   */
  function renderSettingsScreen() {
    return (
      <SafeAreaView style={styles.dailyContainer}>
        <View style={styles.dailyHeader}>
          <Pressable onPress={openMap} style={styles.backButton}>
            <Text style={styles.backButtonText}>地図へ</Text>
          </Pressable>
          <Text style={styles.dailyTitle}>設定</Text>
          <View style={styles.headerSpacer} />
        </View>

        <ScrollView contentContainerStyle={styles.settingsList}>
          <View style={styles.settingsCard}>
            <Text style={styles.settingsTitle}>GPS記録</Text>
            <View style={styles.settingsStatusRow}>
              <View style={[styles.statusDot, isRecording && styles.statusDotActive]} />
              <Text style={styles.settingsStatusText}>{isRecording ? '記録中' : '停止中'}</Text>
            </View>
            <Text style={styles.settingsDescription}>{getAutoRecordNote(autoStartStatus)} 権限が不足している場合は、下のボタンから許可してください。</Text>
            {!hasRequiredPermission ? (
              <View style={styles.permissionSettingsBox}>
                <Text style={styles.permissionTitle}>位置情報の常時許可が必要です</Text>
                <Text style={styles.permissionText}>OSの権限で「常に」許可すると、画面を閉じても記録できます。</Text>
                <Pressable onPress={requestLocationPermission} style={styles.permissionButton}>
                  <Text style={styles.permissionButtonText}>{shouldOpenSettingsForPermission ? '設定を開く' : '権限を付与する'}</Text>
                </Pressable>
              </View>
            ) : (
              <View style={styles.actions}>
                <Pressable
                  disabled={isRecording}
                  onPress={() => startRecording('manual')}
                  style={[styles.primaryButton, isRecording && styles.buttonDisabled]}
                >
                  <Text style={styles.primaryButtonText}>記録開始</Text>
                </Pressable>
                <Pressable
                  disabled={!isRecording}
                  onPress={stopRecording}
                  style={[styles.secondaryButton, !isRecording && styles.buttonDisabled]}
                >
                  <Text style={styles.secondaryButtonText}>停止</Text>
                </Pressable>
              </View>
            )}
          </View>

          <View style={styles.settingsCard}>
            <View style={styles.settingsToggleRow}>
              <View style={styles.settingsToggleTextColumn}>
                <Text style={styles.settingsTitle}>常に画面をONにする</Text>
                <Text style={styles.settingsDescription}>アプリが前面にある間は画面をロックしません。記録の精度が上がる可能性がありますが、消費電力が増えます。</Text>
              </View>
              <Switch
                value={keepScreenAwake}
                onValueChange={(value) => {
                  updateKeepScreenAwake(value).catch((error: unknown) => {
                    Alert.alert('設定保存失敗', error instanceof Error ? error.message : '設定を保存できませんでした。');
                  });
                }}
                trackColor={{ false: theme.colors.border, true: theme.colors.primary }}
                thumbColor={theme.colors.cardStrong}
              />
            </View>
          </View>

          <View style={styles.settingsCard}>
            <Text style={styles.settingsTitle}>データ</Text>
            <Text style={styles.settingsDescription}>GPSログのバックアップや他アプリ連携に使います。</Text>
            <Pressable onPress={exportAllLogs} style={styles.settingsAction}>
              <Feather name="upload" size={18} color={theme.colors.primary} />
              <Text style={styles.settingsActionText}>データのエクスポート</Text>
            </Pressable>
            <Pressable onPress={showImportPlaceholder} style={styles.settingsAction}>
              <Feather name="download" size={18} color={theme.colors.primary} />
              <Text style={styles.settingsActionText}>データのインポート</Text>
            </Pressable>
            <Pressable onPress={deleteAllData} style={styles.dangerAction}>
              <MaterialCommunityIcons name="delete-outline" size={20} color={theme.colors.danger} />
              <Text style={styles.dangerActionText}>すべてのデータを削除</Text>
            </Pressable>
          </View>
        </ScrollView>
      </SafeAreaView>
    );
  }

  if (!isReady) {
    return (
      <SafeAreaView style={styles.loadingContainer}>
        <ActivityIndicator color={theme.colors.primary} />
        <Text style={styles.loadingText}>Strolliaを準備しています...</Text>
      </SafeAreaView>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar style={theme.name === 'dark' ? 'light' : 'dark'} />
      <Animated.View
        style={[
          styles.screenTransition,
          {
            opacity: screenTransitionOpacity,
            transform: [{ translateY: screenTransitionOpacity.interpolate({ inputRange: [0, 1], outputRange: [8, 0] }) }],
          },
        ]}
      >
        {screenMode === 'map' && renderMapScreen()}
        {screenMode === 'dailyLogs' && renderDailyLogsScreen()}
        {screenMode === 'settings' && renderSettingsScreen()}
      </Animated.View>
    </View>
  );
}
