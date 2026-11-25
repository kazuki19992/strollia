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

  test('ページが進むと、見終わったバーは満タンに、新しい現在のバーは progress に追従する', async () => {
    const progress = new Animated.Value(0.5);
    const styles = createStyles(lightTheme);
    const { rerender } = await render(<StoryProgressBar pageCount={4} index={1} progress={progress} styles={styles} />);
    const before = screen.getByTestId('story-progress-fill-1');

    await rerender(<StoryProgressBar pageCount={4} index={2} progress={progress} styles={styles} />);

    expect(widthOf('story-progress-fill-1')).toBe('100%');
    expect(widthOf('story-progress-fill-2')).toBe('50%');
    expect(widthOf('story-progress-fill-3')).toBe('0%');
    // 連打で静的な幅とアニメーションの幅が切り替わるとネイティブ側に途中の幅が残るため、
    // バーは作り直さず常に同じアニメーション値に追従させる
    expect(screen.getByTestId('story-progress-fill-1')).toBe(before);
  });

  test('ページを戻すと、戻った先より後ろのバーは空になる', async () => {
    const progress = new Animated.Value(0);
    const styles = createStyles(lightTheme);
    const { rerender } = await render(<StoryProgressBar pageCount={4} index={3} progress={progress} styles={styles} />);

    await rerender(<StoryProgressBar pageCount={4} index={1} progress={progress} styles={styles} />);

    expect(widthOf('story-progress-fill-0')).toBe('100%');
    expect(widthOf('story-progress-fill-1')).toBe('0%');
    expect(widthOf('story-progress-fill-2')).toBe('0%');
  });
});
