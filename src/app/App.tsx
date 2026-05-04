import { StatusBar } from 'expo-status-bar';
import * as Location from 'expo-location';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
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
import { ensureForegroundLocationPermission, toLocationPoint } from '../features/location/locationService';
import { getDailyLogs, getLocationPointsByDate, insertLocationPoint } from '../features/logs/logRepository';
import { DailyLogSummary, LocationPoint } from '../types/gps';
import { formatTime } from '../utils/date';
import { totalDistanceMeters } from '../utils/distance';

export default function App() {
  const subscriptionRef = useRef<Location.LocationSubscription | null>(null);
  const [isReady, setIsReady] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [dailyLogs, setDailyLogs] = useState<DailyLogSummary[]>([]);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [points, setPoints] = useState<LocationPoint[]>([]);
  const [message, setMessage] = useState('Strolliaへようこそ。まずは記録を開始してみましょう。');

  const routeCoordinates = useMemo(
    () => points.map((point) => ({ latitude: point.latitude, longitude: point.longitude })),
    [points],
  );

  const mapRegion = useMemo(() => {
    const first = points[0];

    if (!first) {
      return {
        latitude: 35.681236,
        longitude: 139.767125,
        latitudeDelta: 0.08,
        longitudeDelta: 0.08,
      };
    }

    return {
      latitude: first.latitude,
      longitude: first.longitude,
      latitudeDelta: 0.02,
      longitudeDelta: 0.02,
    };
  }, [points]);

  const distance = useMemo(() => totalDistanceMeters(points), [points]);

  useEffect(() => {
    let mounted = true;

    initializeDatabase()
      .then(async () => {
        const logs = await getDailyLogs();
        if (!mounted) {
          return;
        }

        setDailyLogs(logs);
        if (logs[0]) {
          setSelectedDate(logs[0].localDate);
        }
        setIsReady(true);
      })
      .catch((error: unknown) => {
        setMessage(error instanceof Error ? error.message : 'DB初期化に失敗しました。');
        setIsReady(true);
      });

    return () => {
      mounted = false;
      subscriptionRef.current?.remove();
    };
  }, []);

  useEffect(() => {
    if (!selectedDate) {
      setPoints([]);
      return;
    }

    getLocationPointsByDate(selectedDate)
      .then(setPoints)
      .catch((error: unknown) => {
        setMessage(error instanceof Error ? error.message : 'GPSログの読み込みに失敗しました。');
      });
  }, [selectedDate]);

  async function refreshLogs(nextSelectedDate?: string): Promise<void> {
    const logs = await getDailyLogs();
    setDailyLogs(logs);

    const date = nextSelectedDate ?? selectedDate ?? logs[0]?.localDate ?? null;
    setSelectedDate(date);

    if (date) {
      setPoints(await getLocationPointsByDate(date));
    }
  }

  async function startRecording(): Promise<void> {
    try {
      const granted = await ensureForegroundLocationPermission();

      if (!granted) {
        setMessage('位置情報の権限がないため、記録を開始できません。');
        return;
      }

      const subscription = await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.Balanced,
          timeInterval: 10000,
          distanceInterval: 10,
        },
        async (location) => {
          const point = toLocationPoint(location);
          await insertLocationPoint(point);
          await refreshLogs(point.localDate);
          setMessage(`記録しました: ${formatTime(point.recordedAt)}`);
        },
      );

      subscriptionRef.current = subscription;
      setIsRecording(true);
      setMessage('GPS記録を開始しました。');
    } catch (error: unknown) {
      setMessage(error instanceof Error ? error.message : 'GPS記録の開始に失敗しました。');
    }
  }

  function stopRecording(): void {
    subscriptionRef.current?.remove();
    subscriptionRef.current = null;
    setIsRecording(false);
    setMessage('GPS記録を停止しました。');
  }

  async function exportSelectedDate(): Promise<void> {
    if (!selectedDate) {
      Alert.alert('エクスポート不可', 'エクスポートする日付がありません。');
      return;
    }

    try {
      await shareGpx(points, selectedDate);
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
    <SafeAreaView style={styles.container}>
      <StatusBar style="dark" />
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.hero}>
          <Text style={styles.eyebrow}>すとろりあ / Strollia</Text>
          <Text style={styles.title}>今日の足あとを、静かに残す。</Text>
          <Text style={styles.message}>{message}</Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>記録</Text>
          <View style={styles.actions}>
            <Pressable
              disabled={isRecording}
              onPress={startRecording}
              style={[styles.button, isRecording && styles.buttonDisabled]}
            >
              <Text style={styles.buttonText}>記録開始</Text>
            </Pressable>
            <Pressable
              disabled={!isRecording}
              onPress={stopRecording}
              style={[styles.button, styles.secondaryButton, !isRecording && styles.buttonDisabled]}
            >
              <Text style={styles.secondaryButtonText}>停止</Text>
            </Pressable>
          </View>
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>日別ログ</Text>
          {dailyLogs.length === 0 ? (
            <Text style={styles.empty}>まだGPSログがありません。</Text>
          ) : (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.dateList}>
              {dailyLogs.map((log) => {
                const active = log.localDate === selectedDate;
                return (
                  <Pressable
                    key={log.localDate}
                    onPress={() => setSelectedDate(log.localDate)}
                    style={[styles.dateChip, active && styles.dateChipActive]}
                  >
                    <Text style={[styles.dateChipText, active && styles.dateChipTextActive]}>{log.localDate}</Text>
                    <Text style={[styles.dateChipSubText, active && styles.dateChipTextActive]}>{log.pointCount} pts</Text>
                  </Pressable>
                );
              })}
            </ScrollView>
          )}
        </View>

        <View style={styles.card}>
          <View style={styles.mapHeader}>
            <View>
              <Text style={styles.sectionTitle}>マップ</Text>
              <Text style={styles.statText}>
                {points.length} points / {(distance / 1000).toFixed(2)} km
              </Text>
            </View>
            <Pressable onPress={exportSelectedDate} style={[styles.button, styles.exportButton]}>
              <Text style={styles.buttonText}>GPX共有</Text>
            </Pressable>
          </View>

          <MapView style={styles.map} initialRegion={mapRegion} region={mapRegion}>
            {routeCoordinates.length > 1 && (
              <Polyline coordinates={routeCoordinates} strokeColor="#1f7a5c" strokeWidth={5} />
            )}
            {points[0] && (
              <Marker
                coordinate={{ latitude: points[0].latitude, longitude: points[0].longitude }}
                title="開始地点"
                description={formatTime(points[0].recordedAt)}
              />
            )}
            {points.length > 1 && (
              <Marker
                coordinate={{
                  latitude: points[points.length - 1].latitude,
                  longitude: points[points.length - 1].longitude,
                }}
                title="終了地点"
                description={formatTime(points[points.length - 1].recordedAt)}
              />
            )}
          </MapView>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  actions: {
    flexDirection: 'row',
    gap: 12,
  },
  button: {
    alignItems: 'center',
    backgroundColor: '#1f7a5c',
    borderRadius: 999,
    paddingHorizontal: 18,
    paddingVertical: 12,
  },
  buttonDisabled: {
    opacity: 0.4,
  },
  buttonText: {
    color: '#fffdf8',
    fontWeight: '700',
  },
  card: {
    backgroundColor: '#fffdf8',
    borderColor: '#e5ddcd',
    borderRadius: 24,
    borderWidth: 1,
    gap: 14,
    padding: 16,
    shadowColor: '#2d2416',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.08,
    shadowRadius: 24,
  },
  container: {
    backgroundColor: '#f4ead8',
    flex: 1,
  },
  content: {
    gap: 16,
    padding: 16,
    paddingBottom: 32,
  },
  dateChip: {
    backgroundColor: '#f4ead8',
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  dateChipActive: {
    backgroundColor: '#1f7a5c',
  },
  dateChipSubText: {
    color: '#796f60',
    fontSize: 12,
    marginTop: 2,
  },
  dateChipText: {
    color: '#2d2416',
    fontWeight: '700',
  },
  dateChipTextActive: {
    color: '#fffdf8',
  },
  dateList: {
    gap: 10,
  },
  empty: {
    color: '#796f60',
  },
  exportButton: {
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  eyebrow: {
    color: '#1f7a5c',
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 1.2,
  },
  hero: {
    backgroundColor: '#e7d3ad',
    borderRadius: 28,
    gap: 10,
    overflow: 'hidden',
    padding: 20,
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
    borderRadius: 18,
    height: 360,
    overflow: 'hidden',
    width: '100%',
  },
  mapHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  message: {
    color: '#4f4638',
    lineHeight: 21,
  },
  secondaryButton: {
    backgroundColor: '#fffdf8',
    borderColor: '#1f7a5c',
    borderWidth: 1,
  },
  secondaryButtonText: {
    color: '#1f7a5c',
    fontWeight: '700',
  },
  sectionTitle: {
    color: '#2d2416',
    fontSize: 18,
    fontWeight: '800',
  },
  statText: {
    color: '#796f60',
    marginTop: 4,
  },
  title: {
    color: '#2d2416',
    fontSize: 30,
    fontWeight: '900',
    lineHeight: 36,
  },
});
