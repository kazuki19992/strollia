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
};

type LabelHookProbeProps = {
  onAreaLabel: (label: { primary: string; secondary: string | null }) => void;
};

/** hookの地域ラベルをテストへ渡すための最小コンポーネント。 */
function LabelHookProbe({ onAreaLabel }: LabelHookProbeProps) {
  const areaLabel = useCurrentAreaLabel({ userCoordinate: TEST_COORDINATE, appState: 'active' });

  useEffect(() => {
    onAreaLabel(areaLabel);
  }, [areaLabel, onAreaLabel]);

  return null;
}

/** hookの地域名をテストへ渡すための最小コンポーネント。 */
function HookProbe({ onAreaName }: HookProbeProps) {
  const areaName = useCurrentAreaName({ userCoordinate: TEST_COORDINATE, appState: 'active' });

  useEffect(() => {
    onAreaName(areaName);
  }, [areaName, onAreaName]);

  return null;
}

describe('現在地地域名hook useCurrentAreaName', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('逆ジオコーディング結果から上部パネル用の地域名を返す', async () => {
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
});
