import { act, renderHook } from '@testing-library/react-native';
import type { LocationObject } from 'expo-location';

import { useForegroundUserLocation } from '@/ui/hooks/useForegroundUserLocation';

const mockEnsureForegroundLocationPermission = jest.fn();
const mockWatchPositionAsync = jest.fn();
const mockGetLastKnownPositionAsync = jest.fn();
const mockRemove = jest.fn();
const mockRecordLocations = jest.fn();
const mockCreateLocationRecordingSession = jest.fn();

jest.mock('@/features/location/locationService', () => ({
  ensureForegroundLocationPermission: (...args: unknown[]) => mockEnsureForegroundLocationPermission(...args),
}));

jest.mock('@/features/location/locationRecordingSession', () => ({
  createLocationRecordingSession: (...args: unknown[]) => mockCreateLocationRecordingSession(...args),
}));

jest.mock('expo-location', () => ({
  Accuracy: { Balanced: 3, High: 6 },
  watchPositionAsync: (...args: unknown[]) => mockWatchPositionAsync(...args),
  getLastKnownPositionAsync: (...args: unknown[]) => mockGetLastKnownPositionAsync(...args),
}));

function flushPromises(): Promise<void> {
  return new Promise((resolve) => setImmediate(resolve));
}

type HarnessProps = {
  enabled: boolean;
  shouldPersist: boolean;
  onLocation?: (lat: number, lng: number, speed: number | null) => void;
  onError?: (error: unknown) => void;
};

const watchedLocation = {
  timestamp: 1,
  coords: { latitude: 35, longitude: 139, speed: 2.5 },
} as LocationObject;

describe('前景位置ウォッチ useForegroundUserLocation', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockEnsureForegroundLocationPermission.mockResolvedValue(true);
    mockGetLastKnownPositionAsync.mockResolvedValue(null);
    mockWatchPositionAsync.mockResolvedValue({ remove: mockRemove });
    mockRecordLocations.mockResolvedValue(undefined);
    mockCreateLocationRecordingSession.mockResolvedValue({ recordLocations: mockRecordLocations });
  });

  test('enabled=falseのときウォッチを開始しない', async () => {
    renderHook(() => useForegroundUserLocation({ enabled: false, shouldPersist: false }));

    await act(async () => {
      await flushPromises();
    });

    expect(mockWatchPositionAsync).not.toHaveBeenCalled();
  });

  test('表示専用ではBalanced、保存時はHighでウォッチを1つ開始する', async () => {
    const { rerender } = renderHook(({ enabled, shouldPersist }: HarnessProps) => useForegroundUserLocation({ enabled, shouldPersist }), {
      initialProps: { enabled: true, shouldPersist: false },
    });

    await act(async () => {
      await flushPromises();
    });

    expect(mockWatchPositionAsync).toHaveBeenLastCalledWith({ accuracy: 3, distanceInterval: 5, timeInterval: 2000 }, expect.any(Function));

    await act(async () => {
      rerender({ enabled: true, shouldPersist: true });
      await flushPromises();
    });

    expect(mockWatchPositionAsync).toHaveBeenLastCalledWith({ accuracy: 6, distanceInterval: 5, timeInterval: 2000 }, expect.any(Function));
    expect(mockWatchPositionAsync).toHaveBeenCalledTimes(2);
  });

  test('最終取得位置は表示へ渡すが保存しない', async () => {
    const onLocation = jest.fn();
    mockGetLastKnownPositionAsync.mockResolvedValue(watchedLocation);

    renderHook(() => useForegroundUserLocation({ enabled: true, shouldPersist: true, onLocation }));

    await act(async () => {
      await flushPromises();
    });

    expect(onLocation).toHaveBeenCalledWith(35, 139, 2.5);
    expect(mockCreateLocationRecordingSession).not.toHaveBeenCalled();
    expect(mockRecordLocations).not.toHaveBeenCalled();
  });

  test('新しい位置更新を表示と保存セッションへ渡す', async () => {
    const onLocation = jest.fn();
    let watchCallback: ((location: LocationObject) => void) | null = null;
    mockWatchPositionAsync.mockImplementation((_options: unknown, callback: (location: LocationObject) => void) => {
      watchCallback = callback;
      return Promise.resolve({ remove: mockRemove });
    });

    renderHook(() => useForegroundUserLocation({ enabled: true, shouldPersist: true, onLocation }));

    await act(async () => {
      await flushPromises();
    });
    await act(async () => {
      watchCallback?.(watchedLocation);
      await flushPromises();
    });

    expect(onLocation).toHaveBeenCalledWith(35, 139, 2.5);
    expect(mockCreateLocationRecordingSession).toHaveBeenCalledTimes(1);
    expect(mockRecordLocations).toHaveBeenCalledWith([watchedLocation]);
  });

  test('表示コールバックがなくても新しい位置を保存する', async () => {
    let watchCallback: ((location: LocationObject) => void) | null = null;
    mockWatchPositionAsync.mockImplementation((_options: unknown, callback: (location: LocationObject) => void) => {
      watchCallback = callback;
      return Promise.resolve({ remove: mockRemove });
    });

    renderHook(() => useForegroundUserLocation({ enabled: true, shouldPersist: true }));

    await act(async () => {
      await flushPromises();
    });
    await act(async () => {
      watchCallback?.(watchedLocation);
      await flushPromises();
    });

    expect(mockRecordLocations).toHaveBeenCalledWith([watchedLocation]);
  });

  test('連続した位置更新の保存を直列実行する', async () => {
    let resolveFirst: (() => void) | null = null;
    mockRecordLocations
      .mockImplementationOnce(
        () =>
          new Promise<void>((resolve) => {
            resolveFirst = resolve;
          }),
      )
      .mockResolvedValueOnce(undefined);
    let watchCallback: ((location: LocationObject) => void) | null = null;
    mockWatchPositionAsync.mockImplementation((_options: unknown, callback: (location: LocationObject) => void) => {
      watchCallback = callback;
      return Promise.resolve({ remove: mockRemove });
    });

    renderHook(() => useForegroundUserLocation({ enabled: true, shouldPersist: true }));

    await act(async () => {
      await flushPromises();
    });
    await act(async () => {
      watchCallback?.(watchedLocation);
      watchCallback?.({ ...watchedLocation, timestamp: 2 });
      await flushPromises();
    });

    expect(mockRecordLocations).toHaveBeenCalledTimes(1);

    await act(async () => {
      resolveFirst?.();
      await flushPromises();
    });

    expect(mockRecordLocations).toHaveBeenCalledTimes(2);
  });

  test('保存失敗後はエラーを通知し、次の更新でセッションを再作成する', async () => {
    const onError = jest.fn();
    const firstRecord = jest.fn().mockRejectedValue(new Error('save failed'));
    const secondRecord = jest.fn().mockResolvedValue(undefined);
    mockCreateLocationRecordingSession
      .mockResolvedValueOnce({ recordLocations: firstRecord })
      .mockResolvedValueOnce({ recordLocations: secondRecord });
    let watchCallback: ((location: LocationObject) => void) | null = null;
    mockWatchPositionAsync.mockImplementation((_options: unknown, callback: (location: LocationObject) => void) => {
      watchCallback = callback;
      return Promise.resolve({ remove: mockRemove });
    });

    renderHook(() => useForegroundUserLocation({ enabled: true, shouldPersist: true, onError }));

    await act(async () => {
      await flushPromises();
    });
    await act(async () => {
      watchCallback?.(watchedLocation);
      await flushPromises();
      watchCallback?.({ ...watchedLocation, timestamp: 2 });
      await flushPromises();
    });

    expect(onError).toHaveBeenCalledWith(expect.objectContaining({ message: 'save failed' }));
    expect(mockCreateLocationRecordingSession).toHaveBeenCalledTimes(2);
    expect(secondRecord).toHaveBeenCalledTimes(1);
  });

  test('権限が無い場合はウォッチを開始しない', async () => {
    mockEnsureForegroundLocationPermission.mockResolvedValue(false);

    renderHook(() => useForegroundUserLocation({ enabled: true, shouldPersist: false }));

    await act(async () => {
      await flushPromises();
    });

    expect(mockWatchPositionAsync).not.toHaveBeenCalled();
  });

  test('無効化時とアンマウント時にウォッチを解除する', async () => {
    const { rerender, unmount } = renderHook(
      ({ enabled }: { enabled: boolean }) => useForegroundUserLocation({ enabled, shouldPersist: false }),
      {
        initialProps: { enabled: true },
      },
    );

    await act(async () => {
      await flushPromises();
    });

    await act(async () => {
      rerender({ enabled: false });
      await flushPromises();
    });

    expect(mockRemove).toHaveBeenCalledTimes(1);

    await act(async () => {
      rerender({ enabled: true });
      await flushPromises();
    });

    await act(async () => {
      unmount();
      await flushPromises();
    });

    expect(mockRemove).toHaveBeenCalledTimes(2);
  });
});
