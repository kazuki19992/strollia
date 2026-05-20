import { Text } from 'react-native';

import { MonthlyReport } from '../../../../features/reports/monthlyReport';
import { PrefectureRankingReportPage } from '../PrefectureRankingReportPage';

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

describe('都道府県ランキングレポート PrefectureRankingReportPage', () => {
  it('渡されたランキングデータを表示する', () => {
    let renderer: any;

    act(() => {
      renderer = ReactTestRenderer.create(
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
    });

    const text = JSON.stringify(renderer.root.findAllByType(Text).map((node: any) => node.props.children));
    expect(text).toContain('東京都');
    expect(text).toContain('42');
    expect(text).toContain('pt');
    expect(text).toContain('広島県');
    expect(text).not.toContain('福島県');
  });
});
