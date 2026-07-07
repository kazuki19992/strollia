import { Animated, Text } from 'react-native';

import { NewRecordPill } from '@/ui/components/reports/NewRecordPill';

const ReactTestRenderer = require('react-test-renderer');
const { act } = ReactTestRenderer;

describe('新記録ピル NewRecordPill', () => {
  let loopAnimation: { start: jest.Mock; stop: jest.Mock };

  beforeEach(() => {
    loopAnimation = { start: jest.fn(), stop: jest.fn() };
    jest.spyOn(Animated, 'timing').mockReturnValue({ start: jest.fn(), stop: jest.fn() } as never);
    jest.spyOn(Animated, 'loop').mockReturnValue(loopAnimation as never);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('visible=falseの場合は何も表示せずアニメーションを開始しない', () => {
    let renderer: any;

    act(() => {
      renderer = ReactTestRenderer.create(<NewRecordPill visible={false} />);
    });

    expect(renderer.root.findAllByType(Text)).toHaveLength(0);
    expect(loopAnimation.start).not.toHaveBeenCalled();
  });

  it('visible=trueの場合は表示してアニメーションを開始し、アンマウント時に停止する', () => {
    let renderer: any;

    act(() => {
      renderer = ReactTestRenderer.create(<NewRecordPill visible />);
    });

    expect(renderer.root.findByType(Text).props.children).toBe('NEW RECORD!!');
    expect(loopAnimation.start).toHaveBeenCalledTimes(1);

    act(() => renderer.unmount());

    expect(loopAnimation.stop).toHaveBeenCalledTimes(1);
  });
});
