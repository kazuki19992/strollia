import { SafeAreaView } from 'react-native';
import { render, screen, fireEvent, act } from '@testing-library/react-native';

import type { AchievementListItem } from '@/features/achievements/achievementRepository';
import { createStyles } from '@/ui/appStyles';
import { lightTheme } from '@/theme/theme';
import { AchievementListScreen } from '@/ui/components/AchievementListScreen';

jest.mock('@expo/vector-icons', () => ({
  MaterialCommunityIcons: () => null,
  Feather: require('react-native').Text,
}));

const styles = createStyles(lightTheme);

describe('実績画面 AchievementListScreen の画面共通UI', () => {
  beforeEach(() => {
    jest.spyOn(console, 'warn').mockImplementation(() => undefined);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  test('設定画面と同じ背景と共通ヘッダーで表示する', () => {
    render(<AchievementListScreen items={[]} styles={styles} theme={lightTheme} onBackToMap={jest.fn()} onSelectAchievement={jest.fn()} />);

    // SafeAreaView のスタイル確認
    // RTL では UNSAFE_getByType を使って SafeAreaView を取得する
    const container = screen.UNSAFE_getByType(SafeAreaView);
    const backButton = screen.getByLabelText('地図へ戻る');

    expect(container.props.style).toBe(styles.appScreen);
    expect(screen.getByText('実績')).toBeTruthy();
    expect(backButton.props.style).toBe(styles.appHeaderBackButton);
  });
});

/** テスト用の実績項目を作る。 */
function gridItem(id: string, sortOrder: number, unlockedAt: string | null): AchievementListItem {
  return {
    definition: {
      id,
      title: `${id}タイトル`,
      description: '説明',
      category: 'distance',
      condition: { type: 'totalDistanceMeters', threshold: 1000 },
      trophyImage: 1,
      trophyImageUri: null,
      shareText: '',
      sortOrder,
      enabled: true,
    },
    unlockedAt,
    progressValue: 500,
  };
}

describe('実績グリッドの3状態表示', () => {
  const items = [gridItem('d1', 1001, '2026-01-01T00:00:00.000Z'), gridItem('d2', 1002, null), gridItem('d3', 1003, null)];

  test('解除済みタップで onSelectAchievement を呼ぶ', () => {
    const onSelectAchievement = jest.fn();
    render(
      <AchievementListScreen
        items={items}
        styles={styles}
        theme={lightTheme}
        onBackToMap={jest.fn()}
        onSelectAchievement={onSelectAchievement}
      />,
    );

    act(() => {
      fireEvent.press(screen.getByLabelText('d1タイトル の詳細を見る'));
    });
    expect(onSelectAchievement).toHaveBeenCalledWith(items[0]);
  });

  test('それ以降の実績はタイトルと進捗を伏せ字にする', () => {
    render(
      <AchievementListScreen items={items} styles={styles} theme={lightTheme} onBackToMap={jest.fn()} onSelectAchievement={jest.fn()} />,
    );

    expect(screen.getAllByText('？？？').length).toBeGreaterThan(0);
  });

  test('次の実績はタイトルを表示し進捗ラベルを出す', () => {
    render(
      <AchievementListScreen items={items} styles={styles} theme={lightTheme} onBackToMap={jest.fn()} onSelectAchievement={jest.fn()} />,
    );

    expect(screen.getByText('d2タイトル')).toBeTruthy();
  });
});
