import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';

import { refreshBackgroundLocationTaskRegistration } from '../locationService';
import { BACKGROUND_LOCATION_TASK_NAME, getLocationTaskOptions } from '../locationTrackingConfig';

jest.mock('expo-location', () => ({
  Accuracy: { High: 4 },
  hasStartedLocationUpdatesAsync: jest.fn(),
  startLocationUpdatesAsync: jest.fn().mockResolvedValue(undefined),
  stopLocationUpdatesAsync: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('expo-task-manager', () => ({
  isAvailableAsync: jest.fn(),
}));

const mockedLocation = Location as jest.Mocked<typeof Location>;
const mockedTaskManager = TaskManager as jest.Mocked<typeof TaskManager>;

describe('refreshBackgroundLocationTaskRegistration', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedTaskManager.isAvailableAsync.mockResolvedValue(true);
  });

  it('記録中のときは stop→start でタスクを再登録し、最新オプションを適用する', async () => {
    mockedLocation.hasStartedLocationUpdatesAsync.mockResolvedValue(true);

    await refreshBackgroundLocationTaskRegistration();

    expect(mockedLocation.stopLocationUpdatesAsync).toHaveBeenCalledWith(BACKGROUND_LOCATION_TASK_NAME);
    expect(mockedLocation.startLocationUpdatesAsync).toHaveBeenCalledWith(
      BACKGROUND_LOCATION_TASK_NAME,
      getLocationTaskOptions(),
    );
    // stop が start より先に呼ばれること（順序）
    const stopOrder = mockedLocation.stopLocationUpdatesAsync.mock.invocationCallOrder[0];
    const startOrder = mockedLocation.startLocationUpdatesAsync.mock.invocationCallOrder[0];
    expect(stopOrder).toBeLessThan(startOrder);
  });

  it('記録していないときは何もしない（停止中ユーザーに記録を開始させない）', async () => {
    mockedLocation.hasStartedLocationUpdatesAsync.mockResolvedValue(false);

    await refreshBackgroundLocationTaskRegistration();

    expect(mockedLocation.stopLocationUpdatesAsync).not.toHaveBeenCalled();
    expect(mockedLocation.startLocationUpdatesAsync).not.toHaveBeenCalled();
  });

  it('TaskManagerが利用できない環境では何もしない', async () => {
    mockedTaskManager.isAvailableAsync.mockResolvedValue(false);

    await refreshBackgroundLocationTaskRegistration();

    expect(mockedLocation.hasStartedLocationUpdatesAsync).not.toHaveBeenCalled();
    expect(mockedLocation.stopLocationUpdatesAsync).not.toHaveBeenCalled();
    expect(mockedLocation.startLocationUpdatesAsync).not.toHaveBeenCalled();
  });
});
