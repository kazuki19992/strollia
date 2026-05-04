import { activateKeepAwakeAsync, deactivateKeepAwake } from 'expo-keep-awake';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  AppState,
  AppStateStatus,
  Linking,
  Animated,
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
import { getAllLocationPoints, getDailyLogs, getLocationPointsByDate } from '../features/logs/logRepository';
import { getEndpointMarkers } from '../features/map/endpointMarkers';
import { isRegionCenteredOnCoordinate } from '../features/map/followUserLocation';
import { createInitialRegion, toRouteCoordinates } from '../features/map/routeMapper';
import { getBooleanSetting, setSetting } from '../features/settings/settingsRepository';
import { DailyLogSummary, LocationPoint } from '../types/gps';
import type { LatLng } from 'react-native-maps';
import { AppTheme, getAppTheme } from '../theme/theme';
import { formatTime } from '../utils/date';
import { totalDistanceMeters } from '../utils/distance';

type ScreenMode = 'map' | 'dailyLogs' | 'settings';
type AutoStartStatus = 'checking' | 'recording' | 'needsPermission' | 'failed';

const KEEP_AWAKE_TAG = 'strollia-foreground-map';
const KEEP_SCREEN_AWAKE_SETTING_KEY = 'keepScreenAwake';

const EMPTY_PERMISSION_STATE: LocationPermissionState = {
  foregroundGranted: false,
  backgroundGranted: false,
  canAskForeground: true,
  canAskBackground: true,
};

export default function App() {
  const colorScheme = useColorScheme();
  const theme = useMemo(() => getAppTheme(colorScheme), [colorScheme]);
  const styles = useMemo(() => createStyles(theme), [theme]);
  const mapRef = useRef<MapView | null>(null);
  const autoStartAttemptedRef = useRef(false);
  const recenterButtonOpacity = useRef(new Animated.Value(0)).current;
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

  const routeCoordinates = useMemo(() => toRouteCoordinates(points), [points]);
  const initialRegion = useMemo(() => createInitialRegion(points), [points]);
  const distance = useMemo(() => totalDistanceMeters(points), [points]);
  const hasRequiredPermission = hasRequiredLocationPermission(permissionState);
  const shouldOpenSettingsForPermission = !canRequestLocationPermissionInApp(permissionState);

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

  const requestLocationPermission = useCallback(async (): Promise<void> => {
    if (shouldOpenSettingsForPermission) {
      await Linking.openSettings();
      return;
    }

    await startRecording('manual');
  }, [shouldOpenSettingsForPermission, startRecording]);

  const exportAllLogs = useCallback(async (): Promise<void> => {
    try {
      await shareGpx(points, 'all');
    } catch (error: unknown) {
      Alert.alert('エクスポート失敗', error instanceof Error ? error.message : 'GPX出力に失敗しました。');
    }
  }, [points]);

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


  useEffect(() => {
    Animated.timing(recenterButtonOpacity, {
      toValue: isFollowingUserLocation ? 0 : 1,
      duration: 500,
      useNativeDriver: true,
    }).start();
  }, [isFollowingUserLocation, recenterButtonOpacity]);

  useEffect(() => {
    if (screenMode !== 'map' || routeCoordinates.length < 2 || userCoordinate) {
      return;
    }

    mapRef.current?.fitToCoordinates(routeCoordinates, {
      animated: true,
      edgePadding: { bottom: 180, left: 48, right: 48, top: 96 },
    });
  }, [routeCoordinates, screenMode, userCoordinate]);


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

  function handleMapPanDrag(): void {
    setIsFollowingUserLocation(false);
  }

  function handleRegionChangeComplete(region: Region): void {
    if (!userCoordinate) {
      return;
    }

    if (isRegionCenteredOnCoordinate(region, userCoordinate)) {
      setIsFollowingUserLocation(true);
    }
  }

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

  function recenterOnUserLocation(): void {
    if (!userCoordinate) {
      return;
    }

    setIsFollowingUserLocation(true);
    centerOnCoordinate(userCoordinate);
  }

  function openDailyLogs(): void {
    setIsMenuOpen(false);
    setScreenMode('dailyLogs');
  }

  function openMap(): void {
    setScreenMode('map');
    setIsMenuOpen(false);
  }

  function openSettings(): void {
    setIsMenuOpen(false);
    setScreenMode('settings');
  }

  function showImportPlaceholder(): void {
    Alert.alert('インポート', 'GPX / KML インポートは今後実装予定です。');
  }

  function renderMapScreen() {
    return (
      <View style={styles.container}>
        <MapView
          ref={mapRef}
          style={styles.map}
          initialRegion={initialRegion}
          showsUserLocation
          followsUserLocation={isFollowingUserLocation}
          onUserLocationChange={handleUserLocationChange}
          onPanDrag={handleMapPanDrag}
          onRegionChangeComplete={handleRegionChangeComplete}
        >
          {routeCoordinates.length > 1 && (
            <Polyline coordinates={routeCoordinates} strokeColor={theme.colors.mapLine} strokeWidth={5} />
          )}
        </MapView>

        <SafeAreaView pointerEvents="box-none" style={styles.overlay}>
          {isMenuOpen && <Pressable onPress={() => setIsMenuOpen(false)} style={styles.menuScrim} />}

          <View style={styles.topBar}>
            <View style={styles.statusPill}>
              <View style={[styles.statusDot, isRecording && styles.statusDotActive]} />
              <Text style={styles.statusText}>{isRecording ? '記録中' : '停止中'}</Text>
            </View>
            <View style={styles.rightControls}>
              <Pressable onPress={refreshData} style={styles.iconButton}>
                <Text style={styles.iconButtonText}>更新</Text>
              </Pressable>
              <Pressable onPress={() => setIsMenuOpen((open) => !open)} style={styles.menuButton}>
                <Text style={styles.menuButtonText}>⋮</Text>
              </Pressable>
            </View>
          </View>

          {isMenuOpen && (
            <View style={styles.menuCard}>
              <Pressable onPress={openDailyLogs} style={styles.menuItem}>
                <Text style={styles.menuItemText}>日ごとの記録</Text>
              </Pressable>
              <Pressable onPress={openSettings} style={styles.menuItem}>
                <Text style={styles.menuItemText}>設定</Text>
              </Pressable>
            </View>
          )}


          <Animated.View
            pointerEvents={isFollowingUserLocation ? 'none' : 'auto'}
            style={[styles.recenterButtonContainer, { opacity: recenterButtonOpacity }]}
          >
            <Pressable onPress={recenterOnUserLocation} style={styles.recenterButton}>
              <Text style={styles.recenterButtonText}>現在地</Text>
            </Pressable>
          </Animated.View>

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

          <View style={styles.bottomPanel}>
            <Text style={styles.message}>{message}</Text>
            <View style={styles.statsRow}>
              <Text style={styles.stat}>{points.length} pts</Text>
              <Text style={styles.stat}>{(distance / 1000).toFixed(2)} km</Text>
              <Text style={styles.stat}>{dailyLogs.length} days</Text>
            </View>
            <Text style={styles.autoRecordNote}>{getAutoRecordNote(autoStartStatus)}</Text>
          </View>
        </SafeAreaView>
      </View>
    );
  }

  function renderDailyLogsScreen() {
    return (
      <SafeAreaView style={styles.dailyContainer}>
        <View style={styles.dailyHeader}>
          <Pressable onPress={openMap} style={styles.backButton}>
            <Text style={styles.backButtonText}>地図へ</Text>
          </Pressable>
          <Text style={styles.dailyTitle}>日ごとの記録</Text>
          <Pressable onPress={refreshData} style={styles.iconButton}>
            <Text style={styles.iconButtonText}>更新</Text>
          </Pressable>
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

  function renderSettingsScreen() {
    return (
      <SafeAreaView style={styles.dailyContainer}>
        <View style={styles.dailyHeader}>
          <Pressable onPress={openMap} style={styles.backButton}>
            <Text style={styles.backButtonText}>地図へ</Text>
          </Pressable>
          <Text style={styles.dailyTitle}>設定</Text>
          <Pressable onPress={refreshData} style={styles.iconButton}>
            <Text style={styles.iconButtonText}>更新</Text>
          </Pressable>
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
              <Text style={styles.settingsActionText}>データのエクスポート</Text>
            </Pressable>
            <Pressable onPress={showImportPlaceholder} style={styles.settingsAction}>
              <Text style={styles.settingsActionText}>データのインポート</Text>
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
      {screenMode === 'map' && renderMapScreen()}
      {screenMode === 'dailyLogs' && renderDailyLogsScreen()}
      {screenMode === 'settings' && renderSettingsScreen()}
    </View>
  );
}

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

function DailyLogCard({ log, styles, theme }: { log: DailyLogSummary; styles: ReturnType<typeof createStyles>; theme: AppTheme }) {
  const [dailyPoints, setDailyPoints] = useState<LocationPoint[]>([]);

  useEffect(() => {
    getLocationPointsByDate(log.localDate)
      .then(setDailyPoints)
      .catch(() => setDailyPoints([]));
  }, [log.localDate]);

  const dailyDistance = useMemo(() => totalDistanceMeters(dailyPoints), [dailyPoints]);
  const dailyRouteCoordinates = useMemo(() => toRouteCoordinates(dailyPoints), [dailyPoints]);
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
    bottomPanel: {
      backgroundColor: colors.surfaceOverlay,
      borderColor: colors.border,
      borderRadius: 28,
      borderWidth: 1,
      gap: 14,
      margin: 16,
      padding: 16,
      shadowColor: colors.shadow,
      shadowOffset: { width: 0, height: 14 },
      shadowOpacity: 0.16,
      shadowRadius: 28,
    },
    buttonDisabled: {
      opacity: 0.38,
    },
    container: {
      backgroundColor: colors.background,
      flex: 1,
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
    menuButtonText: {
      color: colors.text,
      fontSize: 34,
      fontWeight: '900',
      lineHeight: 34,
      transform: [{ translateY: -1 }],
    },
    menuCard: {
      backgroundColor: colors.card,
      borderColor: colors.border,
      borderRadius: 22,
      borderWidth: 1,
      overflow: 'hidden',
      position: 'absolute',
      right: 16,
      top: 66,
      width: 190,
      zIndex: 3,
    },
    menuScrim: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: colors.scrim,
      zIndex: 1,
    },
    menuItem: {
      borderBottomColor: colors.border,
      borderBottomWidth: 1,
      paddingHorizontal: 16,
      paddingVertical: 14,
    },
    menuItemText: {
      color: colors.text,
      fontWeight: '800',
    },
    message: {
      color: colors.mutedText,
      lineHeight: 20,
    },
    overlay: {
      ...StyleSheet.absoluteFillObject,
      justifyContent: 'space-between',
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
      backgroundColor: colors.surfaceOverlay,
      borderColor: colors.border,
      borderRadius: 999,
      borderWidth: 1,
      paddingHorizontal: 18,
      paddingVertical: 12,
      shadowColor: colors.shadow,
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.14,
      shadowRadius: 16,
    },
    recenterButtonContainer: {
      alignItems: 'center',
      marginTop: 70,
      zIndex: 2,
    },
    recenterButtonText: {
      color: colors.primary,
      fontWeight: '900',
    },
    rightControls: {
      flexDirection: 'row',
      gap: 10,
    },
    settingsAction: {
      backgroundColor: colors.cardStrong,
      borderRadius: 18,
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
