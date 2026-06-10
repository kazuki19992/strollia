const { act, create } = require('react-test-renderer') as {
  act: (callback: () => void | Promise<void>) => Promise<void>;
  create: (element: React.ReactElement) => { unmount: () => void };
};

const mockEnsureForegroundLocationPermission = jest.fn();
const mockWatchPositionAsync = jest.fn();
const mockGetLastKnownPositionAsync = jest.fn();
const mockRemove = jest.fn();

jest.mock('../../../features/location/locationService', () => ({
  ensureForegroundLocationPermission: (...args: unknown[]) => mockEnsureForegroundLocationPermission(...args),
}));

jest.mock('expo-location', () => ({
  Accuracy: { Balanced: 3 },
  watchPositionAsync: (...args: unknown[]) => mockWatchPositionAsync(...args),
  getLastKnownPositionAsync: (...args: unknown[]) => mockGetLastKnownPositionAsync(...args),
}));

import { useForegroundUserLocation } from '../useForegroundUserLocation';

function flushPromises(): Promise<void> {
  return new Promise((resolve) => setImmediate(resolve));
}

function Harness({ enabled, onLocation }: { enabled: boolean; onLocation: (lat: number, lng: number, speed: number | null) => void }) {
  useForegroundUserLocation(enabled, onLocation);
  return null;
}

describe('前景位置ウォッチ useForegroundUserLocation', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockEnsureForegroundLocationPermission.mockResolvedValue(true);
    mockGetLastKnownPositionAsync.mockResolvedValue(null);
    mockWatchPositionAsync.mockResolvedValue({ remove: mockRemove });
  });

  test('enabled=falseのときウォッチを開始しない', async () => {
    await act(async () => {
      create(<Harness enabled={false} onLocation={jest.fn()} />);
      await flushPromises();
    });

    expect(mockWatchPositionAsync).not.toHaveBeenCalled();
  });

  test('enabled=trueのとき権限確認後にウォッチを開始する', async () => {
    await act(async () => {
      create(<Harness enabled onLocation={jest.fn()} />);
      await flushPromises();
    });

    expect(mockEnsureForegroundLocationPermission).toHaveBeenCalledTimes(1);
    expect(mockWatchPositionAsync).toHaveBeenCalledTimes(1);
  });

  test('位置更新を緯度経度と速度のコールバックへ流す', async () => {
    const onLocation = jest.fn();
    let watchCallback: ((location: unknown) => void) | null = null;
    mockWatchPositionAsync.mockImplementation((_options: unknown, callback: (location: unknown) => void) => {
      watchCallback = callback;
      return Promise.resolve({ remove: mockRemove });
    });

    await act(async () => {
      create(<Harness enabled onLocation={onLocation} />);
      await flushPromises();
    });

    act(() => {
      watchCallback?.({ coords: { latitude: 35, longitude: 139, speed: 2.5 } });
    });

    expect(onLocation).toHaveBeenCalledWith(35, 139, 2.5);
  });

  test('権限が無い場合はウォッチを開始しない', async () => {
    mockEnsureForegroundLocationPermission.mockResolvedValue(false);

    await act(async () => {
      create(<Harness enabled onLocation={jest.fn()} />);
      await flushPromises();
    });

    expect(mockWatchPositionAsync).not.toHaveBeenCalled();
  });

  test('アンマウント時にウォッチを解除する', async () => {
    let renderer: any;
    await act(async () => {
      renderer = create(<Harness enabled onLocation={jest.fn()} />);
      await flushPromises();
    });

    await act(async () => {
      renderer.unmount();
      await flushPromises();
    });

    expect(mockRemove).toHaveBeenCalledTimes(1);
  });
});
