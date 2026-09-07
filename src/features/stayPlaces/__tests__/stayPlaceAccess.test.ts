import { resolveActiveStayPlaces } from '@/features/stayPlaces/stayPlaceAccess';
import { StayPlace } from '@/features/stayPlaces/stayPlaceTypes';

/** 登録順を指定して滞在場所のfixtureを作る。 */
function stayPlace(id: number, createdAt: string): StayPlace {
  return {
    id,
    name: `場所${id}`,
    iconHexcode: '1F3E0',
    latitude: 35 + id / 100,
    longitude: 139 + id / 100,
    privacyRadiusMeters: null,
    createdAt,
    updatedAt: createdAt,
  };
}

describe('滞在場所の契約有効化 resolveActiveStayPlaces', () => {
  it('Plusが有効な場合は入力順に関わらず登録順の全件を返す', () => {
    const oldest = stayPlace(1, '2026-08-19T00:00:00.000Z');
    const newest = stayPlace(2, '2026-08-20T00:00:00.000Z');

    expect(resolveActiveStayPlaces([newest, oldest], true)).toEqual([oldest, newest]);
  });

  it('Plusが無効な場合は登録順で最初の1件だけを返す', () => {
    const oldest = stayPlace(1, '2026-08-19T00:00:00.000Z');
    const newest = stayPlace(2, '2026-08-20T00:00:00.000Z');

    expect(resolveActiveStayPlaces([newest, oldest], false)).toEqual([oldest]);
  });

  it('作成日時が同じ場合はID昇順で安定して有効な場所を決める', () => {
    const laterId = stayPlace(20, '2026-08-19T00:00:00.000Z');
    const earlierId = stayPlace(10, '2026-08-19T00:00:00.000Z');

    expect(resolveActiveStayPlaces([laterId, earlierId], false)).toEqual([earlierId]);
    expect(resolveActiveStayPlaces([laterId, earlierId], true)).toEqual([earlierId, laterId]);
  });

  it('登録済みの滞在場所がない場合は契約状態によらず空配列を返す', () => {
    expect(resolveActiveStayPlaces([], false)).toEqual([]);
    expect(resolveActiveStayPlaces([], true)).toEqual([]);
  });
});
