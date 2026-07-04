import { DELETE_ALL_DATA_SUCCESS_MESSAGE, refreshDeletedUserDataState } from '@/app/deleteAllDataFlow';

describe('全データ削除後の状態同期', () => {
  test('GPSログと実績状態を再読み込みし削除範囲に合う成功文言を使う', async () => {
    const refreshData = jest.fn().mockResolvedValue(undefined);
    const refreshAchievementState = jest.fn().mockResolvedValue(undefined);

    await refreshDeletedUserDataState(refreshData, refreshAchievementState);

    expect(refreshData).toHaveBeenCalledTimes(1);
    expect(refreshAchievementState).toHaveBeenCalledWith(true);
    expect(DELETE_ALL_DATA_SUCCESS_MESSAGE).toBe('保存済みのGPSログ・訪問エリア・実績データを削除しました。');
  });
});
