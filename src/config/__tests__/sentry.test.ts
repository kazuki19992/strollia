import * as Sentry from '@sentry/react-native';

import {
  configureSentryAppContext,
  filterSentryEventBeforeSend,
  reportInvestigatedError,
  updateSentryScreenContext,
  updateSentrySubscriptionContext,
  updateSentryUserContext,
} from '../sentry';

const mockScope = {
  setContext: jest.fn(),
  setTag: jest.fn(),
  setUser: jest.fn(),
};

jest.mock('@sentry/react-native', () => ({
  captureException: jest.fn(),
  init: jest.fn(),
  setContext: jest.fn(),
  setTag: jest.fn(),
  setUser: jest.fn(),
  wrap: jest.fn((component) => component),
  withScope: jest.fn((callback) => callback(mockScope)),
}));

jest.mock('expo-application', () => ({
  applicationId: 'com.kazuki19992.strollia',
  applicationName: 'すとろりあ',
  nativeApplicationVersion: '1.2.3',
  nativeBuildVersion: '45',
}));

jest.mock('expo-constants', () => ({
  __esModule: true,
  default: {
    expoConfig: {
      version: '1.2.0',
    },
    expoRuntimeVersion: '1.2.0-runtime',
    platform: {
      ios: {
        model: 'iPhone 15',
        platform: 'iPhone16,1',
        systemVersion: '18.2',
      },
    },
  },
}));

jest.mock('react-native', () => ({
  Platform: {
    constants: {
      interfaceIdiom: 'handset',
      osVersion: '18.2',
      systemName: 'iOS',
    },
    OS: 'ios',
    Version: '18.2',
  },
}));

describe('Sentry送信制御', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('自動捕捉された重大イベントも送信対象にし、位置情報だけをマスクする', () => {
    expect(
      filterSentryEventBeforeSend({
        message: 'Unhandled render error',
        type: undefined,
        extra: {
          latitude: 35.681236,
          screenHint: 'Map',
        },
      }),
    ).toEqual({
      message: 'Unhandled render error',
      type: undefined,
      extra: {
        latitude: '[Filtered]',
        screenHint: 'Map',
      },
    });
  });

  it('アプリバージョン、ビルド番号、動作プラットフォーム、OS、端末情報をSentry contextに設定する', () => {
    configureSentryAppContext();

    expect(Sentry.setContext).toHaveBeenCalledWith('app', {
      applicationId: 'com.kazuki19992.strollia',
      applicationName: 'すとろりあ',
      buildNumber: '45',
      runtimeVersion: '1.2.0-runtime',
      version: '1.2.3',
    });
    expect(Sentry.setContext).toHaveBeenCalledWith('device', {
      model: 'iPhone 15',
      modelId: 'iPhone16,1',
      osName: 'iOS',
      osVersion: '18.2',
      platform: 'ios',
      userInterfaceIdiom: 'handset',
    });
  });

  it('Support ID、サブスク加入状況、画面名をSentryに設定する', () => {
    updateSentryUserContext('$RCAnonymousID:abc123');
    updateSentrySubscriptionContext({ entitlementId: 'strollia_plus', isPlusActive: true });
    updateSentryScreenContext('PremiumPaywall');

    expect(Sentry.setUser).toHaveBeenCalledWith({ id: '$RCAnonymousID:abc123' });
    expect(Sentry.setTag).toHaveBeenCalledWith('subscription_status', 'plus');
    expect(Sentry.setContext).toHaveBeenCalledWith('subscription', {
      entitlementId: 'strollia_plus',
      isPlusActive: true,
      status: 'plus',
    });
    expect(Sentry.setTag).toHaveBeenCalledWith('screen', 'PremiumPaywall');
    expect(Sentry.setContext).toHaveBeenCalledWith('screen', { name: 'PremiumPaywall' });
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
    expect(mockScope.setTag).toHaveBeenCalledWith('investigation_area', 'purchase');
    expect(mockScope.setTag).toHaveBeenCalledWith('screen', 'PremiumPaywall');
    expect(mockScope.setContext).toHaveBeenCalledWith('investigation', {
      subscriptionStatus: 'free',
    });
    expect(Sentry.captureException).toHaveBeenCalledWith(error);
  });
});
