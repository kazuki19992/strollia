import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';

import { updateBackgroundLocationTaskOptionsIfNeeded } from '../locationService';
import { BACKGROUND_LOCATION_TASK_NAME, getLocationTaskOptions } from '../locationTrackingConfig';

jest.mock('expo-location', () => ({
  Accuracy: { High: 4 },
  hasStartedLocationUpdatesAsync: jest.fn(),
  startLocationUpdatesAsync: jest.fn().mockResolvedValue(undefined),
  stopLocationUpdatesAsync: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('expo-task-manager', () => ({
  getTaskOptionsAsync: jest.fn(),
  isAvailableAsync: jest.fn(),
}));

const mockedLocation = Location as jest.Mocked<typeof Location>;
const mockedTaskManager = TaskManager as jest.Mocked<typeof TaskManager>;

describe('バックグラウンド位置情報タスクの設定更新 updateBackgroundLocationTaskOptionsIfNeeded', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedTaskManager.isAvailableAsync.mockResolvedValue(true);
  });

  it('記録中で設定が古い場合は停止せず同名タスクへ最新設定を適用する', async () => {
    mockedLocation.hasStartedLocationUpdatesAsync.mockResolvedValue(true);
    mockedTaskManager.getTaskOptionsAsync.mockResolvedValue({
      ...getLocationTaskOptions(),
      showsBackgroundLocationIndicator: true,
    });

    await updateBackgroundLocationTaskOptionsIfNeeded();

    expect(mockedLocation.stopLocationUpdatesAsync).not.toHaveBeenCalled();
    expect(mockedLocation.startLocationUpdatesAsync).toHaveBeenCalledWith(
      BACKGROUND_LOCATION_TASK_NAME,
      getLocationTaskOptions(),
    );
  });

  it('記録中で設定が最新の場合はstartもstopも呼ばない', async () => {
    mockedLocation.hasStartedLocationUpdatesAsync.mockResolvedValue(true);
    mockedTaskManager.getTaskOptionsAsync.mockResolvedValue(getLocationTaskOptions());

    await updateBackgroundLocationTaskOptionsIfNeeded();

    expect(mockedLocation.startLocationUpdatesAsync).not.toHaveBeenCalled();
    expect(mockedLocation.stopLocationUpdatesAsync).not.toHaveBeenCalled();
  });

  it('記録していない場合はオプション取得もstartもstopも呼ばない', async () => {
    mockedLocation.hasStartedLocationUpdatesAsync.mockResolvedValue(false);

    await updateBackgroundLocationTaskOptionsIfNeeded();

    expect(mockedTaskManager.getTaskOptionsAsync).not.toHaveBeenCalled();
    expect(mockedLocation.startLocationUpdatesAsync).not.toHaveBeenCalled();
    expect(mockedLocation.stopLocationUpdatesAsync).not.toHaveBeenCalled();
  });

  it('TaskManagerが利用できない場合はタスク状態を確認しない', async () => {
    mockedTaskManager.isAvailableAsync.mockResolvedValue(false);

    await updateBackgroundLocationTaskOptionsIfNeeded();

    expect(mockedLocation.hasStartedLocationUpdatesAsync).not.toHaveBeenCalled();
    expect(mockedTaskManager.getTaskOptionsAsync).not.toHaveBeenCalled();
  });
});
