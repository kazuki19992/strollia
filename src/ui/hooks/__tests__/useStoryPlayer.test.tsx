import { act, renderHook } from '@testing-library/react-native';
import { Animated, AppState } from 'react-native';

import { STORY_PAGE_DURATION_MS, useStoryPlayer } from '@/ui/hooks/useStoryPlayer';

describe('ストーリー再生フック useStoryPlayer', () => {
  let appStateListener: ((state: string) => void) | undefined;

  beforeEach(() => {
    jest.useFakeTimers();
    appStateListener = undefined;
    jest.spyOn(AppState, 'addEventListener').mockImplementation(((_type: string, listener: (state: string) => void) => {
      appStateListener = listener;
      return { remove: jest.fn() };
    }) as never);
    Object.defineProperty(AppState, 'currentState', { configurable: true, value: 'active', writable: true });
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  /** 指定ミリ秒だけ時間を進める。 */
  const advance = async (ms: number) => {
    await act(async () => {
      jest.advanceTimersByTime(ms);
    });
  };

  test('7秒で次のページへ進む', async () => {
    const { result } = await renderHook(() => useStoryPlayer({ pageCount: 3 }));

    await advance(STORY_PAGE_DURATION_MS - 1);
    expect(result.current.index).toBe(0);
    await advance(1);

    expect(result.current.index).toBe(1);
    expect(result.current.direction).toBe('next');
  });

  test('最後のページでは進まない', async () => {
    const { result } = await renderHook(() => useStoryPlayer({ pageCount: 2 }));

    await advance(STORY_PAGE_DURATION_MS * 5);

    expect(result.current.index).toBe(1);
  });

  test('pause中は時間が経っても進まず、resumeで残りから再開する', async () => {
    const { result } = await renderHook(() => useStoryPlayer({ pageCount: 3 }));

    await advance(3000);
    await act(async () => result.current.pause());
    expect(result.current.isPaused).toBe(true);
    await advance(STORY_PAGE_DURATION_MS * 2);
    expect(result.current.index).toBe(0);

    await act(async () => result.current.resume());
    await advance(3999);
    expect(result.current.index).toBe(0);
    await advance(1);

    expect(result.current.index).toBe(1);
  });

  test('prevは0未満にならず、向きがprevになる', async () => {
    const { result } = await renderHook(() => useStoryPlayer({ pageCount: 3 }));

    await act(async () => result.current.prev());
    expect(result.current.index).toBe(0);

    await act(async () => result.current.next());
    await act(async () => result.current.prev());

    expect(result.current.index).toBe(0);
    expect(result.current.direction).toBe('prev');
  });

  test('手動で次へ進むと表示時間が7秒に戻る', async () => {
    const { result } = await renderHook(() => useStoryPlayer({ pageCount: 3 }));

    await advance(5000);
    await act(async () => result.current.next());
    await advance(STORY_PAGE_DURATION_MS - 1);
    expect(result.current.index).toBe(1);
    await advance(1);

    expect(result.current.index).toBe(2);
  });

  test('背面に回ると止まり、前面に戻ると再開する', async () => {
    const { result } = await renderHook(() => useStoryPlayer({ pageCount: 3 }));

    await act(async () => appStateListener?.('background'));
    expect(result.current.isPaused).toBe(true);
    await advance(STORY_PAGE_DURATION_MS * 2);
    expect(result.current.index).toBe(0);

    await act(async () => appStateListener?.('active'));
    expect(result.current.isPaused).toBe(false);
    await advance(STORY_PAGE_DURATION_MS);

    expect(result.current.index).toBe(1);
  });

  test('進行度はネイティブドライバで動かし、resume後は残り時間だけアニメーションする', async () => {
    // 進行バーは transform で伸ばし、React の再描画に値を上書きされないようネイティブドライバで動かす
    const timing = jest.spyOn(Animated, 'timing');
    const { result } = await renderHook(() => useStoryPlayer({ pageCount: 3, durationMs: 1000 }));

    expect(timing).toHaveBeenLastCalledWith(expect.anything(), expect.objectContaining({ duration: 1000, useNativeDriver: true }));

    await advance(400);
    await act(async () => result.current.pause());
    await advance(2000);
    await act(async () => result.current.resume());

    expect(timing).toHaveBeenLastCalledWith(expect.anything(), expect.objectContaining({ duration: 600, useNativeDriver: true }));
    await advance(600);
    expect(result.current.index).toBe(1);
  });

  test('ページが変わると進行度は0に戻り、最後のページでは1になる', async () => {
    const { result } = await renderHook(() => useStoryPlayer({ pageCount: 2, durationMs: 1000 }));
    const value = () => (result.current.progress as unknown as { __getValue(): number }).__getValue();

    await advance(1000);
    expect(result.current.index).toBe(1);
    expect(value()).toBe(1);

    await act(async () => result.current.prev());
    expect(value()).toBe(0);
  });

  test('アンマウント後は進行度が動かない（アニメーションとタイマーが止まる）', async () => {
    const { result, unmount } = await renderHook(() => useStoryPlayer({ pageCount: 3 }));
    const { progress } = result.current;
    await advance(1000);
    const valueAtUnmount = (progress as unknown as { __getValue(): number }).__getValue();

    await unmount();
    // RTL自身がテスト環境用のタイマーを残すため getTimerCount では判定せず、時間経過後の進行度で止まったことを確認する。
    await advance(STORY_PAGE_DURATION_MS * 2);

    expect((progress as unknown as { __getValue(): number }).__getValue()).toBe(valueAtUnmount);
  });
});
