import { StatusBar } from 'expo-status-bar';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  AppState,
  AppStateStatus,
  Pressable,
  SafeAreaView,
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
import { getAllLocationPoints, getDailyLogs } from '../features/logs/logRepository';
import { createInitialRegion, toRouteCoordinates } from '../features/map/routeMapper';
import { DailyLogSummary, LocationPoint } from '../types/gps';
import { totalDistanceMeters } from '../utils/distance';

export default function App() {
  const mapRef = useRef<MapView | null>(null);
  const [isReady, setIsReady] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [dailyLogs, setDailyLogs] = useState<DailyLogSummary[]>([]);
  const [points, setPoints] = useState<LocationPoint[]>([]);
  const [message, setMessage] = useState('記録を開始すると、バックグラウンドでもGPSログを保存します。');

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
  }, []);

  useEffect(() => {
    initializeDatabase()
      .then(refreshData)
      .catch((error: unknown) => {
        setMessage(error instanceof Error ? error.message : 'DB初期化に失敗しました。');
      })
      .finally(() => setIsReady(true));
  }, [refreshData]);

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
    if (routeCoordinates.length < 2) {
      return;
    }

    mapRef.current?.fitToCoordinates(routeCoordinates, {
      animated: true,
      edgePadding: { bottom: 180, left: 48, right: 48, top: 96 },
    });
  }, [routeCoordinates]);

  async function startRecording(): Promise<void> {
    try {
      await startBackgroundLocationRecording();
      await refreshData();
      setMessage('バックグラウンドGPS記録を開始しました。');
    } catch (error: unknown) {
      setMessage(error instanceof Error ? error.message : 'GPS記録の開始に失敗しました。');
    }
  }

  async function stopRecording(): Promise<void> {
    try {
      await stopBackgroundLocationRecording();
      await refreshData();
      setMessage('GPS記録を停止しました。');
    } catch (error: unknown) {
      setMessage(error instanceof Error ? error.message : 'GPS記録の停止に失敗しました。');
    }
  }

  async function exportAllLogs(): Promise<void> {
    try {
      await shareGpx(points, 'all');
    } catch (error: unknown) {
      Alert.alert('エクスポート失敗', error instanceof Error ? error.message : 'GPX出力に失敗しました。');
    }
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
      <MapView ref={mapRef} style={styles.map} initialRegion={initialRegion} showsUserLocation>
        {routeCoordinates.length > 1 && (
          <Polyline coordinates={routeCoordinates} strokeColor="#1f7a5c" strokeWidth={5} />
        )}
        {points[0] && (
          <Marker
            coordinate={{ latitude: points[0].latitude, longitude: points[0].longitude }}
            title="最初の記録地点"
            description={points[0].recordedAt}
          />
        )}
        {points.length > 1 && (
          <Marker
            coordinate={{
              latitude: points[points.length - 1].latitude,
              longitude: points[points.length - 1].longitude,
            }}
            title="最新の記録地点"
            description={points[points.length - 1].recordedAt}
          />
        )}
      </MapView>

      <SafeAreaView pointerEvents="box-none" style={styles.overlay}>
        <View style={styles.topBar}>
          <View style={styles.statusPill}>
            <View style={[styles.statusDot, isRecording && styles.statusDotActive]} />
            <Text style={styles.statusText}>{isRecording ? '記録中' : '停止中'}</Text>
          </View>
          <Pressable onPress={refreshData} style={styles.iconButton}>
            <Text style={styles.iconButtonText}>更新</Text>
          </Pressable>
        </View>

        {points.length === 0 && (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyTitle}>まだ足あとがありません</Text>
            <Text style={styles.emptyText}>記録開始を押して歩くと、ここに全期間のログが描画されます。</Text>
          </View>
        )}

        <View style={styles.bottomPanel}>
          <Text style={styles.message}>{message}</Text>
          <View style={styles.statsRow}>
            <Text style={styles.stat}>{points.length} pts</Text>
            <Text style={styles.stat}>{(distance / 1000).toFixed(2)} km</Text>
            <Text style={styles.stat}>{dailyLogs.length} days</Text>
          </View>
          <View style={styles.actions}>
            <Pressable
              disabled={isRecording}
              onPress={startRecording}
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
            <Pressable onPress={exportAllLogs} style={styles.secondaryButton}>
              <Text style={styles.secondaryButtonText}>GPX</Text>
            </Pressable>
          </View>
        </View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  actions: {
    flexDirection: 'row',
    gap: 10,
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
    minWidth: 72,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  secondaryButtonText: {
    color: '#1f7a5c',
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
  },
});
