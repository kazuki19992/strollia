import { MonthlyReport } from '../../../../features/reports/monthlyReport';
import { MonthlyMapReportPage } from '../MonthlyMapReportPage';

jest.mock('@expo/vector-icons', () => {
  const { Text } = require('react-native');
  return { Feather: Text };
});

const ReactTestRenderer = require('react-test-renderer');
const { act } = ReactTestRenderer;

const report: MonthlyReport = {
  month: { year: 2026, month: 4 },
  label: '2026-04',
  totalDistanceMeters: 0,
  routePoints: [],
  activeDays: 0,
};

describe('月間移動マップページ MonthlyMapReportPage', () => {
  it('背景グリッドとルート装飾を表示する', () => {
    let renderer: any;

    act(() => {
      renderer = ReactTestRenderer.create(<MonthlyMapReportPage report={report} pageCount={4} pageIndex={1} onShare={jest.fn()} />);
    });

    expect(renderer.root.findAll((node: any) => node.props.testID === 'monthly-map-background').length).toBeGreaterThan(0);
    expect(renderer.root.findAll((node: any) => node.props.testID === 'monthly-map-grid-line').length).toBeGreaterThanOrEqual(12);
    expect(renderer.root.findAll((node: any) => node.props.testID === 'monthly-map-route-halo').length).toBeGreaterThan(0);
    expect(renderer.root.findAll((node: any) => node.props.testID === 'monthly-map-route').length).toBeGreaterThan(0);
    expect(renderer.root.findAll((node: any) => node.props.testID === 'monthly-map-overlay').length).toBeGreaterThan(0);
  });
});
