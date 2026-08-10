import * as Sentry from '@sentry/react-native';

import {
  configureSentryAppContext,
  filterSentryEventBeforeSend,
  initializeSentry,
  reportInvestigatedError,
  setCrashReportingEnabled,
  updateSentryScreenContext,
  updateSentrySubscriptionContext,
  updateSentryUserContext,
  wrapWithSentry,
} from '@/config/sentry';

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
  const originalBuildProfile = process.env.EXPO_PUBLIC_STROLLIA_BUILD_PROFILE;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterEach(() => {
    process.env.EXPO_PUBLIC_STROLLIA_BUILD_PROFILE = originalBuildProfile;
  });

  it('productionビルド以外ではSentry SDKを初期化しない', () => {
    process.env.EXPO_PUBLIC_STROLLIA_BUILD_PROFILE = 'preview';

    initializeSentry();

    expect(Sentry.init).not.toHaveBeenCalled();
    expect(Sentry.setContext).not.toHaveBeenCalled();
  });

  it('productionビルドではApp Hangを2秒で検知しスタックトレースを添付する設定でSentry SDKを初期化する', () => {
    process.env.EXPO_PUBLIC_STROLLIA_BUILD_PROFILE = 'production';

    initializeSentry();

    expect(Sentry.init).toHaveBeenCalledWith(
      expect.objectContaining({
        enableAutoPerformanceTracing: false,
        enableAutoSessionTracking: false,
        enableCaptureFailedRequests: false,
        sendDefaultPii: false,
        // App Hang(iOS ANR相当)を明示的に有効化し、スタックトレースを添付して原因を追えるようにする
        enableAppHangTracking: true,
        appHangTimeoutInterval: 2,
        attachStacktrace: true,
      }),
    );
    expect(Sentry.setContext).toHaveBeenCalledWith(
      'app',
      expect.objectContaining({
        applicationId: 'com.kazuki19992.strollia',
        buildNumber: '45',
        version: '1.2.3',
      }),
    );
  });

  it('productionビルド以外ではRoot ComponentをSentryでwrapしない', () => {
    process.env.EXPO_PUBLIC_STROLLIA_BUILD_PROFILE = 'development';
    const RootComponent = jest.fn();

    expect(wrapWithSentry(RootComponent)).toBe(RootComponent);
    expect(Sentry.wrap).not.toHaveBeenCalled();
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

  describe('不具合レポート送信のゲート', () => {
    afterEach(() => {
      // 既定(有効)へ戻す。他テストへ副作用を残さない
      setCrashReportingEnabled(true);
    });

    it('無効化するとbeforeSendはnullを返しイベントを送らない', () => {
      const event = { message: 'test' } as unknown as Parameters<typeof filterSentryEventBeforeSend>[0];
      setCrashReportingEnabled(false);

      expect(filterSentryEventBeforeSend(event)).toBeNull();
    });

    it('有効時は位置情報マスク済みのイベントを返す', () => {
      const event = { message: 'test' } as unknown as Parameters<typeof filterSentryEventBeforeSend>[0];
      setCrashReportingEnabled(true);

      expect(filterSentryEventBeforeSend(event)).not.toBeNull();
    });
  });
});
