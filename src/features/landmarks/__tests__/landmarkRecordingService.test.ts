import { getLandmarkDetectionSnapshotForRecording } from '@/features/landmarks/landmarkRecordingService';
import { getVisitedLandmarkSpotIds } from '@/features/landmarks/landmarkVisitRepository';
import { getConfirmedPremiumAccessState } from '@/features/premium/revenueCatAccess';

jest.mock('@/features/premium/revenueCatAccess', () => ({
  getConfirmedPremiumAccessState: jest.fn(),
}));

jest.mock('@/features/landmarks/landmarkVisitRepository', () => ({
  getVisitedLandmarkSpotIds: jest.fn(),
}));

describe('スポット検知の記録境界 landmarkRecordingService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (getVisitedLandmarkSpotIds as jest.Mock).mockResolvedValue(new Set());
  });

  it('Plus有効なら検知対象のスポットと到達済みIDを返す', async () => {
    (getConfirmedPremiumAccessState as jest.Mock).mockResolvedValue({ isPlusActive: true, entitlementId: 'strollia_plus' });
    (getVisitedLandmarkSpotIds as jest.Mock).mockResolvedValue(new Set(['01a0c450-6c00-7000-8000-000000000101']));

    const snapshot = await getLandmarkDetectionSnapshotForRecording();

    expect(snapshot.status).toBe('enabled');
    if (snapshot.status === 'enabled') {
      expect(snapshot.spots.length).toBeGreaterThan(0);
      expect(snapshot.visitedSpotIds.has('01a0c450-6c00-7000-8000-000000000101')).toBe(true);
    }
  });

  it('Plus無効でも無料パックのスポットは検知対象に含める', async () => {
    // 2026-09-27時点、実マスタのパックは全て無料(日本三名瀑)なので、Plus無効でも空にならない
    (getConfirmedPremiumAccessState as jest.Mock).mockResolvedValue({ isPlusActive: false, entitlementId: 'strollia_plus' });

    const snapshot = await getLandmarkDetectionSnapshotForRecording();

    expect(snapshot.status).toBe('enabled');
    if (snapshot.status === 'enabled') {
      expect(snapshot.spots.length).toBeGreaterThan(0);
    }
  });

  it('取得に失敗した場合はunavailableを返す', async () => {
    (getConfirmedPremiumAccessState as jest.Mock).mockRejectedValue(new Error('offline'));
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => undefined);

    await expect(getLandmarkDetectionSnapshotForRecording()).resolves.toEqual({ status: 'unavailable' });

    expect(warn).toHaveBeenCalledWith('Landmark detection snapshot loading failed:', expect.any(Error));
    warn.mockRestore();
  });

  it('課金状態の取得失敗をPlus無効へ丸めない', async () => {
    // getPremiumAccessState は失敗時に既定状態(本番ではPlus無効)を返すため、
    // そちらを使うと一時的な通信失敗が「無料パックのみ検知」と区別できず誤った制限になる。
    (getConfirmedPremiumAccessState as jest.Mock).mockRejectedValue(new Error('network unreachable'));
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => undefined);

    const snapshot = await getLandmarkDetectionSnapshotForRecording();

    expect(snapshot.status).toBe('unavailable');
    warn.mockRestore();
  });
});
