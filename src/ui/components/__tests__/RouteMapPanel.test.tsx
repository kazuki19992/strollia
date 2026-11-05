import { render, screen } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';

import { getAppTheme } from '@/theme/theme';
import type { LocationPoint } from '@/types/gps';
import { createStyles } from '@/ui/appStyles';
import { RouteMapPanel } from '@/ui/components/RouteMapPanel';

jest.mock('react-native-maps', () => {
  const { View } = require('react-native');
  return { __esModule: true, default: View, Marker: View, Polygon: View, Polyline: View };
});

const theme = getAppTheme('light');
const styles = createStyles(theme);

/** テスト用のGPSポイントを作る。 */
function createPoint(id: number, latitude: number, longitude: number): LocationPoint {
  return {
    id,
    recordedAt: new Date(1_700_000_000_000 + id * 1000).toISOString(),
    localDate: '2026-11-05',
    latitude,
    longitude,
    altitude: null,
    speed: null,
    heading: null,
    accuracy: 5,
    altitudeAccuracy: null,
  };
}

const points = [createPoint(1, 35.0, 139.0), createPoint(2, 35.001, 139.001)];

describe('移動地図パネル RouteMapPanel', () => {
  test('fillHeightを指定しない場合は従来どおり高さ332で描く', async () => {
    await render(<RouteMapPanel emptyLabel="なし" points={points} styles={styles} theme={theme} />);

    expect(StyleSheet.flatten(screen.getByTestId('route-map-frame').props.style).height).toBe(332);
  });

  test('fillHeightを指定すると地図枠が親の高さいっぱいに広がる', async () => {
    await render(<RouteMapPanel fillHeight emptyLabel="なし" points={points} styles={styles} theme={theme} />);

    const style = StyleSheet.flatten(screen.getByTestId('route-map-frame').props.style);
    expect(style.flex).toBe(1);
    expect(style.height).not.toBe(332);
  });

  test('ルートが無い場合もfillHeightで空表示が高さいっぱいに広がる', async () => {
    await render(<RouteMapPanel fillHeight emptyLabel="なし" points={[]} regionPoints={[]} styles={styles} theme={theme} />);

    const style = StyleSheet.flatten(screen.getByTestId('route-map-empty').props.style);
    expect(style.flex).toBe(1);
    expect(style.height).not.toBe(332);
  });
});
