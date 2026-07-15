import { render, screen } from '@testing-library/react-native';

import { AchievementListItem } from '@/features/achievements/achievementRepository';
import { MonthlyReport } from '@/features/reports/monthlyReport';
import { AchievementHighlightReportPage } from '@/ui/components/reports/AchievementHighlightReportPage';

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
    render(
      <AchievementHighlightReportPage
        report={report}
        achievements={[achievement('a', '3月実績', '2026-03-01T00:00:00.000Z')]}
        pageCount={4}
        pageIndex={0}
        onShare={jest.fn()}
      />,
    );

    expect(screen.getByText('今月はまだ実績達成なし')).toBeTruthy();
  });

  it('対象月の実績は先頭3件だけ表示する', () => {
    render(
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

    expect(screen.getByText('100km移動した')).toBeTruthy();
    expect(screen.getByText('200km移動した')).toBeTruthy();
    expect(screen.getByText('300km移動した')).toBeTruthy();
    expect(screen.queryByText('400km移動した')).toBeNull();
  });
});
