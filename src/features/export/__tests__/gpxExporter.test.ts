import { LocationPoint, DailyLogSummary } from '@/types/gps';
import { parseGpxToLocationPoints } from '@/features/import/gpxImporter';

jest.mock('expo-file-system/legacy', () => ({
  cacheDirectory: 'file:///cache/',
  writeAsStringAsync: jest.fn().mockResolvedValue(undefined),
  EncodingType: { UTF8: 'utf8' },
}));

jest.mock('expo-sharing', () => ({
  isAvailableAsync: jest.fn().mockResolvedValue(true),
  shareAsync: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('@/features/logs/logRepository', () => ({
  getDailyLogs: jest.fn(),
  getLocationPointsByDate: jest.fn(),
}));

import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { getDailyLogs, getLocationPointsByDate } from '@/features/logs/logRepository';
import { buildGpxDayTrack, buildGpxFooter, buildGpxHeader, shareAllLogsAsGpx } from '@/features/export/gpxExporter';

const day1Points: LocationPoint[] = [
  {
    id: 1,
    recordedAt: '2026-05-04T00:00:00.000Z',
    localDate: '2026-05-04',
    latitude: 35.681236,
    longitude: 139.767125,
    altitude: 12.5,
    speed: null,
    heading: null,
    accuracy: 8,
    altitudeAccuracy: null,
  },
  {
    id: 2,
    recordedAt: '2026-05-04T00:01:00.000Z',
    localDate: '2026-05-04',
    latitude: 35.682,
    longitude: 139.768,
    altitude: null,
    speed: null,
    heading: null,
    accuracy: null,
    altitudeAccuracy: null,
  },
];

const day2Points: LocationPoint[] = [
  {
    id: 3,
    recordedAt: '2026-05-05T00:00:00.000Z',
    localDate: '2026-05-05',
    latitude: 35.7,
    longitude: 139.8,
    altitude: null,
    speed: null,
    heading: null,
    accuracy: null,
    altitudeAccuracy: null,
  },
];

describe('GPX生成', () => {
  it('ヘッダーにXML宣言とメタデータ名を含める', () => {
    const header = buildGpxHeader('Strollia all');

    expect(header).toContain('<?xml version="1.0" encoding="UTF-8"?>');
    expect(header).toContain('<gpx version="1.1" creator="Strollia"');
    expect(header).toContain('<name>Strollia all</name>');
  });

  it('XMLで特別扱いされる文字をヘッダー名内でエスケープする', () => {
    const header = buildGpxHeader('A&B <walk>');

    expect(header).toContain('A&amp;B &lt;walk&gt;');
  });

  it('日別トラックポイントをtrk要素として出力する', () => {
    const track = buildGpxDayTrack('2026-05-04', day1Points);

    expect(track).toContain('<trk>');
    expect(track).toContain('<name>2026-05-04</name>');
    expect(track).toContain('<trkpt lat="35.681236" lon="139.767125">');
    expect(track).toContain('<ele>12.5</ele>');
    expect(track).toContain('<time>2026-05-04T00:01:00.000Z</time>');
  });

  it('有効座標が保存されていてもGPXには生座標を出力する', () => {
    const snappedPoint = {
      ...day1Points[0],
      latitude: 35,
      longitude: 139,
      effectiveLatitude: 35.5,
      effectiveLongitude: 139.5,
      snappedStayPlaceId: 1,
    } as LocationPoint;

    const track = buildGpxDayTrack('2026-05-04', [snappedPoint]);

    expect(track).toContain('lat="35" lon="139"');
    expect(track).not.toContain('lat="35.5" lon="139.5"');
  });

  it('フッターでgpx要素を閉じる', () => {
    expect(buildGpxFooter()).toBe('</gpx>\n');
  });

  it('複数日のtrkを連結したGPXを再インポートすると全ポイントが復元される(往復互換)', () => {
    const gpx =
      buildGpxHeader('Strollia all') +
      buildGpxDayTrack('2026-05-04', day1Points) +
      buildGpxDayTrack('2026-05-05', day2Points) +
      buildGpxFooter();

    const imported = parseGpxToLocationPoints(gpx);

    expect(imported).toHaveLength(3);
    expect(imported.map((p) => `${p.latitude},${p.longitude}`)).toEqual(
      [...day1Points, ...day2Points].map((p) => `${p.latitude},${p.longitude}`),
    );
  });
});

function dailyLog(localDate: string, pointCount: number): DailyLogSummary {
  return {
    localDate,
    pointCount,
    startedAt: null,
    endedAt: null,
    distanceMeters: null,
    startLocationPointId: null,
    endLocationPointId: null,
  };
}

describe('全期間GPXエクスポート shareAllLogsAsGpx', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('記録がない場合はエラーを投げる', async () => {
    (getDailyLogs as jest.Mock).mockResolvedValue([]);

    await expect(shareAllLogsAsGpx()).rejects.toThrow('GPXとして出力できるGPSポイントがありません。');
  });

  it('日付順にヘッダー・日別チャンク・フッターを追記してから共有する', async () => {
    (getDailyLogs as jest.Mock).mockResolvedValue([dailyLog('2026-05-05', 1), dailyLog('2026-05-04', 2)]);
    (getLocationPointsByDate as jest.Mock).mockImplementation((localDate: string) =>
      Promise.resolve(localDate === '2026-05-04' ? day1Points : day2Points),
    );

    await shareAllLogsAsGpx();

    const writeCalls = (FileSystem.writeAsStringAsync as jest.Mock).mock.calls;
    expect(writeCalls).toHaveLength(4);
    expect(writeCalls[0][1]).toContain('<gpx version="1.1"');
    expect(writeCalls[0][2]).toEqual(expect.objectContaining({ encoding: 'utf8' }));
    expect(writeCalls[0][2].append).not.toBe(true);
    expect(writeCalls[1][1]).toContain('<name>2026-05-04</name>');
    expect(writeCalls[1][2]).toEqual(expect.objectContaining({ append: true }));
    expect(writeCalls[2][1]).toContain('<name>2026-05-05</name>');
    expect(writeCalls[2][2]).toEqual(expect.objectContaining({ append: true }));
    expect(writeCalls[3][1]).toBe('</gpx>\n');
    expect(Sharing.shareAsync).toHaveBeenCalledWith(
      'file:///cache/strollia-all.gpx',
      expect.objectContaining({ mimeType: 'application/gpx+xml' }),
    );
  });

  it('共有機能が使えない場合はエラーを投げる', async () => {
    (getDailyLogs as jest.Mock).mockResolvedValue([dailyLog('2026-05-04', 1)]);
    (getLocationPointsByDate as jest.Mock).mockResolvedValue(day1Points);
    (Sharing.isAvailableAsync as jest.Mock).mockResolvedValueOnce(false);

    await expect(shareAllLogsAsGpx()).rejects.toThrow('この端末では共有機能を利用できません。');
  });
});
