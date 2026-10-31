import { Animated } from 'react-native';
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

  it('visible=falseの場合は何も表示せずアニメーションを開始しない', async () => {
    await render(<NewRecordPill visible={false} />);

    // Text ホスト要素が0件であることを確認する
    expect(screen.container.queryAll((node) => node.type === 'Text')).toHaveLength(0);
    expect(loopAnimation.start).not.toHaveBeenCalled();
  });

  it('visible=trueの場合は表示してアニメーションを開始し、アンマウント時に停止する', async () => {
    const { unmount } = await render(<NewRecordPill visible />);

    expect(screen.getByText('NEW RECORD!!')).toBeTruthy();
    expect(loopAnimation.start).toHaveBeenCalledTimes(1);

    await act(async () => await unmount());

    expect(loopAnimation.stop).toHaveBeenCalledTimes(1);
  });
});
