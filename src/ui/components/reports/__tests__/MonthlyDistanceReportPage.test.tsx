import { StyleSheet, Text } from 'react-native';
import { render, screen, act } from '@testing-library/react-native';

import { NUMERIC_DISPLAY_FONT } from '@/theme/fonts';
import { MonthlyReport } from '@/features/reports/monthlyReport';
import {
  formatOdometerKilometers,
  getNextDistanceMilestoneKilometers,
  MonthlyDistanceReportPage,
} from '@/ui/components/reports/MonthlyDistanceReportPage';

jest.mock('@expo/vector-icons', () => {
  const { Text } = require('react-native');
  return { Feather: Text };
});

const report: MonthlyReport = {
  month: { year: 2026, month: 4 },
  label: '2026-04',
  totalDistanceMeters: 123450,
  routePoints: [],
  activeDays: 3,
};

describe('月間総移動距離レポート MonthlyDistanceReportPage', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-05-12T00:00:00.000Z'));
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('距離表示を桁幅固定で整形する', () => {
    expect(formatOdometerKilometers(12.3)).toBe('  12.30');
  });

  it('次の距離節目を返す', () => {
    expect(getNextDistanceMilestoneKilometers(123.45)).toBe(150);
  });

  it('カウントアップ後にDSEGフォントで距離を表示する', () => {
    render(<MonthlyDistanceReportPage report={report} pageCount={4} pageIndex={0} onShare={jest.fn()} />);

    act(() => {
      jest.advanceTimersByTime(1500);
    });

    // UNSAFE_getAllByType を使うのは fontFamily という非セマンティックな props を検証するため
    const distanceText = screen.UNSAFE_getAllByType(Text).find((node) => node.props.children === ' 123.45');

    expect(distanceText?.props.style.fontFamily).toBe(NUMERIC_DISPLAY_FONT);
  });
});
