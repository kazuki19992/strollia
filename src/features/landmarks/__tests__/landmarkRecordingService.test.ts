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

  it('Plus無効なら検知を行わない', async () => {
    (getConfirmedPremiumAccessState as jest.Mock).mockResolvedValue({ isPlusActive: false, entitlementId: 'strollia_plus' });

    const snapshot = await getLandmarkDetectionSnapshotForRecording();

    expect(snapshot.status).toBe('disabled');
    expect(getVisitedLandmarkSpotIds).not.toHaveBeenCalled();
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
    // そちらを使うと一時的な通信失敗が disabled と区別できず滞在計測がリセットされる。
    (getConfirmedPremiumAccessState as jest.Mock).mockRejectedValue(new Error('network unreachable'));
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => undefined);

    const snapshot = await getLandmarkDetectionSnapshotForRecording();

    expect(snapshot.status).toBe('unavailable');
    expect(snapshot.status).not.toBe('disabled');
    warn.mockRestore();
  });
});
