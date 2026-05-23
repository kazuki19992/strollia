import { NewLocationPoint } from '../../../types/gps';
import { advanceLocationQualityContext, createLocationQualityContext, evaluateLocationPointQuality } from '../locationQualityFilter';

/** 品質判定テスト用のGPSポイントを作る。 */
function point(
  latitude: number,
  longitude: number,
  recordedAt: string,
  overrides: Partial<NewLocationPoint> = {},
): NewLocationPoint {
  return {
    recordedAt,
    localDate: '2026-05-23',
    latitude,
    longitude,
    altitude: null,
    speed: null,
    heading: null,
    accuracy: 10,
    altitudeAccuracy: null,
    ...overrides,
  };
}

describe('GPS軌跡品質判定 locationQualityFilter', () => {
  it('精度の良い短距離移動は低速でもacceptedにする', () => {
    const context = createLocationQualityContext([point(35, 139, '2026-05-23T00:00:00.000Z')]);

    expect(evaluateLocationPointQuality(point(35.00008, 139, '2026-05-23T00:00:12.000Z'), context)).toMatchObject({
      type: 'accepted',
    });
  });

  it('精度上限を超える観測はrejectedにする', () => {
    const context = createLocationQualityContext([]);

    expect(evaluateLocationPointQuality(point(35, 139, '2026-05-23T00:00:00.000Z', { accuracy: 81 }), context)).toEqual({
      type: 'rejected',
      reason: 'accuracy-too-low',
    });
  });

  it('短時間の大ジャンプはraw speedが低くてもprovisionalにする', () => {
    const context = createLocationQualityContext([point(35, 139, '2026-05-23T00:00:00.000Z')]);
    const jump = point(35.02, 139, '2026-05-23T00:00:10.000Z', { speed: 1 });

    expect(evaluateLocationPointQuality(jump, context)).toMatchObject({
      type: 'provisional',
      reason: 'jump-suspected',
    });
  });

  it('停止クラスタ内の散りは移動距離にせずrejectedにする', () => {
    const context = createLocationQualityContext([
      point(35, 139, '2026-05-23T00:00:00.000Z'),
      point(35.00002, 139, '2026-05-23T00:00:20.000Z'),
      point(35.00001, 139.00001, '2026-05-23T00:00:40.000Z'),
    ]);

    expect(evaluateLocationPointQuality(point(35.00012, 139, '2026-05-23T00:01:00.000Z'), context)).toMatchObject({
      type: 'rejected',
      reason: 'stationary-drift',
    });
  });

  it('停止中に別位置へ3点だけドリフトしてもacceptedへ昇格しない', () => {
    const stationary = [
      point(35, 139, '2026-05-23T00:00:00.000Z'),
      point(35.00002, 139, '2026-05-23T00:00:20.000Z'),
      point(35.00001, 139.00001, '2026-05-23T00:00:40.000Z'),
    ];
    const first = advanceLocationQualityContext(
      point(35.00035, 139, '2026-05-23T00:01:00.000Z'),
      createLocationQualityContext(stationary),
    );
    const second = advanceLocationQualityContext(point(35.00036, 139.00001, '2026-05-23T00:01:20.000Z'), first.context);
    const third = advanceLocationQualityContext(point(35.00035, 139.00002, '2026-05-23T00:01:40.000Z'), second.context);

    expect(third.acceptedPoints).toEqual([]);
    expect(third.context.provisionalPoints).toHaveLength(3);
  });

  it('停止中に一方向へ自然に離脱した点列はacceptedへ昇格する', () => {
    const stationary = [
      point(35, 139, '2026-05-23T00:00:00.000Z'),
      point(35.00002, 139, '2026-05-23T00:00:20.000Z'),
      point(35.00001, 139.00001, '2026-05-23T00:00:40.000Z'),
    ];
    const first = advanceLocationQualityContext(
      point(35.00028, 139, '2026-05-23T00:01:00.000Z'),
      createLocationQualityContext(stationary),
    );
    const second = advanceLocationQualityContext(point(35.00042, 139, '2026-05-23T00:01:20.000Z'), first.context);
    const third = advanceLocationQualityContext(point(35.00056, 139, '2026-05-23T00:01:40.000Z'), second.context);
    const fourth = advanceLocationQualityContext(point(35.0007, 139, '2026-05-23T00:02:00.000Z'), third.context);

    expect(fourth.acceptedPoints).toHaveLength(4);
    expect(fourth.context.provisionalPoints).toEqual([]);
  });

  it('自然なprovisional点列はacceptedへ昇格する', () => {
    const accepted = [point(35, 139, '2026-05-23T00:00:00.000Z')];
    const first = advanceLocationQualityContext(point(35.01, 139, '2026-05-23T00:00:10.000Z'), createLocationQualityContext(accepted));
    const second = advanceLocationQualityContext(point(35.011, 139, '2026-05-23T00:00:20.000Z'), first.context);
    const third = advanceLocationQualityContext(point(35.012, 139, '2026-05-23T00:00:30.000Z'), second.context);

    expect(third.acceptedPoints).toHaveLength(3);
    expect(third.context.provisionalPoints).toEqual([]);
  });

  it('provisional誤軌道から直前accepted近傍へ戻る場合は保留区間を破棄する', () => {
    const accepted = [point(35, 139, '2026-05-23T00:00:00.000Z')];
    const first = advanceLocationQualityContext(point(35.01, 139, '2026-05-23T00:00:10.000Z'), createLocationQualityContext(accepted));
    const returned = advanceLocationQualityContext(point(35.00003, 139, '2026-05-23T00:00:20.000Z'), first.context);

    expect(returned.acceptedPoints).toEqual([]);
    expect(returned.context.provisionalPoints).toEqual([]);
  });
});
