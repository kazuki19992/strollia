declare module 'react-native-purchases-ui' {
  const RevenueCatUI: {
    presentPaywall(): Promise<unknown>;
  };

  export const PAYWALL_RESULT: {
    PURCHASED: unknown;
    RESTORED: unknown;
    CANCELLED: unknown;
    NOT_PRESENTED: unknown;
    ERROR: unknown;
  };

  export default RevenueCatUI;
}
