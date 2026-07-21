import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';

import { getDailyLogs, getLocationPointsByDate } from '@/features/logs/logRepository';
import { LocationPoint } from '@/types/gps';

/** 全期間エクスポートのファイル名。 */
const ALL_LOGS_GPX_FILE_NAME = 'strollia-all.gpx';

/** GPX内のテキスト要素でXML構文を壊す文字をエスケープする。 */
function escapeXml(value: string): string {
  return value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&apos;');
}

/** GPX 1.1のXML宣言・メタデータ部分を作る。ファイルの先頭に1回だけ書き込む。 */
export function buildGpxHeader(name: string): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="Strollia" xmlns="http://www.topografix.com/GPX/1/1">
  <metadata>
    <name>${escapeXml(name)}</name>
  </metadata>
`;
}

/** 1日分のGPSポイントを1つの`<trk>`要素へ変換する。日別チャンクとしてファイルへ追記する。 */
export function buildGpxDayTrack(localDate: string, points: LocationPoint[]): string {
  const trackPoints = points
    .map((point) => {
      const elevation = point.altitude == null ? '' : `\n        <ele>${point.altitude}</ele>`;
      return `      <trkpt lat="${point.latitude}" lon="${point.longitude}">${elevation}\n        <time>${point.recordedAt}</time>\n      </trkpt>`;
    })
    .join('\n');

  return `  <trk>
    <name>${escapeXml(localDate)}</name>
    <trkseg>
${trackPoints}
    </trkseg>
  </trk>
`;
}

/** GPXのルート要素を閉じる。ファイルの末尾に1回だけ書き込む。 */
export function buildGpxFooter(): string {
  return `</gpx>\n`;
}

/**
 * 全期間のGPSログを日別チャンクで逐次追記しながらGPXへ書き出し、OS標準共有UIを開く。
 *
 * 全ポイントを一度にメモリへ載せると数十万件規模で数百MBのメモリを消費するため、
 * 1日分ずつ取得してファイルへ追記することでメモリ使用を有界化する
 * (2026-07-14のメモリ超過クラッシュ対策の一部)。出力は日別`<trk>`を複数持つ
 * 単一のGPX 1.1ファイルで、既存のGPXインポータは構造非依存で`<trkpt>`を
 * 全て収集するため往復互換は維持される。
 */
export async function shareAllLogsAsGpx(): Promise<void> {
  const dailyLogs = await getDailyLogs();
  const activeDates = dailyLogs
    .filter((log) => log.pointCount > 0)
    .map((log) => log.localDate)
    .sort();

  if (activeDates.length === 0) {
    throw new Error('GPXとして出力できるGPSポイントがありません。');
  }

  const fileUri = `${FileSystem.cacheDirectory}${ALL_LOGS_GPX_FILE_NAME}`;

  await FileSystem.writeAsStringAsync(fileUri, buildGpxHeader('Strollia all'), {
    encoding: FileSystem.EncodingType.UTF8,
  });

  for (const localDate of activeDates) {
    const points = await getLocationPointsByDate(localDate);

    if (points.length === 0) {
      continue;
    }

    await FileSystem.writeAsStringAsync(fileUri, buildGpxDayTrack(localDate, points), {
      encoding: FileSystem.EncodingType.UTF8,
      append: true,
    });
  }

  await FileSystem.writeAsStringAsync(fileUri, buildGpxFooter(), {
    encoding: FileSystem.EncodingType.UTF8,
    append: true,
  });

  if (!(await Sharing.isAvailableAsync())) {
    throw new Error('この端末では共有機能を利用できません。');
  }

  await Sharing.shareAsync(fileUri, {
    mimeType: 'application/gpx+xml',
    dialogTitle: ALL_LOGS_GPX_FILE_NAME,
    UTI: 'com.topografix.gpx',
  });
}
