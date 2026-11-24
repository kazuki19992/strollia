import { act, render, screen } from '@testing-library/react-native';
import { Text } from 'react-native';

import { StoryTransitionView } from '@/ui/components/StoryTransitionView';

jest.mock('expo-blur', () => {
  const { View } = require('react-native');
  return { BlurView: View };
});

describe('ストーリー切替コンテナ StoryTransitionView', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  test('pageKeyが変わると新ページが即座に描画され、退場アニメ完了後に旧ページが消える', async () => {
    const { rerender } = await render(
      <StoryTransitionView pageKey="a">
        <Text>ページA</Text>
      </StoryTransitionView>,
    );
    expect(screen.queryByText('ページA')).toBeTruthy();

    await rerender(
      <StoryTransitionView pageKey="b">
        <Text>ページB</Text>
      </StoryTransitionView>,
    );
    expect(screen.queryByText('ページB')).toBeTruthy();
    expect(screen.queryByText('ページA')).toBeTruthy();

    await act(async () => {
      jest.advanceTimersByTime(1000);
    });

    expect(screen.queryByText('ページA')).toBeNull();
    expect(screen.queryByText('ページB')).toBeTruthy();
  });

  test('遷移中にアンマウントしても、時間経過後にエラーや警告が出ない', async () => {
    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => undefined);
    const { rerender, unmount } = await render(
      <StoryTransitionView pageKey="a">
        <Text>A</Text>
      </StoryTransitionView>,
    );
    await rerender(
      <StoryTransitionView pageKey="b">
        <Text>B</Text>
      </StoryTransitionView>,
    );

    await unmount();
    await act(async () => {
      jest.advanceTimersByTime(2000);
    });

    expect(errorSpy).not.toHaveBeenCalled();
    errorSpy.mockRestore();
  });

  test('遷移中にさらにpageKeyが変わっても最新ページだけが残る', async () => {
    const view = (key: string) => (
      <StoryTransitionView pageKey={key}>
        <Text>{`ページ${key}`}</Text>
      </StoryTransitionView>
    );
    const { rerender } = await render(view('a'));
    await rerender(view('b'));
    await act(async () => {
      jest.advanceTimersByTime(200);
    });
    await rerender(view('c'));
    await act(async () => {
      jest.advanceTimersByTime(1000);
    });

    expect(screen.queryByText('ページc')).toBeTruthy();
    expect(screen.queryByText('ページb')).toBeNull();
    expect(screen.queryByText('ページa')).toBeNull();
  });
});
