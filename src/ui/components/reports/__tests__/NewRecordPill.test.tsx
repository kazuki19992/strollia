import { Animated, Text } from 'react-native';
import { render, screen, act } from '@testing-library/react-native';

import { NewRecordPill } from '@/ui/components/reports/NewRecordPill';

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
    render(<NewRecordPill visible={false} />);

    // UNSAFE_queryAllByType を使うのは Text という型で要素が0件であることを確認するため
    expect(screen.UNSAFE_queryAllByType(Text)).toHaveLength(0);
    expect(loopAnimation.start).not.toHaveBeenCalled();
  });

  it('visible=trueの場合は表示してアニメーションを開始し、アンマウント時に停止する', () => {
    const { unmount } = render(<NewRecordPill visible />);

    // UNSAFE_getByType を使うのは Text という型で要素を取得するため
    expect(screen.UNSAFE_getByType(Text).props.children).toBe('NEW RECORD!!');
    expect(loopAnimation.start).toHaveBeenCalledTimes(1);

    act(() => unmount());

    expect(loopAnimation.stop).toHaveBeenCalledTimes(1);
  });
});
