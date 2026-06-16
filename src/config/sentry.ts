import * as Application from 'expo-application';
import Constants from 'expo-constants';
import * as Sentry from '@sentry/react-native';
import type { ErrorEvent } from '@sentry/core';
import { Platform } from 'react-native';

import { scrubSentryEventLocationData } from './sentryScrubber';

const SENTRY_DSN = 'https://c74942d776de099ad82e73ef400d0525@o4511573900132352.ingest.us.sentry.io/4511573917106176';

let isSentryInitialized = false;

type PremiumAccessLike = {
  entitlementId: string;
  isPlusActive: boolean;
};

export type InvestigatedErrorContext = {
  area: string;
  context?: Record<string, unknown>;
  screenName?: string;
  tags?: Record<string, string>;
};

/**
 * Sentryへ送るイベントの最終加工を行う。
 *
 * GPSログ本体や座標値は送らない方針のため、送信直前に位置情報らしいフィールドをマスクする。
 */
export function filterSentryEventBeforeSend(event: ErrorEvent): ErrorEvent {
  return scrubSentryEventLocationData(event);
}

/**
 * Sentry SDKを初期化する。
 *
 * 重大なクラッシュや未捕捉例外を初期調査で拾うため、自動捕捉は有効にする。
 * 無料枠の調整が必要になった場合は、`beforeSend` やsampling設定で絞り込む。
 */
export function initializeSentry(): void {
  if (isSentryInitialized) {
    return;
  }

  Sentry.init({
    dsn: SENTRY_DSN,
    enableAutoPerformanceTracing: false,
    enableAutoSessionTracking: false,
    enableCaptureFailedRequests: false,
    sendDefaultPii: false,
    beforeSend(event) {
      return filterSentryEventBeforeSend(event);
    },
  });
  configureSentryAppContext();
  isSentryInitialized = true;
}

function getPlatformConstant(name: string): unknown {
  return (Platform.constants as Record<string, unknown>)[name];
}

function toOptionalString(value: unknown): string | undefined {
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}

function resolveAppVersion(): string | undefined {
  return Application.nativeApplicationVersion ?? Constants.expoConfig?.version ?? undefined;
}

function resolveBuildNumber(): string | undefined {
  return Application.nativeBuildVersion ?? undefined;
}

function resolveDeviceModel(): string | undefined {
  return (
    toOptionalString(Constants.platform?.ios?.model) ??
    toOptionalString(Constants.platform?.ios?.platform) ??
    toOptionalString(getPlatformConstant('Model'))
  );
}

/**
 * アプリ、OS、端末の調査用contextをSentryへ設定する。
 */
export function configureSentryAppContext(): void {
  Sentry.setContext('app', {
    applicationId: Application.applicationId,
    applicationName: Application.applicationName,
    buildNumber: resolveBuildNumber(),
    runtimeVersion: Constants.expoRuntimeVersion ?? undefined,
    version: resolveAppVersion(),
  });

  Sentry.setContext('device', {
    model: resolveDeviceModel(),
    modelId: toOptionalString(Constants.platform?.ios?.platform),
    osName: toOptionalString(getPlatformConstant('systemName')) ?? Platform.OS,
    osVersion: toOptionalString(getPlatformConstant('osVersion')) ?? String(Platform.Version),
    platform: Platform.OS,
    userInterfaceIdiom: toOptionalString(getPlatformConstant('interfaceIdiom')),
  });
}

/**
 * Support IDとして使うRevenueCat App User IDをSentry userへ設定する。
 */
export function updateSentryUserContext(revenueCatAppUserId: string | null): void {
  Sentry.setUser(revenueCatAppUserId ? { id: revenueCatAppUserId } : null);
}

/**
 * Sentryへ現在のサブスク加入状況を設定する。
 */
export function updateSentrySubscriptionContext(premiumAccessState: PremiumAccessLike): void {
  const status = premiumAccessState.isPlusActive ? 'plus' : 'free';
  Sentry.setTag('subscription_status', status);
  Sentry.setContext('subscription', {
    entitlementId: premiumAccessState.entitlementId,
    isPlusActive: premiumAccessState.isPlusActive,
    status,
  });
}

/**
 * Sentryへ現在画面名を設定する。
 */
export function updateSentryScreenContext(screenName: string): void {
  Sentry.setTag('screen', screenName);
  Sentry.setContext('screen', { name: screenName });
}

/**
 * 調査したい例外だけをSentryへ送る。
 */
export function reportInvestigatedError(error: unknown, options: InvestigatedErrorContext): void {
  Sentry.withScope((scope) => {
    scope.setTag('investigation_area', options.area);

    if (options.screenName) {
      scope.setTag('screen', options.screenName);
    }

    Object.entries(options.tags ?? {}).forEach(([key, value]) => {
      scope.setTag(key, value);
    });

    if (options.context) {
      scope.setContext('investigation', options.context);
    }

    Sentry.captureException(error);
  });
}

export const wrapWithSentry = Sentry.wrap;
