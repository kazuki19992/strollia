import { useEffect } from 'react';
import * as Location from 'expo-location';

import { useCurrentAreaName } from '../useCurrentAreaName';

const ReactTestRenderer = require('react-test-renderer');
const { act } = ReactTestRenderer;

jest.mock('expo-location', () => ({
  reverseGeocodeAsync: jest.fn(),
}));

type HookProbeProps = {
  onAreaName: (name: string) => void;
};

/** hookの地域名をテストへ渡すための最小コンポーネント。 */
function HookProbe({ onAreaName }: HookProbeProps) {
  const areaName = useCurrentAreaName({ userCoordinate: { latitude: 35, longitude: 139 }, appState: 'active' });

  useEffect(() => {
    onAreaName(areaName);
  }, [areaName, onAreaName]);

  return null;
}

describe('現在地地域名hook useCurrentAreaName', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('逆ジオコーディング結果から市区町村名を返す', async () => {
    const names: string[] = [];
    (Location.reverseGeocodeAsync as jest.Mock).mockResolvedValue([{ city: '渋谷区' }]);

    await act(async () => {
      ReactTestRenderer.create(<HookProbe onAreaName={(name) => names.push(name)} />);
    });

    expect(Location.reverseGeocodeAsync).toHaveBeenCalledWith({ latitude: 35, longitude: 139 });
    expect(names).toContain('渋谷区');
  });
});
