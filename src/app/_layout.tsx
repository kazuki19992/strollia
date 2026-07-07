import { Slot } from 'expo-router';
import React from 'react';

import { wrapWithSentry } from '@/config/sentry';

/**
 * expo-router のルートレイアウト。
 *
 * Sentry.wrap を適用して既存の wrapWithSentry と等価な動作を維持する。
 * <Slot /> がキャッチオールとして src/app/index.tsx を描画する。
 */
function RootLayout() {
  return <Slot />;
}

export default wrapWithSentry(RootLayout);
