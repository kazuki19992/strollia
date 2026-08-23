import { isStaleLocationObservation } from '@/features/location/locationObservationOrder';

describe('位置観測の順序判定 isStaleLocationObservation', () => {
  it('最終観測日時が処理時刻より1時間を超えて未来ならガードを無効にする', () => {
    expect(isStaleLocationObservation('2026-08-23T13:00:01.000Z', '2026-08-23T12:00:00.000Z', '2026-08-23T12:00:00.000Z')).toBe(false);
  });

  it('最終観測日時が処理時刻のちょうど1時間後なら同時刻の観測を古いと判定する', () => {
    expect(isStaleLocationObservation('2026-08-23T13:00:00.000Z', '2026-08-23T13:00:00.000Z', '2026-08-23T12:00:00.000Z')).toBe(true);
  });

  it('信頼できる最終観測日時以前の観測は古いと判定する', () => {
    expect(isStaleLocationObservation('2026-08-23T12:00:00.000Z', '2026-08-23T11:59:59.000Z', '2026-08-23T12:00:01.000Z')).toBe(true);
  });

  it('不正な最終観測日時は記録を停止させない', () => {
    expect(isStaleLocationObservation('not-a-date', '2026-08-23T12:00:00.000Z', '2026-08-23T12:00:01.000Z')).toBe(false);
  });
});
