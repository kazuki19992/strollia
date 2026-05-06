import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';

import { LocationPoint } from '../../types/gps';

/** GPX内のテキスト要素でXML構文を壊す文字をエスケープする。 */
function escapeXml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;');
}

/** GPSポイント列をGPX 1.1形式の文字列へ変換する。 */
export function buildGpx(points: LocationPoint[], name: string): string {
  const trackPoints = points
    .map((point) => {
      const elevation = point.altitude == null ? '' : `\n        <ele>${point.altitude}</ele>`;
      return `      <trkpt lat="${point.latitude}" lon="${point.longitude}">${elevation}\n        <time>${point.recordedAt}</time>\n      </trkpt>`;
    })
    .join('\n');

  return `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="Strollia" xmlns="http://www.topografix.com/GPX/1/1">
  <metadata>
    <name>${escapeXml(name)}</name>
  </metadata>
  <trk>
    <name>${escapeXml(name)}</name>
    <trkseg>
${trackPoints}
    </trkseg>
  </trk>
</gpx>
`;
}

/** GPXファイルを一時領域へ書き出し、OS標準共有UIを開く。 */
export async function shareGpx(points: LocationPoint[], localDate: string): Promise<void> {
  if (points.length === 0) {
    throw new Error('GPXとして出力できるGPSポイントがありません。');
  }

  const fileName = `strollia-${localDate}.gpx`;
  const fileUri = `${FileSystem.cacheDirectory}${fileName}`;
  const gpx = buildGpx(points, `Strollia ${localDate}`);

  await FileSystem.writeAsStringAsync(fileUri, gpx, {
    encoding: FileSystem.EncodingType.UTF8,
  });

  if (!(await Sharing.isAvailableAsync())) {
    throw new Error('この端末では共有機能を利用できません。');
  }

  await Sharing.shareAsync(fileUri, {
    mimeType: 'application/gpx+xml',
    dialogTitle: fileName,
    UTI: 'com.topografix.gpx',
  });
}
