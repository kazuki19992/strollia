import { XMLParser } from 'fast-xml-parser';

import { NewLocationPoint } from '../../types/gps';
import { toLocalDate } from '../../utils/date';

type XmlNode = Record<string, unknown>;

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '@_',
  removeNSPrefix: true,
});

/** GPX文字列からStrolliaへ取り込めるGPSポイントを抽出する。 */
export function parseGpxToLocationPoints(gpx: string): NewLocationPoint[] {
  const parsed = parser.parse(gpx) as XmlNode;
  const trkpts = findNodesByName(parsed, 'trkpt');

  return trkpts.flatMap((trkpt) => toLocationPoint(trkpt));
}

/** GPXのtrkptを保存用GPS点へ変換し、時刻や座標が壊れた点は取り込まない。 */
function toLocationPoint(trkpt: XmlNode): NewLocationPoint[] {
  const latitude = toFiniteNumber(trkpt['@_lat']);
  const longitude = toFiniteNumber(trkpt['@_lon']);
  const time = getTextValue(trkpt.time);

  if (!isValidLatitude(latitude) || !isValidLongitude(longitude) || !time) {
    return [];
  }

  const recordedAtDate = new Date(time);

  if (Number.isNaN(recordedAtDate.getTime())) {
    return [];
  }

  const recordedAt = recordedAtDate.toISOString();

  return [{
    recordedAt,
    localDate: toLocalDate(recordedAtDate),
    latitude,
    longitude,
    altitude: toFiniteNumber(getTextValue(trkpt.ele)),
    speed: null,
    heading: null,
    accuracy: null,
    altitudeAccuracy: null,
  }];
}

/** 緯度は世界測地系の範囲に収まる数値だけを許可する。 */
function isValidLatitude(value: number | null): value is number {
  return value != null && value >= -90 && value <= 90;
}

/** 経度は世界測地系の範囲に収まる数値だけを許可する。 */
function isValidLongitude(value: number | null): value is number {
  return value != null && value >= -180 && value <= 180;
}

/** GPXの名前空間有無に依存せず、XMLツリーから指定タグを再帰的に集める。 */
function findNodesByName(value: unknown, name: string): XmlNode[] {
  if (Array.isArray(value)) {
    return value.flatMap((item) => findNodesByName(item, name));
  }

  if (!isXmlNode(value)) {
    return [];
  }

  return Object.entries(value).flatMap(([key, child]) => {
    const current = key === name ? toArray(child).filter(isXmlNode) : [];
    return [...current, ...findNodesByName(child, name)];
  });
}

/** fast-xml-parserの値から、属性や子要素を持つXMLノードだけを判定する。 */
function isXmlNode(value: unknown): value is XmlNode {
  return typeof value === 'object' && value !== null;
}

/** 単一ノードと複数ノードを同じ走査処理で扱うため配列へ正規化する。 */
function toArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [value];
}

/** XMLテキストとして扱えるプリミティブ値だけを文字列へ変換する。 */
function getTextValue(value: unknown): string | null {
  if (typeof value === 'string' || typeof value === 'number') {
    return String(value);
  }

  return null;
}

/** GPX属性やeleの値を有限数値へ変換し、空文字やNaNは無効値として扱う。 */
function toFiniteNumber(value: unknown): number | null {
  const numberValue = typeof value === 'number' ? value : typeof value === 'string' ? Number(value) : null;
  return numberValue != null && Number.isFinite(numberValue) ? numberValue : null;
}
