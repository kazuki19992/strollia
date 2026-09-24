import { INITIAL_LANDMARK_ARRIVAL_STATE, resolveLandmarkArrival } from '@/features/landmarks/landmarkArrivalResolver';
import type { LandmarkSpot } from '@/features/landmarks/landmarkCatalog';

/** テスト用の華厳の滝。半径200m・滞在180秒。 */
const kegon: LandmarkSpot = {
  id: 'spot-kegon',
  name: '華厳の滝',
  prefecture: 'TOCHIGI',
  latitude: 36.737917,
  longitude: 139.501972,
  radiusMeters: 200,
  dwellSeconds: 180,
  packs: [{ packId: 'pack-falls', order: 1 }],
};

/** 華厳の滝から約1.5km離れたテスト用スポット。 */
const nearby: LandmarkSpot = {
  ...kegon,
  id: 'spot-nearby',
  name: '近くの別スポット',
  latitude: 36.751,
  longitude: 139.501972,
};

/** 中心からちょうど指定メートル北へずらした座標を作る。緯度1度は約111,320m。 */
function northOf(spot: LandmarkSpot, meters: number): { latitude: number; longitude: number } {
  return { latitude: spot.latitude + meters / 111_320, longitude: spot.longitude };
}

/** 観測を組み立てる。 */
function observationAt(coordinate: { latitude: number; longitude: number }, recordedAt: string) {
  return { ...coordinate, recordedAt };
}

describe('スポット到達判定 resolveLandmarkArrival', () => {
  const spots = [kegon];
  const noVisits = new Set<string>();

  it('半径内に入った最初の観測では到達せず、入場時刻を記録する', () => {
    const result = resolveLandmarkArrival({
      state: INITIAL_LANDMARK_ARRIVAL_STATE,
      observation: observationAt(northOf(kegon, 50), '2026-04-12T02:00:00.000Z'),
      spots,
      visitedSpotIds: noVisits,
    });

    expect(result.arrivedSpotId).toBeNull();
    expect(result.state.candidateSpotId).toBe('spot-kegon');
    expect(result.state.candidateEnteredAt).toBe('2026-04-12T02:00:00.000Z');
  });

  it('滞在時間に達した観測で到達が確定する', () => {
    const entered = resolveLandmarkArrival({
      state: INITIAL_LANDMARK_ARRIVAL_STATE,
      observation: observationAt(northOf(kegon, 50), '2026-04-12T02:00:00.000Z'),
      spots,
      visitedSpotIds: noVisits,
    });

    const result = resolveLandmarkArrival({
      state: entered.state,
      observation: observationAt(northOf(kegon, 60), '2026-04-12T02:03:00.000Z'),
      spots,
      visitedSpotIds: noVisits,
    });

    expect(result.arrivedSpotId).toBe('spot-kegon');
    expect(result.state).toEqual(INITIAL_LANDMARK_ARRIVAL_STATE);
  });

  it('滞在時間に1秒足りない観測では到達しない', () => {
    const entered = resolveLandmarkArrival({
      state: INITIAL_LANDMARK_ARRIVAL_STATE,
      observation: observationAt(northOf(kegon, 50), '2026-04-12T02:00:00.000Z'),
      spots,
      visitedSpotIds: noVisits,
    });

    const result = resolveLandmarkArrival({
      state: entered.state,
      observation: observationAt(northOf(kegon, 50), '2026-04-12T02:02:59.000Z'),
      spots,
      visitedSpotIds: noVisits,
    });

    expect(result.arrivedSpotId).toBeNull();
  });

  it('観測が疎でも、入場から滞在時間が経っていれば到達する', () => {
    const entered = resolveLandmarkArrival({
      state: INITIAL_LANDMARK_ARRIVAL_STATE,
      observation: observationAt(northOf(kegon, 180), '2026-04-12T02:00:00.000Z'),
      spots,
      visitedSpotIds: noVisits,
    });

    // 途中の観測が1件も無いまま10分後の観測が届くケース(トンネル通過など)
    const result = resolveLandmarkArrival({
      state: entered.state,
      observation: observationAt(northOf(kegon, 20), '2026-04-12T02:10:00.000Z'),
      spots,
      visitedSpotIds: noVisits,
    });

    expect(result.arrivedSpotId).toBe('spot-kegon');
  });

  it('半径の境界ちょうどは範囲内として扱う', () => {
    const result = resolveLandmarkArrival({
      state: INITIAL_LANDMARK_ARRIVAL_STATE,
      observation: observationAt(northOf(kegon, 200), '2026-04-12T02:00:00.000Z'),
      spots,
      visitedSpotIds: noVisits,
    });

    expect(result.state.candidateSpotId).toBe('spot-kegon');
  });

  it('半径外に1点だけ外れても滞在時間はリセットしない', () => {
    const entered = resolveLandmarkArrival({
      state: INITIAL_LANDMARK_ARRIVAL_STATE,
      observation: observationAt(northOf(kegon, 50), '2026-04-12T02:00:00.000Z'),
      spots,
      visitedSpotIds: noVisits,
    });

    const outlier = resolveLandmarkArrival({
      state: entered.state,
      observation: observationAt(northOf(kegon, 400), '2026-04-12T02:01:00.000Z'),
      spots,
      visitedSpotIds: noVisits,
    });

    expect(outlier.state.candidateSpotId).toBe('spot-kegon');
    expect(outlier.state.candidateEnteredAt).toBe('2026-04-12T02:00:00.000Z');
    expect(outlier.state.outsideCount).toBe(1);

    const result = resolveLandmarkArrival({
      state: outlier.state,
      observation: observationAt(northOf(kegon, 50), '2026-04-12T02:03:00.000Z'),
      spots,
      visitedSpotIds: noVisits,
    });

    expect(result.arrivedSpotId).toBe('spot-kegon');
  });

  it('半径外が2点連続すると状態をリセットする', () => {
    const entered = resolveLandmarkArrival({
      state: INITIAL_LANDMARK_ARRIVAL_STATE,
      observation: observationAt(northOf(kegon, 50), '2026-04-12T02:00:00.000Z'),
      spots,
      visitedSpotIds: noVisits,
    });

    const first = resolveLandmarkArrival({
      state: entered.state,
      observation: observationAt(northOf(kegon, 400), '2026-04-12T02:01:00.000Z'),
      spots,
      visitedSpotIds: noVisits,
    });

    const second = resolveLandmarkArrival({
      state: first.state,
      observation: observationAt(northOf(kegon, 500), '2026-04-12T02:02:00.000Z'),
      spots,
      visitedSpotIds: noVisits,
    });

    expect(second.state).toEqual(INITIAL_LANDMARK_ARRIVAL_STATE);
  });

  it('別のスポットへ移ると入場時刻を取り直す', () => {
    const entered = resolveLandmarkArrival({
      state: INITIAL_LANDMARK_ARRIVAL_STATE,
      observation: observationAt(northOf(kegon, 50), '2026-04-12T02:00:00.000Z'),
      spots: [kegon, nearby],
      visitedSpotIds: noVisits,
    });

    const result = resolveLandmarkArrival({
      state: entered.state,
      observation: observationAt(northOf(nearby, 50), '2026-04-12T02:05:00.000Z'),
      spots: [kegon, nearby],
      visitedSpotIds: noVisits,
    });

    expect(result.arrivedSpotId).toBeNull();
    expect(result.state.candidateSpotId).toBe('spot-nearby');
    expect(result.state.candidateEnteredAt).toBe('2026-04-12T02:05:00.000Z');
  });

  it('到達済みスポットは候補にしない', () => {
    const result = resolveLandmarkArrival({
      state: INITIAL_LANDMARK_ARRIVAL_STATE,
      observation: observationAt(northOf(kegon, 50), '2026-04-12T02:00:00.000Z'),
      spots,
      visitedSpotIds: new Set(['spot-kegon']),
    });

    expect(result.state).toEqual(INITIAL_LANDMARK_ARRIVAL_STATE);
    expect(result.arrivedSpotId).toBeNull();
  });

  it('滞在時間0のスポットは半径内の最初の観測で到達する', () => {
    const instant: LandmarkSpot = { ...kegon, id: 'spot-instant', dwellSeconds: 0 };

    const result = resolveLandmarkArrival({
      state: INITIAL_LANDMARK_ARRIVAL_STATE,
      observation: observationAt(northOf(instant, 50), '2026-04-12T02:00:00.000Z'),
      spots: [instant],
      visitedSpotIds: noVisits,
    });

    expect(result.arrivedSpotId).toBe('spot-instant');
  });

  it('不正な座標の観測では状態を進めない', () => {
    const result = resolveLandmarkArrival({
      state: INITIAL_LANDMARK_ARRIVAL_STATE,
      observation: { latitude: Number.NaN, longitude: 139.5, recordedAt: '2026-04-12T02:00:00.000Z' },
      spots,
      visitedSpotIds: noVisits,
    });

    expect(result.state).toEqual(INITIAL_LANDMARK_ARRIVAL_STATE);
    expect(result.arrivedSpotId).toBeNull();
  });
});
