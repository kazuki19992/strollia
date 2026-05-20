import { Text } from 'react-native';

import { NUMERIC_DISPLAY_FONT } from '../../../../theme/fonts';
import { MonthlyReport } from '../../../../features/reports/monthlyReport';
import { formatOdometerKilometers, getNextDistanceMilestoneKilometers, MonthlyDistanceReportPage } from '../MonthlyDistanceReportPage';

jest.mock('@expo/vector-icons', () => {
  const { Text } = require('react-native');
  return { Feather: Text };
});

const ReactTestRenderer = require('react-test-renderer');
const { act } = ReactTestRenderer;

const report: MonthlyReport = {
  month: { year: 2026, month: 4 },
  label: '2026-04',
  totalDistanceMeters: 123450,
  routePoints: [],
  activeDays: 3,
};

describe('月間総移動距離レポート MonthlyDistanceReportPage', () => {
  let renderer: { unmount: () => void; root: any } | null = null;

  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-05-12T00:00:00.000Z'));
  });

  afterEach(() => {
    act(() => {
      renderer?.unmount();
    });
    renderer = null;
    jest.useRealTimers();
  });

  it('距離表示を桁幅固定で整形する', () => {
    expect(formatOdometerKilometers(12.3)).toBe('  12.30');
  });

  it('次の距離節目を返す', () => {
    expect(getNextDistanceMilestoneKilometers(123.45)).toBe(150);
  });

  it('カウントアップ後にDSEGフォントで距離を表示する', () => {
    act(() => {
      renderer = ReactTestRenderer.create(<MonthlyDistanceReportPage report={report} pageCount={4} pageIndex={0} onShare={jest.fn()} />);
    });

    act(() => {
      jest.advanceTimersByTime(1500);
    });

    const distanceText = renderer!.root.findAllByType(Text).find((node: any) => node.props.children === ' 123.45');

    expect(distanceText?.props.style.fontFamily).toBe(NUMERIC_DISPLAY_FONT);
  });
});
