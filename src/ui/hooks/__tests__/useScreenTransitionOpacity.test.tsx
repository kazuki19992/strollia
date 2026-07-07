import { Animated } from 'react-native';
import { useScreenTransitionOpacity } from '@/ui/hooks/useScreenTransitionOpacity';

const ReactTestRenderer = require('react-test-renderer');
const { act } = ReactTestRenderer;

type HookProbeProps = {
  screenKey: string;
  durationMs: number;
  onValue: (value: Animated.Value) => void;
};

type InspectableAnimatedValue = Animated.Value & {
  __getValue: () => number;
};

/** hookが返した Animated.Value をテストへ渡すための最小コンポーネント。 */
function HookProbe({ screenKey, durationMs, onValue }: HookProbeProps) {
  const opacity = useScreenTransitionOpacity(screenKey, durationMs);
  onValue(opacity);
  return null;
}

describe('画面遷移フェードhook useScreenTransitionOpacity', () => {
  let timingMocks: Array<{ start: jest.Mock }>;

  beforeEach(() => {
    timingMocks = [];
    jest.spyOn(Animated, 'timing').mockImplementation((() => {
      const animation = { start: jest.fn(), stop: jest.fn() };
      timingMocks.push(animation);
      return animation;
    }) as never);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('Animated.Value のインスタンスを返す', () => {
    let opacity: Animated.Value | undefined;

    act(() => {
      ReactTestRenderer.create(<HookProbe screenKey="map" durationMs={300} onValue={(v) => (opacity = v)} />);
    });

    expect(opacity).toBeInstanceOf(Animated.Value);
  });

  it('マウント時に Animated.timing が呼ばれる', () => {
    act(() => {
      ReactTestRenderer.create(<HookProbe screenKey="map" durationMs={300} onValue={jest.fn()} />);
    });

    expect(Animated.timing).toHaveBeenCalledTimes(1);
    expect(Animated.timing).toHaveBeenCalledWith(expect.any(Animated.Value), expect.objectContaining({ toValue: 1, duration: 300 }));
  });

  it('screenKey が変わると Animated.timing が再度呼ばれる', () => {
    let renderer: ReturnType<typeof ReactTestRenderer.create>;

    act(() => {
      renderer = ReactTestRenderer.create(<HookProbe screenKey="map" durationMs={300} onValue={jest.fn()} />);
    });

    act(() => {
      renderer.update(<HookProbe screenKey="settings" durationMs={300} onValue={jest.fn()} />);
    });

    expect(Animated.timing).toHaveBeenCalledTimes(2);
  });

  it('screenKey と durationMs が同じ再レンダーでは追加のアニメーションが呼ばれない', () => {
    let renderer: ReturnType<typeof ReactTestRenderer.create>;

    act(() => {
      renderer = ReactTestRenderer.create(<HookProbe screenKey="map" durationMs={300} onValue={jest.fn()} />);
    });

    // effect の依存配列 [durationMs, opacity, screenKey] がすべて同じなら再実行されない
    act(() => {
      renderer.update(<HookProbe screenKey="map" durationMs={300} onValue={jest.fn()} />);
    });

    expect(Animated.timing).toHaveBeenCalledTimes(1);
  });

  it('durationMs が変わると Animated.timing が再度呼ばれる（依存配列に含まれるため）', () => {
    let renderer: ReturnType<typeof ReactTestRenderer.create>;

    act(() => {
      renderer = ReactTestRenderer.create(<HookProbe screenKey="map" durationMs={300} onValue={jest.fn()} />);
    });

    act(() => {
      renderer.update(<HookProbe screenKey="map" durationMs={500} onValue={jest.fn()} />);
    });

    expect(Animated.timing).toHaveBeenCalledTimes(2);
    expect(Animated.timing).toHaveBeenLastCalledWith(expect.any(Animated.Value), expect.objectContaining({ duration: 500 }));
  });

  it('toValue=1 へのアニメーションが指定される（フェードイン）', () => {
    act(() => {
      ReactTestRenderer.create(<HookProbe screenKey="map" durationMs={400} onValue={jest.fn()} />);
    });

    expect(Animated.timing).toHaveBeenCalledWith(expect.any(Animated.Value), expect.objectContaining({ toValue: 1 }));
  });

  it('start() が呼ばれる（アニメーション開始）', () => {
    act(() => {
      ReactTestRenderer.create(<HookProbe screenKey="map" durationMs={300} onValue={jest.fn()} />);
    });

    expect(timingMocks[0]!.start).toHaveBeenCalledTimes(1);
  });
});
