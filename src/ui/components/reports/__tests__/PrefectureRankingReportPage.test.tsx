import { Text } from 'react-native';
import { render, screen } from '@testing-library/react-native';

import { MonthlyReport } from '@/features/reports/monthlyReport';
import { PrefectureRankingReportPage } from '@/ui/components/reports/PrefectureRankingReportPage';

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

describe('都道府県ランキングレポート PrefectureRankingReportPage', () => {
  it('渡されたランキングデータを表示する', () => {
    render(
      <PrefectureRankingReportPage
        report={report}
        pageCount={4}
        pageIndex={2}
        onShare={jest.fn()}
        ranking={[
          { rank: '1st', name: '東京都', count: 42 },
          { rank: '2nd', name: '広島県', count: 21 },
        ]}
      />,
    );

    // UNSAFE_getAllByType を使うのはすべての Text の children を JSON化して検証するため
    const text = JSON.stringify(screen.UNSAFE_getAllByType(Text).map((node) => node.props.children));
    expect(text).toContain('東京都');
    expect(text).toContain('42');
    expect(text).toContain('pt');
    expect(text).toContain('広島県');
    expect(text).not.toContain('福島県');
  });
});
