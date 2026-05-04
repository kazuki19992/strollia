import { StatusBar } from 'expo-status-bar';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  AppState,
  AppStateStatus,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import MapView, { Marker, Polyline } from 'react-native-maps';

import { initializeDatabase } from '../db/database';
import { shareGpx } from '../features/export/gpxExporter';
import {
  isBackgroundLocationRecording,
  startBackgroundLocationRecording,
  stopBackgroundLocationRecording,
} from '../features/location/locationService';
import { getAllLocationPoints, getDailyLogs, getLocationPointsByDate } from '../features/logs/logRepository';
import { getEndpointMarkers } from '../features/map/endpointMarkers';
import { createInitialRegion, toRouteCoordinates } from '../features/map/routeMapper';
import { DailyLogSummary, LocationPoint } from '../types/gps';
import { formatTime } from '../utils/date';
import { totalDistanceMeters } from '../utils/distance';

type ScreenMode = 'map' | 'dailyLogs' | 'settings';
type AutoStartStatus = 'checking' | 'recording' | 'needsPermission' | 'failed';

export default function App() {
  const mapRef = useRef<MapView | null>(null);
  const autoStartAttemptedRef = useRef(false);
  const [isReady, setIsReady] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [screenMode, setScreenMode] = useState<ScreenMode>('map');
  const [dailyLogs, setDailyLogs] = useState<DailyLogSummary[]>([]);
  const [points, setPoints] = useState<LocationPoint[]>([]);
  const [message, setMessage] = useState('起動後に自動でGPS記録を開始します。');
  const [autoStartStatus, setAutoStartStatus] = useState<AutoStartStatus>('checking');

  const routeCoordinates = useMemo(() => toRouteCoordinates(points), [points]);
  const initialRegion = useMemo(() => createInitialRegion(points), [points]);
  const distance = useMemo(() => totalDistanceMeters(points), [points]);

  const refreshData = useCallback(async () => {
    const [logs, allPoints, recording] = await Promise.all([
      getDailyLogs(),
      getAllLocationPoints(),
      isBackgroundLocationRecording(),
    ]);

    setDailyLogs(logs);
    setPoints(allPoints);
    setIsRecording(recording);

    return { logs, allPoints, recording };
  }, []);

  const startRecording = useCallback(
    async (reason: 'auto' | 'manual' = 'manual'): Promise<void> => {
      try {
        await startBackgroundLocationRecording();
        await refreshData();
        setMessage(reason === 'auto' ? 'GPS記録を自動開始しました。' : 'バックグラウンドGPS記録を開始しました。');
        setAutoStartStatus('recording');
      } catch (error: unknown) {
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

  const exportAllLogs = useCallback(async (): Promise<void> => {
    try {
      await shareGpx(points, 'all');
    } catch (error: unknown) {
      Alert.alert('エクスポート失敗', error instanceof Error ? error.message : 'GPX出力に失敗しました。');
    }
  }, [points]);

  useEffect(() => {
    initializeDatabase()
      .then(refreshData)
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
      if (state === 'active') {
        refreshData().catch((error: unknown) => {
          setMessage(error instanceof Error ? error.message : 'GPSログの再読み込みに失敗しました。');
        });
      }
    });

    return () => subscription.remove();
  }, [refreshData]);

  useEffect(() => {
    if (screenMode !== 'map' || routeCoordinates.length < 2) {
      return;
    }

    mapRef.current?.fitToCoordinates(routeCoordinates, {
      animated: true,
      edgePadding: { bottom: 180, left: 48, right: 48, top: 96 },
    });
  }, [routeCoordinates, screenMode]);

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
        <MapView ref={mapRef} style={styles.map} initialRegion={initialRegion} showsUserLocation>
          {routeCoordinates.length > 1 && (
            <Polyline coordinates={routeCoordinates} strokeColor="#1f7a5c" strokeWidth={5} />
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

          {points.length === 0 && (
            <View style={styles.emptyCard}>
              <Text style={styles.emptyTitle}>まだ足あとがありません</Text>
              <Text style={styles.emptyText}>起動後に自動で記録を開始します。権限を許可して歩いてみましょう。</Text>
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
              <DailyLogCard key={log.localDate} log={log} />
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
            <Text style={styles.settingsDescription}>{getAutoRecordNote(autoStartStatus)} 権限が不足している場合は、記録開始を押すとOSの権限確認が表示されます。</Text>
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
        <ActivityIndicator />
        <Text style={styles.loadingText}>Strolliaを準備しています...</Text>
      </SafeAreaView>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar style="dark" />
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

function DailyLogCard({ log }: { log: DailyLogSummary }) {
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
              <Polyline coordinates={dailyRouteCoordinates} strokeColor="#1f7a5c" strokeWidth={4} />
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

const styles = StyleSheet.create({
  actions: {
    flexDirection: 'row',
    gap: 10,
  },
  autoRecordNote: {
    color: '#675c4d',
    fontSize: 13,
    fontWeight: '700',
    lineHeight: 18,
  },
  backButton: {
    backgroundColor: '#fffdf8',
    borderColor: '#d6cbb8',
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  backButtonText: {
    color: '#1f7a5c',
    fontWeight: '900',
  },
  bottomPanel: {
    backgroundColor: 'rgba(255, 253, 248, 0.94)',
    borderColor: 'rgba(45, 36, 22, 0.12)',
    borderRadius: 28,
    borderWidth: 1,
    gap: 14,
    margin: 16,
    padding: 16,
    shadowColor: '#2d2416',
    shadowOffset: { width: 0, height: 14 },
    shadowOpacity: 0.16,
    shadowRadius: 28,
  },
  buttonDisabled: {
    opacity: 0.38,
  },
  container: {
    flex: 1,
  },
  dailyCard: {
    backgroundColor: '#fffdf8',
    borderColor: '#e5ddcd',
    borderRadius: 24,
    borderWidth: 1,
    gap: 10,
    padding: 16,
  },
  dailyContainer: {
    backgroundColor: '#f4ead8',
    flex: 1,
  },
  dailyDate: {
    color: '#2d2416',
    fontSize: 22,
    fontWeight: '900',
  },
  dailyEmptyCard: {
    backgroundColor: '#fffdf8',
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
    color: '#2d2416',
    fontWeight: '800',
  },
  dailyStatsRow: {
    flexDirection: 'row',
    gap: 16,
  },
  dailyTime: {
    color: '#675c4d',
    fontWeight: '700',
  },
  dailyTitle: {
    color: '#2d2416',
    flex: 1,
    fontSize: 20,
    fontWeight: '900',
    textAlign: 'center',
  },
  endpointMarker: {
    borderColor: '#fffdf8',
    borderRadius: 999,
    borderWidth: 2,
    paddingHorizontal: 10,
    paddingVertical: 6,
    shadowColor: '#2d2416',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
  },
  endpointMarkerText: {
    color: '#fffdf8',
    fontSize: 12,
    fontWeight: '900',
  },
  emptyCard: {
    alignSelf: 'center',
    backgroundColor: 'rgba(255, 253, 248, 0.92)',
    borderRadius: 24,
    gap: 6,
    marginHorizontal: 24,
    marginTop: 92,
    padding: 18,
  },
  emptyText: {
    color: '#675c4d',
    lineHeight: 20,
  },
  emptyTitle: {
    color: '#2d2416',
    fontSize: 18,
    fontWeight: '800',
  },
  iconButton: {
    backgroundColor: 'rgba(255, 253, 248, 0.92)',
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  iconButtonText: {
    color: '#2d2416',
    fontWeight: '800',
  },
  loadingContainer: {
    alignItems: 'center',
    backgroundColor: '#f4ead8',
    flex: 1,
    justifyContent: 'center',
  },
  loadingText: {
    color: '#2d2416',
    marginTop: 12,
  },
  map: {
    ...StyleSheet.absoluteFillObject,
  },
  menuButton: {
    alignItems: 'center',
    backgroundColor: 'rgba(255, 253, 248, 0.92)',
    borderRadius: 999,
    height: 42,
    justifyContent: 'center',
    width: 42,
  },
  menuButtonText: {
    color: '#2d2416',
    fontSize: 34,
    fontWeight: '900',
    lineHeight: 34,
    transform: [{ translateY: -1 }],
  },
  menuCard: {
    backgroundColor: 'rgba(255, 253, 248, 0.97)',
    borderColor: 'rgba(45, 36, 22, 0.12)',
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
    zIndex: 1,
  },
  menuItem: {
    borderBottomColor: 'rgba(45, 36, 22, 0.1)',
    borderBottomWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  menuItemText: {
    color: '#2d2416',
    fontWeight: '800',
  },
  message: {
    color: '#4f4638',
    lineHeight: 20,
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'space-between',
  },
  primaryButton: {
    alignItems: 'center',
    backgroundColor: '#1f7a5c',
    borderRadius: 999,
    flex: 1,
    paddingHorizontal: 18,
    paddingVertical: 14,
  },
  primaryButtonText: {
    color: '#fffdf8',
    fontWeight: '900',
  },
  secondaryButton: {
    alignItems: 'center',
    backgroundColor: '#fffdf8',
    borderColor: '#1f7a5c',
    borderRadius: 999,
    borderWidth: 1,
    minWidth: 92,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  secondaryButtonText: {
    color: '#1f7a5c',
    fontWeight: '900',
  },
  rightControls: {
    flexDirection: 'row',
    gap: 10,
  },
  settingsAction: {
    backgroundColor: '#f4ead8',
    borderRadius: 18,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  settingsActionText: {
    color: '#1f7a5c',
    fontWeight: '900',
  },
  settingsCard: {
    backgroundColor: '#fffdf8',
    borderColor: '#e5ddcd',
    borderRadius: 24,
    borderWidth: 1,
    gap: 14,
    padding: 16,
  },
  settingsDescription: {
    color: '#675c4d',
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
    color: '#2d2416',
    fontWeight: '900',
  },
  settingsTitle: {
    color: '#2d2416',
    fontSize: 20,
    fontWeight: '900',
  },
  stat: {
    color: '#2d2416',
    fontWeight: '800',
  },
  statsRow: {
    flexDirection: 'row',
    gap: 16,
  },
  statusDot: {
    backgroundColor: '#b8afa1',
    borderRadius: 999,
    height: 9,
    width: 9,
  },
  statusDotActive: {
    backgroundColor: '#1f7a5c',
  },
  statusPill: {
    alignItems: 'center',
    backgroundColor: 'rgba(255, 253, 248, 0.92)',
    borderRadius: 999,
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  statusText: {
    color: '#2d2416',
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
