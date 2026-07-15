import { Animated } from 'react-native';
import { render, act } from '@testing-library/react-native';

import { MonthlyReportScrollIndicator } from '@/ui/components/reports/MonthlyReportScrollIndicator';

describe('月次レポートスクロール誘導 MonthlyReportScrollIndicator', () => {
  let loopAnimation: { start: jest.Mock; stop: jest.Mock };

  beforeEach(() => {
    loopAnimation = { start: jest.fn(), stop: jest.fn() };
    jest.spyOn(Animated, 'timing').mockReturnValue({ start: jest.fn(), stop: jest.fn() } as never);
    jest.spyOn(Animated, 'loop').mockReturnValue(loopAnimation as never);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('マウント時にループアニメーションを開始し、アンマウント時に停止する', () => {
    const { unmount } = render(<MonthlyReportScrollIndicator color="#ffffff" />);

    expect(loopAnimation.start).toHaveBeenCalledTimes(1);

    act(() => unmount());

    expect(loopAnimation.stop).toHaveBeenCalledTimes(1);
  });
});
