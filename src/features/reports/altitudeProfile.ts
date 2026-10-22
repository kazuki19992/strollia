import type { LocationPoint } from '@/types/gps';

/** 高度差を単色表示へ切り替える上限（メートル）。 */
export const ALTITUDE_PROFILE_FLAT_RANGE_METERS = 10;

/** 高度グラフへ描画する時刻付きの1点。 */
export type AltitudeProfilePoint = {
  timestampMs: number;
  altitudeMeters: number;
};

/** 日別高度グラフの描画とラベルに必要な集約結果。 */
export type AltitudeProfile = {
  segments: AltitudeProfilePoint[][];
  minAltitudeMeters: number;
  maxAltitudeMeters: number;
  startTimestampMs: number;
  middleTimestampMs: number;
  endTimestampMs: number;
  isFlat: boolean;
};

/** 昇順化した数値列の中央値を返す。 */
function median(values: number[]): number {
  const sorted = [...values].sort((left, right) => left - right);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[middle - 1] + sorted[middle]) / 2 : sorted[middle];
}

/** 区間端では取得済みの点だけを使い、連続区間内で5点移動中央値を適用する。 */
function smoothSegment(segment: AltitudeProfilePoint[]): AltitudeProfilePoint[] {
  return segment.map((point, index) => {
    const window = segment.slice(Math.max(0, index - 2), Math.min(segment.length, index + 3));
    return { ...point, altitudeMeters: median(window.map((sample) => sample.altitudeMeters)) };
  });
}

/** 1区間を指定点数へ縮小し、各時刻バケットの山と谷を残す。 */
function downsampleSegment(segment: AltitudeProfilePoint[], limit: number): AltitudeProfilePoint[] {
  if (segment.length <= limit || limit < 3) {
    return limit >= segment.length ? segment : [segment[0], segment.at(-1)!].slice(0, limit);
  }

  const interior = segment.slice(1, -1);
  const bucketCount = Math.floor((limit - 2) / 2);
  const selected = new Set<number>([0, segment.length - 1]);

  for (let bucketIndex = 0; bucketIndex < bucketCount; bucketIndex += 1) {
    const start = Math.floor((bucketIndex * interior.length) / bucketCount);
    const end = Math.max(start + 1, Math.floor(((bucketIndex + 1) * interior.length) / bucketCount));
    const bucket = interior.slice(start, end);
    let minIndex = 0;
    let maxIndex = 0;

    for (let index = 1; index < bucket.length; index += 1) {
      if (bucket[index].altitudeMeters < bucket[minIndex].altitudeMeters) minIndex = index;
      if (bucket[index].altitudeMeters > bucket[maxIndex].altitudeMeters) maxIndex = index;
    }

    selected.add(start + 1 + minIndex);
    selected.add(start + 1 + maxIndex);
  }

  if (selected.size < limit) {
    const middleIndex = Math.floor(segment.length / 2);
    for (let offset = 0; selected.size < limit && offset < segment.length; offset += 1) {
      selected.add(Math.min(segment.length - 1, middleIndex + Math.ceil(offset / 2) * (offset % 2 === 0 ? -1 : 1)));
    }
  }

  return [...selected].sort((left, right) => left - right).map((index) => segment[index]);
}

/** 端の区間を優先しつつ、時刻範囲全体から描画可能な区間を選ぶ。 */
function selectSegmentsWithinBudget(segments: AltitudeProfilePoint[][], budget: number): AltitudeProfilePoint[][] {
  const selectedIndices = new Set<number>();
  let remainingBudget = budget;

  const addSegment = (index: number): boolean => {
    const cost = Math.min(2, segments[index].length);
    if (selectedIndices.has(index) || cost > remainingBudget) return false;
    selectedIndices.add(index);
    remainingBudget -= cost;
    return true;
  };

  addSegment(0);
  addSegment(segments.length - 1);

  while (remainingBudget > 0) {
    let nextIndex = -1;
    let greatestDistance = -1;

    for (let index = 1; index < segments.length - 1; index += 1) {
      const cost = Math.min(2, segments[index].length);
      if (selectedIndices.has(index) || cost > remainingBudget) continue;
      const nearestSelectedDistance = Math.min(...[...selectedIndices].map((selected) => Math.abs(selected - index)));
      if (nearestSelectedDistance > greatestDistance) {
        greatestDistance = nearestSelectedDistance;
        nextIndex = index;
      }
    }

    if (nextIndex < 0) break;
    addSegment(nextIndex);
  }

  return [...selectedIndices]
    .sort((left, right) => left - right)
    .map((index) => downsampleSegment(segments[index], Math.min(2, segments[index].length)));
}

/** 全区間へ点数上限を按分して描画点数を抑える。 */
function downsampleSegments(segments: AltitudeProfilePoint[][], maxRenderedPoints: number): AltitudeProfilePoint[][] {
  const totalPointCount = segments.reduce((sum, segment) => sum + segment.length, 0);
  const requestedLimit = Math.max(0, Math.floor(maxRenderedPoints));
  if (totalPointCount <= requestedLimit) {
    return segments;
  }

  const minimumBudget = segments.reduce((sum, segment) => sum + Math.min(2, segment.length), 0);
  if (minimumBudget > requestedLimit) {
    return selectSegmentsWithinBudget(segments, requestedLimit);
  }

  let remainingBudget = requestedLimit;
  let remainingPoints = totalPointCount;

  return segments.map((segment, index) => {
    const remainingMinimum = segments.slice(index + 1).reduce((sum, nextSegment) => sum + Math.min(2, nextSegment.length), 0);
    const proportionalBudget = Math.round((remainingBudget * segment.length) / remainingPoints);
    const budget = Math.min(
      segment.length,
      Math.max(Math.min(2, segment.length), Math.min(proportionalBudget, remainingBudget - remainingMinimum)),
    );
    remainingBudget -= budget;
    remainingPoints -= segment.length;
    return downsampleSegment(segment, budget);
  });
}

/** Unix時刻を端末ローカル時刻の短いラベルへ変換する。 */
export function formatAltitudeProfileTime(timestampMs: number): string {
  const date = new Date(timestampMs);
  return `${date.getHours()}:${String(date.getMinutes()).padStart(2, '0')}`;
}

/** 保存済みGPS点から日別高度グラフ用のデータを作る。 */
export function createAltitudeProfile(points: readonly LocationPoint[], maxRenderedPoints: number): AltitudeProfile | null {
  const segments: AltitudeProfilePoint[][] = [];
  let currentSegment: AltitudeProfilePoint[] = [];

  for (const point of points) {
    const timestampMs = Date.parse(point.recordedAt);
    if (typeof point.altitude !== 'number' || !Number.isFinite(point.altitude) || !Number.isFinite(timestampMs)) {
      if (currentSegment.length > 0) {
        segments.push(currentSegment);
        currentSegment = [];
      }
      continue;
    }

    currentSegment.push({ timestampMs, altitudeMeters: point.altitude });
  }

  if (currentSegment.length > 0) {
    segments.push(currentSegment);
  }

  const smoothedSegments = segments.map(smoothSegment);
  const validPoints = smoothedSegments.flat();
  if (validPoints.length < 2) {
    return null;
  }

  const altitudes = validPoints.map((point) => point.altitudeMeters);
  const minAltitudeMeters = Math.min(...altitudes);
  const maxAltitudeMeters = Math.max(...altitudes);
  const startTimestampMs = validPoints[0].timestampMs;
  const endTimestampMs = validPoints.at(-1)!.timestampMs;

  return {
    segments: downsampleSegments(smoothedSegments, maxRenderedPoints),
    minAltitudeMeters,
    maxAltitudeMeters,
    startTimestampMs,
    middleTimestampMs: startTimestampMs + (endTimestampMs - startTimestampMs) / 2,
    endTimestampMs,
    isFlat: maxAltitudeMeters - minAltitudeMeters < ALTITUDE_PROFILE_FLAT_RANGE_METERS,
  };
}
