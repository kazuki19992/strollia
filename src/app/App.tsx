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
  StyleSheet,
  Switch,
  Text,
  useColorScheme,
  View,
} from 'react-native';
import MapView, { Marker, Polyline, Region, UserLocationChangeEvent } from 'react-native-maps';

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
import { deleteAllLogData, getAllLocationPoints, getDailyLogs, getLocationPointsByDate } from '../features/logs/logRepository';
import { getEndpointMarkers } from '../features/map/endpointMarkers';
import { isRegionCenteredOnCoordinate } from '../features/map/followUserLocation';
import { createInitialRegion, filterRouteCoordinatesByRegion, toRenderRouteCoordinates } from '../features/map/routeMapper';
import { getBooleanSetting, setSetting } from '../features/settings/settingsRepository';
import { DailyLogSummary, LocationPoint } from '../types/gps';
import type { LatLng, MapType } from 'react-native-maps';
import { AppTheme, getAppTheme } from '../theme/theme';
import { formatTime } from '../utils/date';
import { totalDistanceMeters } from '../utils/distance';

/** ルートライブラリを使わない単一App内の簡易画面状態。 */
type ScreenMode = 'map' | 'dailyLogs' | 'settings';
/** 自動GPS記録の開始状態をユーザー向け文言へ変換するための状態。 */
type AutoStartStatus = 'checking' | 'recording' | 'needsPermission' | 'failed';

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
  const menuProgress = useRef(new Animated.Value(0)).current;
  const screenTransitionOpacity = useRef(new Animated.Value(1)).current;
  const [isReady, setIsReady] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isMenuVisible, setIsMenuVisible] = useState(false);
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

  const renderRouteCoordinates = useMemo(() => toRenderRouteCoordinates(points), [points]);
  const visibleRouteCoordinates = useMemo(
    () => filterRouteCoordinatesByRegion(renderRouteCoordinates, visibleRegion),
    [renderRouteCoordinates, visibleRegion],
  );
  const initialRegion = useMemo(() => createInitialRegion(points), [points]);
  const distance = useMemo(() => {
    const canUseStoredDistance = dailyLogs.every((log) => log.distanceMeters != null);

    if (canUseStoredDistance) {
      return dailyLogs.reduce((total, log) => total + (log.distanceMeters ?? 0), 0);
    }

    return totalDistanceMeters(points);
  }, [dailyLogs, points]);
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

  useEffect(() => {
    if (keepScreenAwake && appState === 'active') {
      activateKeepAwakeAsync(KEEP_AWAKE_TAG).catch(() => undefined);
      return;
    }

    deactivateKeepAwake(KEEP_AWAKE_TAG).catch(() => undefined);
  }, [appState, keepScreenAwake]);

  useEffect(() => {
    return () => {
      deactivateKeepAwake(KEEP_AWAKE_TAG).catch(() => undefined);
    };
  }, []);



  // 逆ジオコーディングは現在地ピルの市区町村表示にだけ使う。
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

        const address = addresses[0];
        const area = address?.city ?? address?.district ?? address?.subregion ?? address?.region ?? '現在地付近';
        setCurrentAreaName(area);
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

  useEffect(() => {
    Animated.timing(recenterButtonOpacity, {
      toValue: isFollowingUserLocation ? 0 : 1,
      duration: 500,
      useNativeDriver: true,
    }).start();
  }, [isFollowingUserLocation, recenterButtonOpacity]);

  // 閉じる時はアニメーション完了までメニューをアンマウントしない。
  useEffect(() => {
    if (isMenuOpen) {
      setIsMenuVisible(true);
    }

    Animated.timing(menuProgress, {
      toValue: isMenuOpen ? 1 : 0,
      duration: MENU_ANIMATION_DURATION_MS,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start(({ finished }) => {
      if (finished && !isMenuOpen) {
        setIsMenuVisible(false);
      }
    });
  }, [isMenuOpen, menuProgress]);

  useEffect(() => {
    screenTransitionOpacity.setValue(0);
    Animated.timing(screenTransitionOpacity, {
      toValue: 1,
      duration: SCREEN_TRANSITION_DURATION_MS,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [screenMode, screenTransitionOpacity]);

  useEffect(() => {
    if (screenMode !== 'map' || renderRouteCoordinates.length < 2 || userCoordinate) {
      return;
    }

    mapRef.current?.fitToCoordinates(renderRouteCoordinates, {
      animated: true,
      edgePadding: { bottom: 180, left: 48, right: 48, top: 96 },
    });
  }, [renderRouteCoordinates, screenMode, userCoordinate]);


  /** 現在地更新を受け取り、追従中であれば地図中心も更新する。 */
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

  /** ユーザーが地図を動かしたら現在地追従を一時停止する。 */
  function handleMapPanDrag(): void {
    setIsFollowingUserLocation(false);
  }

  /** 表示範囲を保存し、中心が現在地付近に戻った場合は追従を再開する。 */
  function handleRegionChangeComplete(region: Region): void {
    setVisibleRegion(region);

    if (!userCoordinate) {
      return;
    }

    if (isRegionCenteredOnCoordinate(region, userCoordinate)) {
      setIsFollowingUserLocation(true);
    }
  }

  /** 指定座標が画面中心になるよう地図を移動する。 */
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

  /** 現在地ボタン押下時に追従を再開して現在地へ戻す。 */
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

  /** 画面遷移時にメニュー状態とアニメーション値を即座に初期化する。 */
  function resetMenuImmediately(): void {
    menuProgress.stopAnimation();
    menuProgress.setValue(0);
    setIsMenuOpen(false);
    setIsMenuVisible(false);
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

  /** 標準地図とラベル付き航空写真を切り替える。 */
  function toggleMapType(): void {
    triggerSelectionHaptic();
    setMapType((currentMapType) => (currentMapType === 'standard' ? 'hybrid' : 'standard'));
    setIsMenuOpen(false);
  }

  /** 未実装のインポート導線として予定メッセージを表示する。 */
  function showImportPlaceholder(): void {
    triggerSelectionHaptic();
    Alert.alert('インポート', 'GPX / KML インポートは今後実装予定です。');
  }

  /** 全履歴ルートを表示するメイン地図画面を描画する。 */
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

  /** 日別ログ一覧画面を描画する。 */
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

  /** GPS記録、画面ON維持、データ操作をまとめた設定画面を描画する。 */
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

/** 自動記録状態を設定画面向けの説明文へ変換する。 */
function getAutoRecordNote(status: AutoStartStatus): string {
  switch (status) {
    case 'checking':
      return '自動記録の状態を確認しています。';
    case 'recording':
      return '自動記録は有効です。GPSログをバックグラウンドで保存します。';
    case 'needsPermission':
      return '自動記録は待機中です。位置情報権限を許可すると記録できます。';
    case 'failed':
      return '自動記録を開始できませんでした。設定から権限と記録状態を確認してください。';
  }
}

/** 1日分の記録サマリーとミニマップを表示するカード。 */
function DailyLogCard({ log, styles, theme }: { log: DailyLogSummary; styles: ReturnType<typeof createStyles>; theme: AppTheme }) {
  const [dailyPoints, setDailyPoints] = useState<LocationPoint[]>([]);

  useEffect(() => {
    getLocationPointsByDate(log.localDate)
      .then(setDailyPoints)
      .catch(() => setDailyPoints([]));
  }, [log.localDate]);

  const dailyDistance = useMemo(() => log.distanceMeters ?? totalDistanceMeters(dailyPoints), [dailyPoints, log.distanceMeters]);
  const dailyRouteCoordinates = useMemo(() => toRenderRouteCoordinates(dailyPoints), [dailyPoints]);
  const dailyRegion = useMemo(() => createInitialRegion(dailyPoints), [dailyPoints]);
  const endpointMarkers = useMemo(() => getEndpointMarkers(dailyPoints), [dailyPoints]);

  return (
    <View style={styles.dailyCard}>
      <Text style={styles.dailyDate}>{log.localDate}</Text>
      <View style={styles.dailyStatsRow}>
        <Text style={styles.dailyStat}>{log.pointCount} pts</Text>
        <Text style={styles.dailyStat}>{(dailyDistance / 1000).toFixed(2)} km</Text>
      </View>
      <Text style={styles.dailyTime}>
        {formatTime(log.startedAt)} - {formatTime(log.endedAt)}
      </Text>

      {dailyPoints.length > 0 && (
        <View style={styles.dailyMapFrame}>
          <MapView
            style={styles.dailyMap}
            initialRegion={dailyRegion}
            scrollEnabled={false}
            zoomEnabled={false}
            rotateEnabled={false}
            pitchEnabled={false}
          >
            {dailyRouteCoordinates.length > 1 && (
              <Polyline coordinates={dailyRouteCoordinates} strokeColor={theme.colors.mapLine} strokeWidth={4} />
            )}
            {endpointMarkers.map((marker) => (
              <Marker
                key={marker.id}
                coordinate={{ latitude: marker.point.latitude, longitude: marker.point.longitude }}
                anchor={{ x: 0.5, y: 1 }}
                title={marker.label}
                description={marker.point.recordedAt}
              >
                <View style={[styles.endpointMarker, { backgroundColor: marker.color }]}>
                  <Text style={styles.endpointMarkerText}>{marker.label}</Text>
                </View>
              </Marker>
            ))}
          </MapView>
        </View>
      )}
    </View>
  );
}

/** 現在のテーマから画面全体のStyleSheetを生成する。 */
function createStyles(theme: AppTheme) {
  const { colors } = theme;

  return StyleSheet.create({
    actions: {
      flexDirection: 'row',
      gap: 10,
    },
    autoRecordNote: {
      color: colors.mutedText,
      fontSize: 13,
      fontWeight: '700',
      lineHeight: 18,
    },
    backButton: {
      backgroundColor: colors.card,
      borderColor: colors.border,
      borderRadius: 999,
      borderWidth: 1,
      paddingHorizontal: 14,
      paddingVertical: 10,
    },
    backButtonText: {
      color: colors.primary,
      fontWeight: '900',
    },
    bottomBar: {
      alignItems: 'center',
      bottom: 26,
      flexDirection: 'row',
      gap: 12,
      left: 16,
      position: 'absolute',
      right: 16,
      zIndex: 2,
    },
    bottomSideSpacer: {
      width: 50,
    },
    buttonDisabled: {
      opacity: 0.38,
    },
    container: {
      backgroundColor: colors.background,
      flex: 1,
    },
    dangerAction: {
      alignItems: 'center',
      backgroundColor: colors.dangerSurface,
      borderColor: colors.danger,
      borderRadius: 18,
      borderWidth: 1,
      flexDirection: 'row',
      gap: 10,
      paddingHorizontal: 16,
      paddingVertical: 14,
    },
    dangerActionText: {
      color: colors.danger,
      fontWeight: '900',
    },
    dailyCard: {
      backgroundColor: colors.card,
      borderColor: colors.border,
      borderRadius: 24,
      borderWidth: 1,
      gap: 10,
      padding: 16,
    },
    dailyContainer: {
      backgroundColor: colors.background,
      flex: 1,
    },
    dailyDate: {
      color: colors.text,
      fontSize: 22,
      fontWeight: '900',
    },
    dailyEmptyCard: {
      backgroundColor: colors.card,
      borderRadius: 24,
      gap: 8,
      margin: 16,
      padding: 18,
    },
    dailyHeader: {
      alignItems: 'center',
      flexDirection: 'row',
      gap: 12,
      justifyContent: 'space-between',
      padding: 16,
    },
    dailyList: {
      gap: 12,
      padding: 16,
      paddingTop: 0,
    },
    dailyMap: {
      height: 180,
      width: '100%',
    },
    dailyMapFrame: {
      borderRadius: 20,
      marginTop: 4,
      overflow: 'hidden',
    },
    dailyStat: {
      color: colors.text,
      fontWeight: '800',
    },
    dailyStatsRow: {
      flexDirection: 'row',
      gap: 16,
    },
    dailyTime: {
      color: colors.mutedText,
      fontWeight: '700',
    },
    dailyTitle: {
      color: colors.text,
      flex: 1,
      fontSize: 20,
      fontWeight: '900',
      textAlign: 'center',
    },
    endpointMarker: {
      borderColor: colors.card,
      borderRadius: 999,
      borderWidth: 2,
      paddingHorizontal: 10,
      paddingVertical: 6,
      shadowColor: colors.shadow,
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.2,
      shadowRadius: 8,
    },
    endpointMarkerText: {
      color: colors.primaryText,
      fontSize: 12,
      fontWeight: '900',
    },
    emptyCard: {
      alignSelf: 'center',
      backgroundColor: colors.surfaceOverlay,
      borderRadius: 24,
      gap: 6,
      marginHorizontal: 24,
      marginTop: 92,
      padding: 18,
    },
    emptyText: {
      color: colors.mutedText,
      lineHeight: 20,
    },
    emptyTitle: {
      color: colors.text,
      fontSize: 18,
      fontWeight: '800',
    },
    iconButton: {
      backgroundColor: colors.surfaceOverlay,
      borderRadius: 999,
      paddingHorizontal: 14,
      paddingVertical: 10,
    },
    iconButtonText: {
      color: colors.text,
      fontWeight: '800',
    },
    headerSpacer: {
      width: 70,
    },
    locationMeta: {
      color: colors.mutedText,
      fontSize: 12,
      fontWeight: '800',
    },
    locationName: {
      color: colors.text,
      fontSize: 15,
      fontWeight: '900',
    },
    locationPill: {
      alignItems: 'center',
      backgroundColor: colors.surfaceOverlay,
      borderColor: colors.border,
      borderRadius: 999,
      borderWidth: 1,
      gap: 2,
      flex: 1,
      maxWidth: 260,
      paddingHorizontal: 18,
      paddingVertical: 10,
      shadowColor: colors.shadow,
      shadowOffset: { width: 0, height: 10 },
      shadowOpacity: 0.12,
      shadowRadius: 18,
    },
    loadingContainer: {
      alignItems: 'center',
      backgroundColor: colors.background,
      flex: 1,
      justifyContent: 'center',
    },
    loadingText: {
      color: colors.text,
      marginTop: 12,
    },
    map: {
      ...StyleSheet.absoluteFillObject,
    },
    menuButton: {
      alignItems: 'center',
      backgroundColor: colors.surfaceOverlay,
      borderRadius: 999,
      height: 42,
      justifyContent: 'center',
      width: 42,
    },

    menuCard: {
      backgroundColor: colors.cardStrong,
      borderColor: colors.border,
      borderRadius: 26,
      borderWidth: 1,
      overflow: 'hidden',
      position: 'absolute',
      right: 16,
      shadowColor: colors.shadow,
      shadowOffset: { width: 0, height: 18 },
      shadowOpacity: 0.2,
      shadowRadius: 28,
      top: 70,
      width: 248,
      zIndex: 3,
    },
    menuScrim: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: theme.name === 'dark' ? 'rgba(0, 0, 0, 0.5)' : 'rgba(45, 36, 22, 0.24)',
      zIndex: 1,
    },
    menuScrimPressable: {
      flex: 1,
    },
    menuItem: {
      alignItems: 'center',
      borderBottomColor: colors.border,
      borderBottomWidth: 1,
      flexDirection: 'row',
      gap: 14,
      paddingHorizontal: 20,
      paddingVertical: 18,
    },
    menuItemText: {
      color: colors.text,
      fontSize: 17,
      fontWeight: '900',
    },
    message: {
      color: colors.mutedText,
      lineHeight: 20,
    },
    overlay: {
      ...StyleSheet.absoluteFillObject,
    },
    permissionButton: {
      alignItems: 'center',
      backgroundColor: colors.danger,
      borderRadius: 999,
      paddingHorizontal: 16,
      paddingVertical: 12,
    },
    permissionButtonText: {
      color: colors.primaryText,
      fontWeight: '900',
    },
    permissionCard: {
      alignSelf: 'center',
      backgroundColor: colors.dangerSurface,
      borderColor: colors.danger,
      borderRadius: 24,
      borderWidth: 1,
      gap: 10,
      marginHorizontal: 20,
      marginTop: 92,
      padding: 16,
    },
    permissionSettingsBox: {
      backgroundColor: colors.dangerSurface,
      borderColor: colors.danger,
      borderRadius: 20,
      borderWidth: 1,
      gap: 10,
      padding: 14,
    },
    permissionText: {
      color: colors.mutedText,
      lineHeight: 20,
    },
    permissionTitle: {
      color: colors.danger,
      fontSize: 17,
      fontWeight: '900',
    },
    primaryButton: {
      alignItems: 'center',
      backgroundColor: colors.primary,
      borderRadius: 999,
      flex: 1,
      paddingHorizontal: 18,
      paddingVertical: 14,
    },
    primaryButtonText: {
      color: colors.primaryText,
      fontWeight: '900',
    },
    screenTransition: {
      flex: 1,
    },
    secondaryButton: {
      alignItems: 'center',
      backgroundColor: colors.card,
      borderColor: colors.primary,
      borderRadius: 999,
      borderWidth: 1,
      minWidth: 92,
      paddingHorizontal: 16,
      paddingVertical: 14,
    },
    secondaryButtonText: {
      color: colors.primary,
      fontWeight: '900',
    },
    recenterButton: {
      alignItems: 'center',
      backgroundColor: colors.surfaceOverlay,
      borderColor: colors.border,
      borderRadius: 999,
      borderWidth: 1,
      height: 50,
      justifyContent: 'center',
      shadowColor: colors.shadow,
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.14,
      shadowRadius: 16,
      width: 50,
    },
    recenterButtonContainer: {
      alignItems: 'flex-end',
      width: 50,
    },
    rightControls: {
      flexDirection: 'row',
      gap: 10,
    },
    settingsAction: {
      alignItems: 'center',
      backgroundColor: colors.cardStrong,
      borderRadius: 18,
      flexDirection: 'row',
      gap: 10,
      paddingHorizontal: 16,
      paddingVertical: 14,
    },
    settingsActionText: {
      color: colors.primary,
      fontWeight: '900',
    },
    settingsCard: {
      backgroundColor: colors.card,
      borderColor: colors.border,
      borderRadius: 24,
      borderWidth: 1,
      gap: 14,
      padding: 16,
    },
    settingsDescription: {
      color: colors.mutedText,
      lineHeight: 20,
    },
    settingsList: {
      gap: 12,
      padding: 16,
      paddingTop: 0,
    },
    settingsStatusRow: {
      alignItems: 'center',
      flexDirection: 'row',
      gap: 8,
    },
    settingsStatusText: {
      color: colors.text,
      fontWeight: '900',
    },
    settingsTitle: {
      color: colors.text,
      fontSize: 20,
      fontWeight: '900',
    },
    settingsToggleRow: {
      alignItems: 'center',
      flexDirection: 'row',
      gap: 14,
    },
    settingsToggleTextColumn: {
      flex: 1,
      gap: 8,
    },
    stat: {
      color: colors.text,
      fontWeight: '800',
    },
    statsRow: {
      flexDirection: 'row',
      gap: 16,
    },
    statusDot: {
      backgroundColor: colors.border,
      borderRadius: 999,
      height: 9,
      width: 9,
    },
    statusDotActive: {
      backgroundColor: colors.primary,
    },
    statusPill: {
      alignItems: 'center',
      backgroundColor: colors.surfaceOverlay,
      borderRadius: 999,
      flexDirection: 'row',
      gap: 8,
      paddingHorizontal: 14,
      paddingVertical: 10,
    },
    statusText: {
      color: colors.text,
      fontWeight: '900',
    },
    topBar: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      paddingHorizontal: 16,
      paddingTop: 8,
      zIndex: 2,
    },
  });
}
