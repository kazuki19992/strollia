import { Text } from 'react-native';

import { AchievementListItem } from '@/features/achievements/achievementRepository';
import { MonthlyReport } from '@/features/reports/monthlyReport';
import { AchievementHighlightReportPage } from '@/app/components/reports/AchievementHighlightReportPage';

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

/** 実績ハイライトテスト用の最小実績項目を作る。 */
function achievement(id: string, title: string, unlockedAt: string | null): AchievementListItem {
  return {
    unlockedAt,
    progressValue: 1,
    definition: {
      id,
      title,
      description: title,
      category: 'distance',
      condition: { type: 'totalDistanceMeters', threshold: 1000 },
      trophyImage: 1,
      trophyImageUri: null,
      shareText: title,
      sortOrder: 1,
      enabled: true,
    },
  };
}

describe('実績ハイライトレポート AchievementHighlightReportPage', () => {
  it('対象月の実績がない場合は空状態を表示する', () => {
    let renderer: any;

    act(() => {
      renderer = ReactTestRenderer.create(
        <AchievementHighlightReportPage
          report={report}
          achievements={[achievement('a', '3月実績', '2026-03-01T00:00:00.000Z')]}
          pageCount={4}
          pageIndex={0}
          onShare={jest.fn()}
        />,
      );
    });

    expect(renderer.root.findAllByType(Text).map((node: any) => node.props.children)).toContain('今月はまだ実績達成なし');
  });

  it('対象月の実績は先頭3件だけ表示する', () => {
    let renderer: any;

    act(() => {
      renderer = ReactTestRenderer.create(
        <AchievementHighlightReportPage
          report={report}
          achievements={[
            achievement('a', '100km移動した', '2026-04-01T00:00:00.000Z'),
            achievement('b', '200km移動した', '2026-04-02T00:00:00.000Z'),
            achievement('c', '300km移動した', '2026-04-03T00:00:00.000Z'),
            achievement('d', '400km移動した', '2026-04-04T00:00:00.000Z'),
          ]}
          pageCount={4}
          pageIndex={0}
          onShare={jest.fn()}
        />,
      );
    });

    const texts = renderer.root.findAllByType(Text).map((node: any) => node.props.children);
    expect(texts).toContain('100km移動した');
    expect(texts).toContain('200km移動した');
    expect(texts).toContain('300km移動した');
    expect(texts).not.toContain('400km移動した');
  });
});
