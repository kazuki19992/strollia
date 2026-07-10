import { render, screen } from '@testing-library/react-native';

import { MonthlyReport } from '@/features/reports/monthlyReport';
import { MonthlyMapReportPage } from '@/ui/components/reports/MonthlyMapReportPage';

jest.mock('@expo/vector-icons', () => {
  const { Text } = require('react-native');
  return { Feather: Text };
});

const report: MonthlyReport = {
  month: { year: 2026, month: 4 },
  label: '2026-04',
  totalDistanceMeters: 0,
  routePoints: [],
  activeDays: 0,
};

describe('月間移動マップページ MonthlyMapReportPage', () => {
  it('背景グリッドとルート装飾を表示する', () => {
    render(<MonthlyMapReportPage report={report} pageCount={4} pageIndex={1} onShare={jest.fn()} />);

    // UNSAFE_getAllByProps を使うのは testID という非セマンティックな props で要素を検索するため
    expect(screen.UNSAFE_getAllByProps({ testID: 'monthly-map-background' }).length).toBeGreaterThan(0);
    expect(screen.UNSAFE_getAllByProps({ testID: 'monthly-map-grid-line' }).length).toBeGreaterThanOrEqual(12);
    expect(screen.UNSAFE_getAllByProps({ testID: 'monthly-map-route-halo' }).length).toBeGreaterThan(0);
    expect(screen.UNSAFE_getAllByProps({ testID: 'monthly-map-route' }).length).toBeGreaterThan(0);
    expect(screen.UNSAFE_getAllByProps({ testID: 'monthly-map-overlay' }).length).toBeGreaterThan(0);
  });
});
