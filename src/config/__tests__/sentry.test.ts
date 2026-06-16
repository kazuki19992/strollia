import * as Sentry from '@sentry/react-native';

import {
  filterSentryEventForInvestigatedError,
  reportInvestigatedError,
} from '../sentry';

const mockScope = {
  setContext: jest.fn(),
  setTag: jest.fn(),
};

jest.mock('@sentry/react-native', () => ({
  captureException: jest.fn(),
  init: jest.fn(),
  wrap: jest.fn((component) => component),
  withScope: jest.fn((callback) => callback(mockScope)),
}));

describe('Sentry送信制御', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('調査対象として明示されていないイベントは送信しない', () => {
    expect(filterSentryEventForInvestigatedError({ message: 'Unhandled render error', type: undefined })).toBeNull();
  });

  it('調査対象として明示されたイベントは位置情報をマスクして送信する', () => {
    expect(
      filterSentryEventForInvestigatedError({
        message: 'RevenueCat purchase failed',
        type: undefined,
        tags: {
          strollia_investigated_error: 'true',
        },
        extra: {
          latitude: 35.681236,
          plan: 'yearly',
        },
      }),
    ).toEqual({
      message: 'RevenueCat purchase failed',
      type: undefined,
      tags: {
        strollia_investigated_error: 'true',
      },
      extra: {
        latitude: '[Filtered]',
        plan: 'yearly',
      },
    });
  });

  it('明示送信用ラッパーは調査対象タグと文脈を付けて例外を送る', () => {
    const error = new Error('purchase failed');

    reportInvestigatedError(error, {
      area: 'purchase',
      screenName: 'PremiumPaywall',
      context: {
        subscriptionStatus: 'free',
      },
    });

    expect(Sentry.withScope).toHaveBeenCalledTimes(1);
    expect(mockScope.setTag).toHaveBeenCalledWith('strollia_investigated_error', 'true');
    expect(mockScope.setTag).toHaveBeenCalledWith('investigation_area', 'purchase');
    expect(mockScope.setTag).toHaveBeenCalledWith('screen', 'PremiumPaywall');
    expect(mockScope.setContext).toHaveBeenCalledWith('investigation', {
      subscriptionStatus: 'free',
    });
    expect(Sentry.captureException).toHaveBeenCalledWith(error);
  });
});
