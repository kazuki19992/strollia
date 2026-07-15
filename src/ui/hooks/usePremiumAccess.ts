import { useCallback, useEffect, useRef, useState } from 'react';
import { Alert } from 'react-native';
import * as Haptics from 'expo-haptics';

import {
  getDefaultPremiumAccessState,
  getPremiumOfferingSummary,
  getRevenueCatAppUserId,
  PremiumAccessState,
  PremiumOfferingSummary,
  PremiumPackagePlan,
  presentPremiumCustomerCenter,
  purchasePremiumPackage,
  restorePremiumPurchases,
  subscribePremiumAccessStateUpdates,
} from '@/features/premium/revenueCatAccess';
import { syncMonthlyReportNotification } from '@/features/reports/monthlyReportNotificationService';

/** `usePremiumAccess` が返す状態と操作の型。 */
export type UsePremiumAccessResult = {
  /** RevenueCat から取得した最新の Strollia Plus 利用可否。 */
  premiumAccessState: PremiumAccessState;
  /**
   * 初回起動時のアイコン解決が完了するまで true を返す。
   * Plus 判定が未確定な間も正しいアイコンを表示するためのフラグ。
   */
  isPremiumAccessPendingForIcon: boolean;
  /** RevenueCat App User ID（サポート対応用）。未取得/不明時は null。 */
  revenueCatAppUserId: string | null;
  /** 設定画面に表示する Offering 概要。取得前・失敗時は null。 */
  premiumOfferingSummary: PremiumOfferingSummary | null;
  /** Offering を取得中かどうか。 */
  isLoadingPremiumOffering: boolean;
  /** RevenueCat Package を購入処理中かどうか。 */
  isPurchasingPremiumPackage: boolean;
  /** RevenueCat Customer Center を表示中かどうか。 */
  isPresentingPremiumCustomerCenter: boolean;
  /** 購入を復元処理中かどうか。 */
  isRestoringPremiumPurchases: boolean;
  /** Strollia Plus ペイウォールが表示中かどうか。 */
  isPremiumPaywallVisible: boolean;
  /**
   * 外部（openMonthlyReport 等）から Plus 状態を直接更新するための setter。
   * openMonthlyReport が最新状態を getPremiumAccessState() で取得し適用するために使う。
   */
  setPremiumAccessState: (state: PremiumAccessState) => void;
  /**
   * 起動時 effect 開始時点の premiumAccessUpdateVersion のスナップショットを返す。
   * App.tsx の初期化 effect の先頭で呼び、戻り値を initializePremiumAccess に渡す。
   */
  snapshotPremiumAccessUpdateVersion: () => number;
  /**
   * 起動時 Plus 状態取得の完了後に呼ぶ初期化関数。
   * App.tsx の初期化 effect から同じ位置・同じ順序で呼ぶ。
   *
   * @param params.initialVersion - effect 開始時に snapshotPremiumAccessUpdateVersion() で取得したバージョン。
   * @param params.initialPremiumAccessRequest - getConfirmedPremiumAccessState() の Promise。タイムアウト後の遅延確定に使う。
   * @param params.result - resolveInitialPremiumAccess の結果。
   * @param params.signal - AbortSignal。中断時に setState を呼ばないために使う。
   */
  initializePremiumAccess: (params: {
    initialVersion: number;
    initialPremiumAccessRequest: Promise<PremiumAccessState>;
    result: { state: PremiumAccessState; timedOut: boolean; confirmed: boolean };
    signal: AbortSignal;
  }) => void;
  /** 設定画面から RevenueCat Package を直接購入し、Plus 状態を更新する。 */
  purchasePremiumPackageFromSettings: (plan: PremiumPackagePlan) => Promise<void>;
  /** App Store または Google Play の購入を RevenueCat 経由で復元する。 */
  restorePurchasesFromSettings: () => Promise<void>;
  /** RevenueCat Customer Center を表示する。 */
  openPremiumCustomerCenter: () => Promise<void>;
  /** Strollia Plus ペイウォールを表示する。 */
  openPremiumPaywall: () => void;
  /** Strollia Plus ペイウォールを閉じる。 */
  closePremiumPaywall: () => void;
  /** Plus 未加入時に有料項目を選んだ場合の案内を表示する。 */
  showPremiumLockedMessage: (label: string) => void;
};

/**
 * Strollia Plus 課金状態・操作を束ねるカスタムフック。
 *
 * RevenueCat との連携に必要な state / ref / effect / 操作関数を
 * App.tsx から切り出し、課金ドメインの責務を1箇所に集約する。
 * ユーザー向け挙動は App.tsx のそれと完全に同一に保つ。
 */
export function usePremiumAccess(): UsePremiumAccessResult {
  /** 軽い選択操作に使うタプティックを鳴らす（App.tsx の triggerSelectionHaptic と同等）。 */
  function triggerSelectionHaptic(): void {
    Haptics.selectionAsync().catch(() => undefined);
  }
  const [premiumAccessState, setPremiumAccessState] = useState(getDefaultPremiumAccessState);
  const [isPremiumAccessPendingForIcon, setIsPremiumAccessPendingForIcon] = useState(true);
  const [revenueCatAppUserId, setRevenueCatAppUserId] = useState<string | null>(null);
  const [premiumOfferingSummary, setPremiumOfferingSummary] = useState<PremiumOfferingSummary | null>(null);
  const [isLoadingPremiumOffering, setIsLoadingPremiumOffering] = useState(false);
  const [isPurchasingPremiumPackage, setIsPurchasingPremiumPackage] = useState(false);
  const isPurchasingPremiumPackageRef = useRef(false);
  const [isPresentingPremiumCustomerCenter, setIsPresentingPremiumCustomerCenter] = useState(false);
  const isPresentingPremiumCustomerCenterRef = useRef(false);
  const [isRestoringPremiumPurchases, setIsRestoringPremiumPurchases] = useState(false);
  /**
   * 購入復元の連打防止用 ref。
   * state（isRestoringPremiumPurchases）ではなく ref を使うことで、
   * 再レンダー前の同一ティック内での二重タップをガードできる。
   */
  const isRestoringPremiumPurchasesRef = useRef(false);
  const [isPremiumPaywallVisible, setIsPremiumPaywallVisible] = useState(false);
  const isPremiumPaywallVisibleRef = useRef(false);
  /**
   * 購読 effect とタイムアウト後の遅延確定が競合せず setPremiumAccessState を呼べるよう、
   * 最後に更新した側を識別するバージョンカウンター。
   * App.tsx の `premiumAccessUpdateVersionRef` と同じ役割をフック内で担う。
   */
  const premiumAccessUpdateVersionRef = useRef(0);

  /** RevenueCat CustomerInfo 更新に合わせて Strollia Plus 状態を反映する。 */
  useEffect(
    () =>
      subscribePremiumAccessStateUpdates((state) => {
        premiumAccessUpdateVersionRef.current += 1;
        setPremiumAccessState(state);
        setIsPremiumAccessPendingForIcon(false);
        syncMonthlyReportNotification(state.isPlusActive).catch((error: unknown) => {
          console.warn('Failed to sync monthly report notification:', error);
        });
      }),
    [],
  );

  /**
   * effect 開始時点の premiumAccessUpdateVersion のスナップショットを返す。
   * App.tsx の初期化 effect の先頭で呼び、戻り値を initializePremiumAccess に渡す。
   */
  const snapshotPremiumAccessUpdateVersion = useCallback((): number => {
    return premiumAccessUpdateVersionRef.current;
  }, []);

  /**
   * 起動時 Plus 状態取得の完了後に呼ぶ初期化関数。
   * App.tsx の初期化 effect から同じ位置・同じ順序で呼ぶ。
   */
  const initializePremiumAccess = useCallback(
    ({
      initialVersion,
      initialPremiumAccessRequest,
      result,
      signal,
    }: {
      initialVersion: number;
      initialPremiumAccessRequest: Promise<PremiumAccessState>;
      result: { state: PremiumAccessState; timedOut: boolean; confirmed: boolean };
      signal: AbortSignal;
    }): void => {
      if (premiumAccessUpdateVersionRef.current === initialVersion) {
        setPremiumAccessState(result.state);
        if (result.confirmed) {
          setIsPremiumAccessPendingForIcon(false);
        }
        syncMonthlyReportNotification(result.state.isPlusActive).catch((error: unknown) => {
          console.warn('Failed to sync monthly report notification:', error);
        });
      }

      if (result.timedOut) {
        initialPremiumAccessRequest
          .then((state) => {
            if (!signal.aborted && premiumAccessUpdateVersionRef.current === initialVersion) {
              setPremiumAccessState(state);
              setIsPremiumAccessPendingForIcon(false);
              syncMonthlyReportNotification(state.isPlusActive).catch((error: unknown) => {
                console.warn('Failed to sync monthly report notification:', error);
              });
            }
          })
          .catch((error: unknown) => {
            console.warn('Failed to refresh delayed premium access state:', error);
          });
      }

      getRevenueCatAppUserId()
        .then((appUserId) => {
          if (!signal.aborted) setRevenueCatAppUserId(appUserId);
        })
        .catch((error: unknown) => {
          console.warn('Failed to refresh RevenueCat app user id:', error);
        });

      setIsLoadingPremiumOffering(true);
      getPremiumOfferingSummary()
        .then((offering) => {
          if (!signal.aborted) setPremiumOfferingSummary(offering);
        })
        .catch((error: unknown) => {
          console.warn('Failed to refresh premium offering summary:', error);
        })
        .finally(() => {
          if (!signal.aborted) setIsLoadingPremiumOffering(false);
        });
    },
    [],
  );

  /** Strollia Plus ペイウォールを閉じる。 */
  const closePremiumPaywall = useCallback((): void => {
    isPremiumPaywallVisibleRef.current = false;
    setIsPremiumPaywallVisible(false);
  }, []);

  /** 設定画面から RevenueCat Package を直接購入し、Plus 状態を更新する。 */
  const purchasePremiumPackageFromSettings = useCallback(
    async (plan: PremiumPackagePlan): Promise<void> => {
      if (isPurchasingPremiumPackageRef.current) {
        return;
      }

      isPurchasingPremiumPackageRef.current = true;
      triggerSelectionHaptic();
      setIsPurchasingPremiumPackage(true);

      try {
        const result = await purchasePremiumPackage(plan);
        setPremiumAccessState(result.accessState);

        if (result.status === 'purchased' && result.accessState.isPlusActive) {
          Alert.alert('Strollia Plus', 'Plus特典が有効になりました。');
          closePremiumPaywall();
        } else if (result.status === 'error') {
          Alert.alert('Strollia Plus', '購入を完了できませんでした。RevenueCatとストア設定を確認してください。');
        }
      } finally {
        isPurchasingPremiumPackageRef.current = false;
        setIsPurchasingPremiumPackage(false);
      }
    },
    [closePremiumPaywall],
  );

  /** App Store または Google Play の購入を RevenueCat 経由で復元する。 */
  const restorePurchasesFromSettings = useCallback(async (): Promise<void> => {
    if (isRestoringPremiumPurchasesRef.current) {
      return;
    }

    isRestoringPremiumPurchasesRef.current = true;
    triggerSelectionHaptic();
    setIsRestoringPremiumPurchases(true);

    try {
      const restoredState = await restorePremiumPurchases();
      setPremiumAccessState(restoredState);
      Alert.alert(
        '購入の復元',
        restoredState.isPlusActive ? 'Strollia Plusを復元しました。' : '復元できるStrollia Plus購入は見つかりませんでした。',
      );
      if (restoredState.isPlusActive) {
        closePremiumPaywall();
      }
    } finally {
      isRestoringPremiumPurchasesRef.current = false;
      setIsRestoringPremiumPurchases(false);
    }
  }, [closePremiumPaywall]);

  /** RevenueCat Customer Center を表示する。 */
  const openPremiumCustomerCenter = useCallback(async (): Promise<void> => {
    if (isPresentingPremiumCustomerCenterRef.current) {
      return;
    }

    isPresentingPremiumCustomerCenterRef.current = true;
    triggerSelectionHaptic();
    setIsPresentingPremiumCustomerCenter(true);

    try {
      const didPresent = await presentPremiumCustomerCenter();

      if (!didPresent) {
        Alert.alert('Strollia Plus', 'サブスク管理画面を表示できませんでした。RevenueCatとストア設定を確認してください。');
      }
    } finally {
      isPresentingPremiumCustomerCenterRef.current = false;
      setIsPresentingPremiumCustomerCenter(false);
    }
  }, []);

  /** Strollia Plus ペイウォールを表示する。 */
  const openPremiumPaywall = useCallback((): void => {
    if (isPremiumPaywallVisibleRef.current) {
      return;
    }
    isPremiumPaywallVisibleRef.current = true;
    setIsPremiumPaywallVisible(true);
  }, []);

  /**
   * Plus 未加入時に有料項目を選んだ場合の案内を表示する。
   *
   * @param label - 選択しようとした項目名。
   */
  const showPremiumLockedMessage = useCallback((label: string): void => {
    triggerSelectionHaptic();
    Alert.alert('Strollia Plus限定', `${label}はStrollia Plusで開放できます。設定画面の月払いまたは年払いから加入してください。`);
  }, []);

  return {
    premiumAccessState,
    isPremiumAccessPendingForIcon,
    revenueCatAppUserId,
    premiumOfferingSummary,
    isLoadingPremiumOffering,
    isPurchasingPremiumPackage,
    isPresentingPremiumCustomerCenter,
    isRestoringPremiumPurchases,
    isPremiumPaywallVisible,
    setPremiumAccessState,
    snapshotPremiumAccessUpdateVersion,
    initializePremiumAccess,
    purchasePremiumPackageFromSettings,
    restorePurchasesFromSettings,
    openPremiumCustomerCenter,
    openPremiumPaywall,
    closePremiumPaywall,
    showPremiumLockedMessage,
  };
}
