import { Animated } from 'react-native';
import { useAnimatedBooleanOpacity } from '@/ui/hooks/useAnimatedBooleanOpacity';

const ReactTestRenderer = require('react-test-renderer');
const { act } = ReactTestRenderer;

type HookProbeProps = {
  visible: boolean;
  durationMs: number;
  onValue: (value: Animated.Value) => void;
};

type MockAnimation = {
  start: jest.Mock;
  stop: jest.Mock;
};

type InspectableAnimatedValue = Animated.Value & {
  __getValue: () => number;
};

/** hookが返したAnimated.Valueをテストへ渡すための最小コンポーネント。 */
function HookProbe({ visible, durationMs, onValue }: HookProbeProps) {
  const opacity = useAnimatedBooleanOpacity(visible, durationMs);
  onValue(opacity);

  return null;
}

describe('真偽値フェードhook useAnimatedBooleanOpacity', () => {
  let animations: MockAnimation[];

  beforeEach(() => {
    animations = [];
    jest.spyOn(Animated, 'timing').mockImplementation((() => {
      const animation = {
        start: jest.fn(),
        stop: jest.fn(),
      };
      animations.push(animation);

      return animation;
    }) as never);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('visible=trueの場合は初期値1で開始する', () => {
    let opacity: Animated.Value;

    act(() => {
      ReactTestRenderer.create(<HookProbe visible durationMs={500} onValue={(value) => (opacity = value)} />);
    });

    expect((opacity! as InspectableAnimatedValue).__getValue()).toBe(1);
  });

  it('visible=falseの場合は初期値0で開始する', () => {
    let opacity: Animated.Value;

    act(() => {
      ReactTestRenderer.create(<HookProbe visible={false} durationMs={500} onValue={(value) => (opacity = value)} />);
    });

    expect((opacity! as InspectableAnimatedValue).__getValue()).toBe(0);
  });

  it('visibleとdurationMsに応じたフェードアニメーションを開始する', () => {
    let renderer: { update: (element: React.ReactElement) => void };

    act(() => {
      renderer = ReactTestRenderer.create(<HookProbe visible={false} durationMs={250} onValue={jest.fn()} />);
    });

    expect(Animated.timing).toHaveBeenLastCalledWith(expect.any(Animated.Value), {
      toValue: 0,
      duration: 250,
      useNativeDriver: true,
    });

    act(() => {
      renderer.update(<HookProbe visible durationMs={600} onValue={jest.fn()} />);
    });

    expect(Animated.timing).toHaveBeenLastCalledWith(expect.any(Animated.Value), {
      toValue: 1,
      duration: 600,
      useNativeDriver: true,
    });
  });

  it('visible変更時は前回アニメーションを停止してから次のアニメーションを開始する', () => {
    let renderer: { update: (element: React.ReactElement) => void };

    act(() => {
      renderer = ReactTestRenderer.create(<HookProbe visible={false} durationMs={250} onValue={jest.fn()} />);
    });
    const firstAnimation = animations[0];

    act(() => {
      renderer.update(<HookProbe visible durationMs={250} onValue={jest.fn()} />);
    });

    expect(firstAnimation.stop).toHaveBeenCalledTimes(1);
    expect(animations).toHaveLength(2);
    expect(animations[1].start).toHaveBeenCalledTimes(1);
  });
});
