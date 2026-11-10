import { INITIAL_LANDMARK_ARRIVAL_STATE, resolveLandmarkArrival } from '@/features/landmarks/landmarkArrivalResolver';
import type { LandmarkSpot } from '@/features/landmarks/landmarkCatalog';

/** 円1つのテスト用スポットを作る。地点IDはスポットIDと同じ(マスタの正規化と同じ形)。 */
function singleAreaSpot(id: string, name: string, latitude: number, dwellSeconds: number): LandmarkSpot {
  return {
    id,
    name,
    prefectures: ['TOCHIGI'],
    areas: [{ id, name, latitude, longitude: 139.501972, radiusMeters: 200, dwellSeconds }],
    isMultiArea: false,
    packs: [{ packId: 'pack-falls', order: 1 }],
  };
}

/** テスト用の華厳の滝。半径200m・滞在180秒。 */
const kegon = singleAreaSpot('spot-kegon', '華厳の滝', 36.737917, 180);

/** 華厳の滝から約1.5km離れたテスト用スポット。 */
const nearby = singleAreaSpot('spot-nearby', '近くの別スポット', 36.751, 180);

/** 2地点を持つテスト用の複数地点スポット。地点1は華厳の滝と同位置から約3km北、地点2はさらに約3km北。 */
const multi: LandmarkSpot = {
  id: 'spot-multi',
  name: '複数地点スポット',
  prefectures: ['TOCHIGI'],
  areas: [
    { id: 'area-1', name: '地点1', latitude: 36.8, longitude: 139.501972, radiusMeters: 200, dwellSeconds: 60 },
    { id: 'area-2', name: '地点2', latitude: 36.85, longitude: 139.501972, radiusMeters: 200, dwellSeconds: 120 },
  ],
  isMultiArea: true,
  packs: [{ packId: 'pack-falls', order: 2 }],
};

/** 中心からちょうど指定メートル北へずらした座標を作る。緯度1度は約111,320m。 */
function northOf(spot: LandmarkSpot, meters: number): { latitude: number; longitude: number } {
  return { latitude: spot.areas[0].latitude + meters / 111_320, longitude: spot.areas[0].longitude };
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
      visitedAreaIds: noVisits,
    });

    expect(result.arrival).toBeNull();
    expect(result.state.candidateAreaId).toBe('spot-kegon');
    expect(result.state.candidateEnteredAt).toBe('2026-04-12T02:00:00.000Z');
  });

  it('滞在時間に達した観測で到達が確定する', () => {
    const entered = resolveLandmarkArrival({
      state: INITIAL_LANDMARK_ARRIVAL_STATE,
      observation: observationAt(northOf(kegon, 50), '2026-04-12T02:00:00.000Z'),
      spots,
      visitedSpotIds: noVisits,
      visitedAreaIds: noVisits,
    });

    const result = resolveLandmarkArrival({
      state: entered.state,
      observation: observationAt(northOf(kegon, 60), '2026-04-12T02:03:00.000Z'),
      spots,
      visitedSpotIds: noVisits,
      visitedAreaIds: noVisits,
    });

    expect(result.arrival?.spotId).toBe('spot-kegon');
    expect(result.state).toEqual(INITIAL_LANDMARK_ARRIVAL_STATE);
  });

  it('滞在時間に1秒足りない観測では到達しない', () => {
    const entered = resolveLandmarkArrival({
      state: INITIAL_LANDMARK_ARRIVAL_STATE,
      observation: observationAt(northOf(kegon, 50), '2026-04-12T02:00:00.000Z'),
      spots,
      visitedSpotIds: noVisits,
      visitedAreaIds: noVisits,
    });

    const result = resolveLandmarkArrival({
      state: entered.state,
      observation: observationAt(northOf(kegon, 50), '2026-04-12T02:02:59.000Z'),
      spots,
      visitedSpotIds: noVisits,
      visitedAreaIds: noVisits,
    });

    expect(result.arrival).toBeNull();
  });

  it('観測が疎でも、入場から滞在時間が経っていれば到達する', () => {
    const entered = resolveLandmarkArrival({
      state: INITIAL_LANDMARK_ARRIVAL_STATE,
      observation: observationAt(northOf(kegon, 180), '2026-04-12T02:00:00.000Z'),
      spots,
      visitedSpotIds: noVisits,
      visitedAreaIds: noVisits,
    });

    // 途中の観測が1件も無いまま10分後の観測が届くケース(トンネル通過など)
    const result = resolveLandmarkArrival({
      state: entered.state,
      observation: observationAt(northOf(kegon, 20), '2026-04-12T02:10:00.000Z'),
      spots,
      visitedSpotIds: noVisits,
      visitedAreaIds: noVisits,
    });

    expect(result.arrival?.spotId).toBe('spot-kegon');
  });

  it('半径の境界ちょうどは範囲内として扱う', () => {
    const result = resolveLandmarkArrival({
      state: INITIAL_LANDMARK_ARRIVAL_STATE,
      observation: observationAt(northOf(kegon, 200), '2026-04-12T02:00:00.000Z'),
      spots,
      visitedSpotIds: noVisits,
      visitedAreaIds: noVisits,
    });

    expect(result.state.candidateAreaId).toBe('spot-kegon');
  });

  it('半径外に1点だけ外れても滞在時間はリセットしない', () => {
    const entered = resolveLandmarkArrival({
      state: INITIAL_LANDMARK_ARRIVAL_STATE,
      observation: observationAt(northOf(kegon, 50), '2026-04-12T02:00:00.000Z'),
      spots,
      visitedSpotIds: noVisits,
      visitedAreaIds: noVisits,
    });

    const outlier = resolveLandmarkArrival({
      state: entered.state,
      observation: observationAt(northOf(kegon, 400), '2026-04-12T02:01:00.000Z'),
      spots,
      visitedSpotIds: noVisits,
      visitedAreaIds: noVisits,
    });

    expect(outlier.state.candidateAreaId).toBe('spot-kegon');
    expect(outlier.state.candidateEnteredAt).toBe('2026-04-12T02:00:00.000Z');
    expect(outlier.state.outsideCount).toBe(1);

    const result = resolveLandmarkArrival({
      state: outlier.state,
      observation: observationAt(northOf(kegon, 50), '2026-04-12T02:03:00.000Z'),
      spots,
      visitedSpotIds: noVisits,
      visitedAreaIds: noVisits,
    });

    expect(result.arrival?.spotId).toBe('spot-kegon');
  });

  it('半径外が2点連続すると状態をリセットする', () => {
    const entered = resolveLandmarkArrival({
      state: INITIAL_LANDMARK_ARRIVAL_STATE,
      observation: observationAt(northOf(kegon, 50), '2026-04-12T02:00:00.000Z'),
      spots,
      visitedSpotIds: noVisits,
      visitedAreaIds: noVisits,
    });

    const first = resolveLandmarkArrival({
      state: entered.state,
      observation: observationAt(northOf(kegon, 400), '2026-04-12T02:01:00.000Z'),
      spots,
      visitedSpotIds: noVisits,
      visitedAreaIds: noVisits,
    });

    const second = resolveLandmarkArrival({
      state: first.state,
      observation: observationAt(northOf(kegon, 500), '2026-04-12T02:02:00.000Z'),
      spots,
      visitedSpotIds: noVisits,
      visitedAreaIds: noVisits,
    });

    expect(second.state).toEqual(INITIAL_LANDMARK_ARRIVAL_STATE);
  });

  it('別のスポットへ移ると入場時刻を取り直す', () => {
    const entered = resolveLandmarkArrival({
      state: INITIAL_LANDMARK_ARRIVAL_STATE,
      observation: observationAt(northOf(kegon, 50), '2026-04-12T02:00:00.000Z'),
      spots: [kegon, nearby],
      visitedSpotIds: noVisits,
      visitedAreaIds: noVisits,
    });

    const result = resolveLandmarkArrival({
      state: entered.state,
      observation: observationAt(northOf(nearby, 50), '2026-04-12T02:05:00.000Z'),
      spots: [kegon, nearby],
      visitedSpotIds: noVisits,
      visitedAreaIds: noVisits,
    });

    expect(result.arrival).toBeNull();
    expect(result.state.candidateAreaId).toBe('spot-nearby');
    expect(result.state.candidateEnteredAt).toBe('2026-04-12T02:05:00.000Z');
  });

  it('到達済みスポットは候補にしない', () => {
    const result = resolveLandmarkArrival({
      state: INITIAL_LANDMARK_ARRIVAL_STATE,
      observation: observationAt(northOf(kegon, 50), '2026-04-12T02:00:00.000Z'),
      spots,
      visitedSpotIds: new Set(['spot-kegon']),
      visitedAreaIds: noVisits,
    });

    expect(result.state).toEqual(INITIAL_LANDMARK_ARRIVAL_STATE);
    expect(result.arrival).toBeNull();
  });

  it('滞在時間0のスポットは半径内の最初の観測で到達する', () => {
    const instant: LandmarkSpot = singleAreaSpot('spot-instant', '即時スポット', 36.737917, 0);

    const result = resolveLandmarkArrival({
      state: INITIAL_LANDMARK_ARRIVAL_STATE,
      observation: observationAt(northOf(instant, 50), '2026-04-12T02:00:00.000Z'),
      spots: [instant],
      visitedSpotIds: noVisits,
      visitedAreaIds: noVisits,
    });

    expect(result.arrival?.spotId).toBe('spot-instant');
  });

  it('不正な座標の観測では状態を進めない', () => {
    const result = resolveLandmarkArrival({
      state: INITIAL_LANDMARK_ARRIVAL_STATE,
      observation: { latitude: Number.NaN, longitude: 139.5, recordedAt: '2026-04-12T02:00:00.000Z' },
      spots,
      visitedSpotIds: noVisits,
      visitedAreaIds: noVisits,
    });

    expect(result.state).toEqual(INITIAL_LANDMARK_ARRIVAL_STATE);
    expect(result.arrival).toBeNull();
  });

  describe('複数地点スポット', () => {
    const multiVisits = { spotIds: noVisits, areaIds: noVisits };

    /** 複数地点スポットの指定地点の中心に滞在する観測列で、到達を確定させる。 */
    function dwellAt(areaIndex: number, visitedAreaIds: ReadonlySet<string> = noVisits) {
      const area = multi.areas[areaIndex];
      const center = { latitude: area.latitude, longitude: area.longitude };
      const entered = resolveLandmarkArrival({
        state: INITIAL_LANDMARK_ARRIVAL_STATE,
        observation: observationAt(center, '2026-04-12T02:00:00.000Z'),
        spots: [multi],
        visitedSpotIds: multiVisits.spotIds,
        visitedAreaIds,
      });
      return { entered, area, center };
    }

    it('複数地点スポットの地点で滞在を満たすと、その地点の到達を返す', () => {
      const { entered, center } = dwellAt(1);

      expect(entered.state.candidateAreaId).toBe('area-2');
      const result = resolveLandmarkArrival({
        state: entered.state,
        observation: observationAt(center, '2026-04-12T02:02:00.000Z'),
        spots: [multi],
        visitedSpotIds: noVisits,
        visitedAreaIds: noVisits,
      });

      expect(result.arrival).toEqual({ spotId: 'spot-multi', areaId: 'area-2' });
    });

    it('到達済みの地点は候補にならず、同じスポットの別地点は計測できる', () => {
      const visitedArea1 = new Set(['area-1']);

      const atVisited = dwellAt(0, visitedArea1);
      const atOther = dwellAt(1, visitedArea1);

      expect(atVisited.entered.state.candidateAreaId).toBeNull();
      expect(atOther.entered.state.candidateAreaId).toBe('area-2');
    });

    it('到達済みスポットの地点はすべて候補にならない', () => {
      const result = resolveLandmarkArrival({
        state: INITIAL_LANDMARK_ARRIVAL_STATE,
        observation: observationAt({ latitude: multi.areas[1].latitude, longitude: multi.areas[1].longitude }, '2026-04-12T02:00:00.000Z'),
        spots: [multi],
        visitedSpotIds: new Set(['spot-multi']),
        visitedAreaIds: noVisits,
      });

      expect(result.state.candidateAreaId).toBeNull();
      expect(result.arrival).toBeNull();
    });

    it('旧形式の計測中状態(候補=円1つのスポットID)から滞在計測を引き継ぐ', () => {
      // 旧実装は candidate にスポットIDを保存していた。円1つのスポットでは地点ID=スポットIDなので同じ値で続行できる
      const legacyState = { candidateAreaId: 'spot-kegon', candidateEnteredAt: '2026-04-12T02:00:00.000Z', outsideCount: 0 };

      const result = resolveLandmarkArrival({
        state: legacyState,
        observation: observationAt(northOf(kegon, 50), '2026-04-12T02:03:00.000Z'),
        spots,
        visitedSpotIds: noVisits,
        visitedAreaIds: noVisits,
      });

      expect(result.arrival).toEqual({ spotId: 'spot-kegon', areaId: 'spot-kegon' });
    });
  });
});
