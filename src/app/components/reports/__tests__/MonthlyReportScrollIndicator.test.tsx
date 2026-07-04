import { Animated } from 'react-native';

import { MonthlyReportScrollIndicator } from '@/app/components/reports/MonthlyReportScrollIndicator';

const ReactTestRenderer = require('react-test-renderer');
const { act } = ReactTestRenderer;

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
    let renderer: any;

    act(() => {
      renderer = ReactTestRenderer.create(<MonthlyReportScrollIndicator color="#ffffff" />);
    });

    expect(loopAnimation.start).toHaveBeenCalledTimes(1);

    act(() => renderer.unmount());

    expect(loopAnimation.stop).toHaveBeenCalledTimes(1);
  });
});
