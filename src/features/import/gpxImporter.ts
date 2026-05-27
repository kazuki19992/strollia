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

function toLocationPoint(trkpt: XmlNode): NewLocationPoint[] {
  const latitude = toFiniteNumber(trkpt['@_lat']);
  const longitude = toFiniteNumber(trkpt['@_lon']);
  const time = getTextValue(trkpt.time);

  if (latitude == null || longitude == null || !time) {
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

function isXmlNode(value: unknown): value is XmlNode {
  return typeof value === 'object' && value !== null;
}

function toArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [value];
}

function getTextValue(value: unknown): string | null {
  if (typeof value === 'string' || typeof value === 'number') {
    return String(value);
  }

  return null;
}

function toFiniteNumber(value: unknown): number | null {
  const numberValue = typeof value === 'number' ? value : typeof value === 'string' ? Number(value) : null;
  return numberValue != null && Number.isFinite(numberValue) ? numberValue : null;
}
