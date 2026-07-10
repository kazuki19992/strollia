import { render, screen, fireEvent, act } from '@testing-library/react-native';

import type { AchievementListItem } from '@/features/achievements/achievementRepository';
import { createStyles } from '@/ui/appStyles';
import { lightTheme } from '@/theme/theme';
import { AchievementDialog } from '@/ui/components/AchievementDialog';

jest.mock('@expo/vector-icons', () => {
  const { Text } = require('react-native');
  return { Feather: Text, MaterialCommunityIcons: Text };
});

jest.mock('@/ui/components/ConfettiOverlay', () => ({ ConfettiOverlay: () => null }));

const mockShareAsync = jest.fn().mockResolvedValue(undefined);
const mockIsAvailableAsync = jest.fn().mockResolvedValue(true);
jest.mock('expo-sharing', () => ({
  isAvailableAsync: (...args: unknown[]) => mockIsAvailableAsync(...args),
  shareAsync: (...args: unknown[]) => mockShareAsync(...args),
}));

const mockCaptureRef = jest.fn().mockResolvedValue('file:///tmp/a.png');
jest.mock('react-native-view-shot', () => ({
  captureRef: (...args: unknown[]) => mockCaptureRef(...args),
}));

const styles = createStyles(lightTheme);

const item: AchievementListItem = {
  definition: {
    id: 'log-days-7',
    title: '7日記録',
    description: 'GPSログを7日分記録する',
    category: 'logDays',
    condition: { type: 'logDays', threshold: 7 },
    trophyImage: 1,
    trophyImageUri: null,
    shareText: '共有文言',
    sortOrder: 3001,
    enabled: true,
  },
  unlockedAt: '2026-05-08T00:00:00.000Z',
  progressValue: 7,
};

describe('実績詳細ダイアログ AchievementDialog', () => {
  test('実績名・開放日・説明を表示する', async () => {
    render(<AchievementDialog item={item} styles={styles} theme={lightTheme} onClose={jest.fn()} />);

    await act(async () => {
      await Promise.resolve();
    });

    expect(screen.getByText('7日記録')).toBeTruthy();
    expect(screen.getByText('GPSログを7日分記録する')).toBeTruthy();
    expect(screen.getByText(`開放日: ${new Date(item.unlockedAt as string).toLocaleDateString()}`)).toBeTruthy();
  });

  test('共有ボタンを押すと captureRef と shareAsync を呼ぶ', async () => {
    render(<AchievementDialog item={item} styles={styles} theme={lightTheme} onClose={jest.fn()} />);

    await act(async () => {
      await Promise.resolve();
    });

    await act(async () => {
      fireEvent.press(screen.getByLabelText('実績を共有する'));
    });

    expect(mockCaptureRef).toHaveBeenCalled();
    expect(mockShareAsync).toHaveBeenCalled();
  });

  test('item が null のとき本文を描画しない', async () => {
    render(<AchievementDialog item={null} styles={styles} theme={lightTheme} onClose={jest.fn()} />);

    await act(async () => {
      await Promise.resolve();
    });

    expect(screen.queryByText('7日記録')).toBeNull();
  });
});
