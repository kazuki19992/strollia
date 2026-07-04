import { Text } from 'react-native';

import type { AchievementListItem } from '@/features/achievements/achievementRepository';
import { createStyles } from '@/app/appStyles';
import { lightTheme } from '@/theme/theme';
import { AchievementDialog } from '@/app/components/AchievementDialog';

jest.mock('@expo/vector-icons', () => {
  const { Text } = require('react-native');
  return { Feather: Text, MaterialCommunityIcons: Text };
});

jest.mock('@/app/components/ConfettiOverlay', () => ({ ConfettiOverlay: () => null }));

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

const { act, create } = require('react-test-renderer') as {
  act: (callback: () => void | Promise<void>) => Promise<void>;
  create: (element: React.ReactElement) => { root: any; unmount: () => void };
};

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
    let renderer: any;
    await act(async () => {
      renderer = create(<AchievementDialog item={item} styles={styles} theme={lightTheme} onClose={jest.fn()} />);
    });

    const texts = renderer.root.findAllByType(Text).map((node: any) => node.props.children);
    expect(texts).toContain('7日記録');
    expect(texts).toContain('GPSログを7日分記録する');
    expect(texts).toContain(`開放日: ${new Date(item.unlockedAt as string).toLocaleDateString()}`);
  });

  test('共有ボタンを押すと captureRef と shareAsync を呼ぶ', async () => {
    let renderer: any;
    await act(async () => {
      renderer = create(<AchievementDialog item={item} styles={styles} theme={lightTheme} onClose={jest.fn()} />);
    });

    const shareButton = renderer.root.findByProps({ accessibilityLabel: '実績を共有する' });
    await act(async () => {
      await shareButton.props.onPress();
    });

    expect(mockCaptureRef).toHaveBeenCalled();
    expect(mockShareAsync).toHaveBeenCalled();
  });

  test('item が null のとき本文を描画しない', async () => {
    let renderer: any;
    await act(async () => {
      renderer = create(<AchievementDialog item={null} styles={styles} theme={lightTheme} onClose={jest.fn()} />);
    });

    const texts = renderer.root.findAllByType(Text).map((node: any) => node.props.children);
    expect(texts).not.toContain('7日記録');
  });
});
