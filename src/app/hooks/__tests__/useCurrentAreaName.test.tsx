import { useEffect } from 'react';
import * as Location from 'expo-location';

import { useCurrentAreaLabel, useCurrentAreaName } from '../useCurrentAreaName';

const ReactTestRenderer = require('react-test-renderer');
const { act } = ReactTestRenderer;

jest.mock('expo-location', () => ({
  reverseGeocodeAsync: jest.fn(),
}));

const TEST_COORDINATE = { latitude: 35, longitude: 139 };

type HookProbeProps = {
  onAreaName: (name: string) => void;
  appState?: 'active' | 'background';
  userCoordinate?: typeof TEST_COORDINATE | null;
};

type LabelHookProbeProps = {
  onAreaLabel: (label: { primary: string; secondary: string | null }) => void;
  appState?: 'active' | 'background';
  userCoordinate?: typeof TEST_COORDINATE | null;
};

/** hookの地域ラベルをテストへ渡すための最小コンポーネント。 */
function LabelHookProbe({ appState = 'active', onAreaLabel, userCoordinate = TEST_COORDINATE }: LabelHookProbeProps) {
  const areaLabel = useCurrentAreaLabel({ userCoordinate, appState });

  useEffect(() => {
    onAreaLabel(areaLabel);
  }, [areaLabel, onAreaLabel]);

  return null;
}

/** hookの地域名をテストへ渡すための最小コンポーネント。 */
function HookProbe({ appState = 'active', onAreaName, userCoordinate = TEST_COORDINATE }: HookProbeProps) {
  const areaName = useCurrentAreaName({ userCoordinate, appState });

  useEffect(() => {
    onAreaName(areaName);
  }, [areaName, onAreaName]);

  return null;
}

describe('現在地地域名hook useCurrentAreaName', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('逆ジオコーディング結果から下部ダッシュボード用の地域名を返す', async () => {
    const labels: Array<{ primary: string; secondary: string | null }> = [];
    (Location.reverseGeocodeAsync as jest.Mock).mockResolvedValue([{ city: '千代田区', district: '神田' }]);

    act(() => {
      ReactTestRenderer.create(<LabelHookProbe onAreaLabel={(label) => labels.push(label)} />);
    });
    await act(async () => {
      await Promise.resolve();
    });

    expect(labels).toContainEqual({ primary: '千代田区', secondary: '神田' });
  });

  test('逆ジオコーディング結果から市区町村名を返す', async () => {
    const names: string[] = [];
    (Location.reverseGeocodeAsync as jest.Mock).mockResolvedValue([{ city: '渋谷区' }]);

    act(() => {
      ReactTestRenderer.create(<HookProbe onAreaName={(name) => names.push(name)} />);
    });
    await act(async () => {
      await Promise.resolve();
    });

    expect(Location.reverseGeocodeAsync).toHaveBeenCalledWith({ latitude: 35, longitude: 139 });
    expect(names).toContain('渋谷区');
  });

  test('起動直後に地域ラベル取得に失敗した場合は取得中…を表示する', async () => {
    const labels: Array<{ primary: string; secondary: string | null }> = [];
    (Location.reverseGeocodeAsync as jest.Mock).mockRejectedValue(new Error('reverse geocode failed'));

    act(() => {
      ReactTestRenderer.create(<LabelHookProbe onAreaLabel={(label) => labels.push(label)} />);
    });
    await act(async () => {
      await Promise.resolve();
    });

    expect(labels).toContainEqual({ primary: '取得中…', secondary: null });
  });

  test('成功後に地域ラベル取得に失敗した場合は直前の地名を継続表示する', async () => {
    const labels: Array<{ primary: string; secondary: string | null }> = [];
    (Location.reverseGeocodeAsync as jest.Mock)
      .mockResolvedValueOnce([{ city: '千代田区', district: '神田' }])
      .mockRejectedValueOnce(new Error('reverse geocode failed'));

    let renderer: ReturnType<typeof ReactTestRenderer.create>;
    const onAreaLabel = (label: { primary: string; secondary: string | null }) => labels.push(label);

    act(() => {
      renderer = ReactTestRenderer.create(
        <LabelHookProbe onAreaLabel={onAreaLabel} userCoordinate={{ latitude: 35, longitude: 139 }} />,
      );
    });
    await act(async () => {
      await Promise.resolve();
    });

    act(() => {
      renderer.update(
        <LabelHookProbe onAreaLabel={onAreaLabel} userCoordinate={{ latitude: 36, longitude: 140 }} />,
      );
    });
    await act(async () => {
      await Promise.resolve();
    });

    expect(labels).toContainEqual({ primary: '千代田区', secondary: '神田' });
    const lastLabel = labels[labels.length - 1];
    expect(lastLabel).toEqual({ primary: '千代田区', secondary: '神田' });
  });

  test('アプリが非アクティブなら地域ラベルの逆ジオコーディングを呼ばない', () => {
    const labels: Array<{ primary: string; secondary: string | null }> = [];

    act(() => {
      ReactTestRenderer.create(<LabelHookProbe appState="background" onAreaLabel={(label) => labels.push(label)} />);
    });

    expect(Location.reverseGeocodeAsync).not.toHaveBeenCalled();
    expect(labels).toContainEqual({ primary: '現在地を確認中', secondary: null });
  });

  test('現在地座標がなければ地域名の逆ジオコーディングを呼ばない', () => {
    const names: string[] = [];

    act(() => {
      ReactTestRenderer.create(<HookProbe onAreaName={(name) => names.push(name)} userCoordinate={null} />);
    });

    expect(Location.reverseGeocodeAsync).not.toHaveBeenCalled();
    expect(names).toContain('現在地を確認中');
  });
});
