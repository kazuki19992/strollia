import { RouteCoordinate } from '@/features/map/routeMapper';
import { INITIAL_STAY_PLACE_SNAP_STATE, resolveStayPlaceSnap, StayPlaceSnapState } from '@/features/stayPlaces/stayPlaceSnapResolver';
import { StayPlace } from '@/features/stayPlaces/stayPlaceTypes';

const home: StayPlace = {
  id: 1,
  name: '自宅',
  iconHexcode: '1F3E0',
  latitude: 35,
  longitude: 139,
  privacyRadiusMeters: null,
  createdAt: '2026-08-19T00:00:00.000Z',
  updatedAt: '2026-08-19T00:00:00.000Z',
};

/** 緯度方向に指定メートルだけ離れた位置を、Haversineの地球半径から作る。 */
function atLatitudeDistance(meters: number): RouteCoordinate {
  return { latitude: home.latitude + (meters * 180) / (Math.PI * 6_371_000), longitude: home.longitude };
}

/** 同じ入力を連続して吸着resolverに通した結果のstateを返す。 */
function resolveRepeatedly(raw: RouteCoordinate, count: number, activeStayPlaces: StayPlace[] = [home]): StayPlaceSnapState {
  let state = INITIAL_STAY_PLACE_SNAP_STATE;

  for (let index = 0; index < count; index += 1) {
    state = resolveStayPlaceSnap({ state, raw, activeStayPlaces }).state;
  }

  return state;
}

describe('滞在場所へのGPS吸着 resolveStayPlaceSnap', () => {
  it('半径50m内の3点目で初めて中心座標へ吸着し、先行する2点は生座標のままにする', () => {
    const raw = atLatitudeDistance(40);
    const first = resolveStayPlaceSnap({ state: INITIAL_STAY_PLACE_SNAP_STATE, raw, activeStayPlaces: [home] });
    const second = resolveStayPlaceSnap({ state: first.state, raw, activeStayPlaces: [home] });
    const third = resolveStayPlaceSnap({ state: second.state, raw, activeStayPlaces: [home] });

    expect(first.effective).toEqual(raw);
    expect(second.effective).toEqual(raw);
    expect(third.effective).toEqual({ latitude: home.latitude, longitude: home.longitude });
    expect(third.snappedStayPlaceId).toBe(home.id);
  });

  it('中心からちょうど50mの地点を範囲内として3点目で吸着する', () => {
    const boundary = atLatitudeDistance(50);
    const stateAfterTwoInside = resolveRepeatedly(boundary, 2);

    expect(resolveStayPlaceSnap({ state: stateAfterTwoInside, raw: boundary, activeStayPlaces: [home] }).effective).toEqual({
      latitude: home.latitude,
      longitude: home.longitude,
    });
  });

  it('吸着中は半径外の2点目まで中心座標を維持し、3点目で生座標へ戻す', () => {
    const stateAfterEntry = resolveRepeatedly(atLatitudeDistance(40), 3);
    const outside = atLatitudeDistance(60);
    const firstOutside = resolveStayPlaceSnap({ state: stateAfterEntry, raw: outside, activeStayPlaces: [home] });
    const secondOutside = resolveStayPlaceSnap({ state: firstOutside.state, raw: outside, activeStayPlaces: [home] });
    const thirdOutside = resolveStayPlaceSnap({ state: secondOutside.state, raw: outside, activeStayPlaces: [home] });

    expect(firstOutside.effective).toEqual({ latitude: home.latitude, longitude: home.longitude });
    expect(secondOutside.effective).toEqual({ latitude: home.latitude, longitude: home.longitude });
    expect(thirdOutside.effective).toEqual(outside);
    expect(thirdOutside.snappedStayPlaceId).toBeNull();
    expect(thirdOutside.state).toEqual(INITIAL_STAY_PLACE_SNAP_STATE);
  });

  it('重複範囲では最も近い中心を候補にする', () => {
    const office: StayPlace = {
      ...home,
      id: 2,
      name: '職場',
      longitude: 139.0003,
      createdAt: '2026-08-20T00:00:00.000Z',
    };
    const raw = { latitude: 35, longitude: 139.00005 };
    const stateAfterTwoInside = resolveRepeatedly(raw, 2, [office, home]);

    expect(resolveStayPlaceSnap({ state: stateAfterTwoInside, raw, activeStayPlaces: [office, home] }).snappedStayPlaceId).toBe(home.id);
  });

  it('重複範囲で中心まで同距離の場合は作成日時とID順で候補を決める', () => {
    const first = { ...home, id: 10, name: '先', createdAt: '2026-08-19T00:00:00.000Z' };
    const second = { ...home, id: 20, name: '後', createdAt: '2026-08-19T00:00:00.000Z' };
    const raw = { latitude: home.latitude, longitude: home.longitude };
    const stateAfterTwoInside = resolveRepeatedly(raw, 2, [second, first]);

    expect(resolveStayPlaceSnap({ state: stateAfterTwoInside, raw, activeStayPlaces: [second, first] }).snappedStayPlaceId).toBe(first.id);
  });

  it('契約変更などで吸着先が有効集合から外れた場合はその位置更新から生座標へ戻す', () => {
    const stateAfterEntry = resolveRepeatedly(atLatitudeDistance(40), 3);
    const raw = atLatitudeDistance(10);

    const result = resolveStayPlaceSnap({ state: stateAfterEntry, raw, activeStayPlaces: [] });

    expect(result.effective).toEqual(raw);
    expect(result.snappedStayPlaceId).toBeNull();
    expect(result.state).toEqual(INITIAL_STAY_PLACE_SNAP_STATE);
  });

  it('再起動相当の初期状態では既に範囲内でも最初の点を吸着しない', () => {
    const raw = atLatitudeDistance(10);

    const result = resolveStayPlaceSnap({ state: INITIAL_STAY_PLACE_SNAP_STATE, raw, activeStayPlaces: [home] });

    expect(result.effective).toEqual(raw);
    expect(result.state).toEqual({ activeStayPlaceId: null, candidateStayPlaceId: home.id, candidateCount: 1, outsideCount: 0 });
  });
});
