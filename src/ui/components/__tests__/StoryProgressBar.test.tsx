import { render, screen } from '@testing-library/react-native';
import { Animated, StyleSheet } from 'react-native';

import { StoryProgressBar } from '@/ui/components/StoryProgressBar';
import { createStyles } from '@/ui/appStyles';
import { lightTheme } from '@/theme/theme';

/** testID から幅スタイルを取り出す。 */
const widthOf = (id: string) => StyleSheet.flatten(screen.getByTestId(id).props.style).width;

describe('ストーリー進行バー StoryProgressBar', () => {
  test('現在より前のバーが満タン、後ろが空になる', async () => {
    await render(<StoryProgressBar pageCount={4} index={2} progress={new Animated.Value(0)} styles={createStyles(lightTheme)} />);

    expect(widthOf('story-progress-fill-0')).toBe('100%');
    expect(widthOf('story-progress-fill-1')).toBe('100%');
    expect(widthOf('story-progress-fill-3')).toBe('0%');
  });

  test('現在のバーは progress に追従する', async () => {
    await render(<StoryProgressBar pageCount={3} index={1} progress={new Animated.Value(0.5)} styles={createStyles(lightTheme)} />);

    // 現在のバー幅は progress(0.5) の補間結果になる。
    expect(widthOf('story-progress-fill-1')).toBe('50%');
    expect(screen.getByLabelText('2 / 3 ページ')).toBeTruthy();
  });
});
