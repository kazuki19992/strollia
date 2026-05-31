import { coordinateToGridCell } from '../../location/grid/gridCell';
import { createDailyDetailReport } from '../dailyReport';

const basePoint = {
  id: 1,
  recordedAt: '2026-05-31T00:00:00.000Z',
  localDate: '2026-05-31',
  latitude: 35.681236,
  longitude: 139.767125,
  altitude: null,
  speed: null,
  heading: null,
  accuracy: 10,
  altitudeAccuracy: null,
};

describe('日別詳細レポート createDailyDetailReport', () => {
  it('同じエリアに複数ポイントがあっても訪問エリア数は重複しない', () => {
    const firstCell = coordinateToGridCell(basePoint);
    const secondPoint = { ...basePoint, id: 2, recordedAt: '2026-05-31T00:05:00.000Z', latitude: 35.6825 };
    const secondCell = coordinateToGridCell(secondPoint);

    const report = createDailyDetailReport({
      localDate: '2026-05-31',
      points: [basePoint, { ...basePoint, id: 3 }, secondPoint],
      visitedCells: [
        { ...firstCell, firstVisitedAt: '2026-05-30T00:00:00.000Z' },
        { ...secondCell, firstVisitedAt: '2026-05-31T00:05:00.000Z' },
      ],
      unlockedAchievements: [],
    });

    expect(report.visitedAreaCount).toBe(2);
    expect(report.newAreaCount).toBe(1);
    expect(report.pointCount).toBe(3);
  });

  it('その日に解除した実績を表示用に保持する', () => {
    const report = createDailyDetailReport({
      localDate: '2026-05-31',
      points: [basePoint],
      visitedCells: [{ ...coordinateToGridCell(basePoint), firstVisitedAt: '2026-05-31T00:00:00.000Z' }],
      unlockedAchievements: [
        {
          id: 'distance-100',
          title: '100km移動した',
          unlockedAt: '2026-05-31T09:00:00.000Z',
        },
      ],
    });

    expect(report.unlockedAchievements).toEqual([
      {
        id: 'distance-100',
        title: '100km移動した',
        unlockedAt: '2026-05-31T09:00:00.000Z',
      },
    ]);
  });

  it('GPSポイントとvisited cellが空なら新規エリア数は0にする', () => {
    const report = createDailyDetailReport({
      localDate: '2026-05-31',
      points: [],
      visitedCells: [],
      unlockedAchievements: [],
    });

    expect(report.visitedAreaCount).toBe(0);
    expect(report.newAreaCount).toBe(0);
  });

  it('firstVisitedAtがないvisited cellは新規エリアに数えない', () => {
    const cell = coordinateToGridCell(basePoint);
    const report = createDailyDetailReport({
      localDate: '2026-05-31',
      points: [basePoint],
      visitedCells: [{ ...cell, firstVisitedAt: null }],
      unlockedAchievements: [],
    });

    expect(report.visitedAreaCount).toBe(1);
    expect(report.newAreaCount).toBe(0);
  });

  it('firstVisitedAtが対象日以外なら新規エリアに数えない', () => {
    const cell = coordinateToGridCell(basePoint);
    const report = createDailyDetailReport({
      localDate: '2026-05-31',
      points: [basePoint],
      visitedCells: [{ ...cell, firstVisitedAt: '2026-05-30T00:00:00.000Z' }],
      unlockedAchievements: [],
    });

    expect(report.visitedAreaCount).toBe(1);
    expect(report.newAreaCount).toBe(0);
  });
});
