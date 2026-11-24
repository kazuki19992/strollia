import { db } from '@/db/database';
import {
  completeAnnualReport,
  deleteAnnualReport,
  getAnnualReport,
  markAnnualReportNotificationScheduled,
  saveAnnualReportProgress,
} from '@/features/annualReport/annualReportRepository';
import type { AnnualReportPayloadV1, AnnualReportProgress } from '@/features/annualReport/annualReportTypes';

jest.mock('@/db/database', () => ({
  db: {
    getFirstAsync: jest.fn(),
    runAsync: jest.fn(),
  },
}));

const progress: AnnualReportProgress = {
  nextMonth: 3,
  activeDates: ['2026-01-02'],
  monthlyDistanceMeters: [100, 200, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
  yearRouteSegments: [[{ latitude: 35, longitude: 139 }]],
  farthestCandidate: { localDate: '2026-01-02', distanceMeters: 100 },
};

const payload: AnnualReportPayloadV1 = {
  version: 1,
  year: 2026,
  periodStart: '2026-01-01',
  periodEnd: '2026-12-15',
  activeDays: 1,
  activeDates: ['2026-01-02'],
  totalDistanceMeters: 300,
  monthlyDistanceMeters: new Array(12).fill(0),
  yearRouteSegments: [],
  farthestDay: null,
  visitedPrefectures: ['東京都'],
  newPrefectures: [],
  newMunicipalityCount: 0,
  newCellCount: 0,
  previousCellCount: 0,
  achievements: { count: 0, highlights: [] },
  spots: { count: 0, highlights: [] },
};

describe('年次レポートリポジトリ annualReportRepository', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('保存済みの集計途中JSONを型どおりに復元する', async () => {
    (db.getFirstAsync as jest.Mock).mockResolvedValue({
      year: 2026,
      payload_version: 1,
      status: 'in_progress',
      progress_json: JSON.stringify(progress),
      payload_json: null,
      notification_scheduled_at: null,
    });

    await expect(getAnnualReport(2026)).resolves.toEqual({
      year: 2026,
      status: 'in_progress',
      progress,
      notificationScheduledAt: null,
    });
  });

  it('完成済みレポートのpayloadと通知予約日時を復元する', async () => {
    (db.getFirstAsync as jest.Mock).mockResolvedValue({
      year: 2026,
      payload_version: 1,
      status: 'completed',
      progress_json: null,
      payload_json: JSON.stringify(payload),
      notification_scheduled_at: '2026-12-20T00:00:00.000Z',
    });

    await expect(getAnnualReport(2026)).resolves.toEqual({
      year: 2026,
      status: 'completed',
      payload,
      notificationScheduledAt: '2026-12-20T00:00:00.000Z',
    });
  });

  it('行が存在しない場合はnullを返す', async () => {
    (db.getFirstAsync as jest.Mock).mockResolvedValue(null);

    await expect(getAnnualReport(2026)).resolves.toBeNull();
  });

  it('JSONが壊れている場合はnullを返す', async () => {
    (db.getFirstAsync as jest.Mock).mockResolvedValue({
      year: 2026,
      payload_version: 1,
      status: 'completed',
      progress_json: null,
      payload_json: '{broken',
      notification_scheduled_at: null,
    });

    await expect(getAnnualReport(2026)).resolves.toBeNull();
  });

  it('payload_versionが未知の場合はnullを返す', async () => {
    (db.getFirstAsync as jest.Mock).mockResolvedValue({
      year: 2026,
      payload_version: 2,
      status: 'completed',
      progress_json: null,
      payload_json: JSON.stringify(payload),
      notification_scheduled_at: null,
    });

    await expect(getAnnualReport(2026)).resolves.toBeNull();
  });

  it('completedなのにpayload_jsonがない行はnullを返す', async () => {
    (db.getFirstAsync as jest.Mock).mockResolvedValue({
      year: 2026,
      payload_version: 1,
      status: 'completed',
      progress_json: null,
      payload_json: null,
      notification_scheduled_at: null,
    });

    await expect(getAnnualReport(2026)).resolves.toBeNull();
  });

  it('途中経過をin_progressでUPSERTする', async () => {
    await saveAnnualReportProgress(2026, progress);

    const args = (db.runAsync as jest.Mock).mock.calls[0];
    expect(args[0]).toContain('INSERT INTO annual_reports');
    expect(args[0]).toContain('ON CONFLICT(year)');
    expect(args).toContain(2026);
    expect(args).toContain('in_progress');
    expect(args).toContain(JSON.stringify(progress));
  });

  it('途中経過の保存は完成済みの行を上書きしない', async () => {
    await saveAnnualReportProgress(2026, progress);

    const [sql] = (db.runAsync as jest.Mock).mock.calls[0];
    expect(sql).toMatch(/ON CONFLICT\(year\) DO UPDATE SET[\s\S]*WHERE annual_reports\.status <> 'completed'/);
  });

  it('完成時はstatusをcompletedにしprogress_jsonをNULLにする', async () => {
    await completeAnnualReport(2026, payload);

    const [sql, ...params] = (db.runAsync as jest.Mock).mock.calls[0];
    expect(sql).toContain('progress_json = NULL');
    expect(params).toContain('completed');
    expect(params).toContain(JSON.stringify(payload));
  });

  it('通知予約日時を保存する', async () => {
    await markAnnualReportNotificationScheduled(2026, '2026-12-20T00:00:00.000Z');

    const [sql, ...params] = (db.runAsync as jest.Mock).mock.calls[0];
    expect(sql).toContain('UPDATE annual_reports');
    expect(params).toContain('2026-12-20T00:00:00.000Z');
    expect(params).toContain(2026);
  });

  it('対象年の行を削除する', async () => {
    await deleteAnnualReport(2026);

    expect(db.runAsync).toHaveBeenCalledWith('DELETE FROM annual_reports WHERE year = ?', 2026);
  });
});
