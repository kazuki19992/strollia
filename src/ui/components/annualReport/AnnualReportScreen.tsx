import { Feather } from '@expo/vector-icons';
import { type ComponentRef, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Image, Pressable, Text, View } from 'react-native';
import { SafeAreaInsetsContext } from 'react-native-safe-area-context';

import { isMapPage, resolveAnnualReportPages, type AnnualReportPageId } from '@/features/annualReport/annualReportPages';
import type { AnnualReportCoordinate, AnnualReportPayloadV1 } from '@/features/annualReport/annualReportTypes';
import { shareViewAsPng } from '@/features/export/capturedViewShare';
import { hasPrivacyRadiusInSegments, toPrivacyCoordinateSegments } from '@/features/stayPlaces/privacyRouteSegments';
import type { StayPlacesStatus } from '@/features/stayPlaces/stayPlaceAccess';
import type { StayPlace } from '@/features/stayPlaces/stayPlaceTypes';
import { darkTheme } from '@/theme/theme';
import { createStyles } from '@/ui/appStyles';
import {
  ANNUAL_REPORT_PRIVACY_DIALOG_MESSAGE,
  ANNUAL_REPORT_PRIVACY_DIALOG_TITLE,
  ANNUAL_REPORT_SHARE_CANCEL_LABEL,
  ANNUAL_REPORT_SHARE_HIDDEN_LABEL,
  ANNUAL_REPORT_SHARE_RAW_LABEL,
  STAY_PLACES_SHARE_ERROR_MESSAGE,
  STAY_PLACES_SHARE_LOADING_MESSAGE,
  STAY_PLACES_SHARE_UNAVAILABLE_TITLE,
} from '@/ui/appText';
import { ActionPill } from '@/ui/components/ActionPill';
import { Dialog } from '@/ui/components/Dialog';
import { ShareButton } from '@/ui/components/ShareButton';
import { StoryProgressBar } from '@/ui/components/StoryProgressBar';
import { StoryTransitionView } from '@/ui/components/StoryTransitionView';
import { useStoryPlayer } from '@/ui/hooks/useStoryPlayer';
import { AnnualReportAchievementsPage } from './AnnualReportAchievementsPage';
import { AnnualReportActiveDaysPage } from './AnnualReportActiveDaysPage';
import { AnnualReportDistancePage } from './AnnualReportDistancePage';
import { AnnualReportFarthestDayPage } from './AnnualReportFarthestDayPage';
import { AnnualReportFirstVisitsPage } from './AnnualReportFirstVisitsPage';
import { AnnualReportMonthlyDistancePage } from './AnnualReportMonthlyDistancePage';
import { AnnualReportNewAreasPage } from './AnnualReportNewAreasPage';
import { AnnualReportOpeningPage } from './AnnualReportOpeningPage';
import { AnnualReportSummaryPage } from './AnnualReportSummaryPage';
import { AnnualReportYearMapPage } from './AnnualReportYearMapPage';
import type { AnnualReportPageProps } from './annualReportPageProps';
import { ANNUAL_REPORT_PAGE_TOP_OFFSET, annualReportColors, annualReportStyles } from './annualReportStyles';

/** AnnualReportScreen の props。 */
export type AnnualReportScreenProps = {
  /** 表示する年間レポート。 */
  payload: AnnualReportPayloadV1;
  /** 共有時の非表示半径に使う、現在有効な滞在場所。未解決・失敗時は null。 */
  activeStayPlaces: StayPlace[] | null;
  /** 滞在場所の読込状態。ready 以外では地図ページを共有しない(fail-closed)。 */
  stayPlacesStatus: StayPlacesStatus;
  /** 閉じるボタンを押したときの処理。 */
  onClose: () => void;
};

/** セーフエリアの Provider が無いとき(テストなど)に使う余白。 */
const NO_INSETS = { top: 0, right: 0, bottom: 0, left: 0 };
/** 長押しで一時停止とみなすまでの時間(ミリ秒)。 */
const LONG_PRESS_DELAY_MS = 250;
/** 共有ボタン下端の余白。 */
const SHARE_BUTTON_BOTTOM = 22;
/** 共有ボタンの領域(タップ送りの領域から外す高さ)。 */
const SHARE_AREA_HEIGHT = 70;

/** 共有画像を撮る間の状態。hidePrivate なら非表示範囲を除いたルートで描き直す。 */
type CaptureState = { hidePrivate: boolean };

/** 次の描画フレームまで待つ。描き直したルートがネイティブ側に反映されてから撮るため。 */
function waitForFrame(): Promise<void> {
  return new Promise((resolve) => requestAnimationFrame(() => resolve()));
}

/**
 * 年間振り返りのストーリー画面(spec §4〜§6)。
 *
 * 1ページ7秒で自動送りし、左35%タップで前、右65%タップで次、長押しで一時停止する。
 * 共有ボタンは表示中のページをPNGにして共有する。地図ページで非表示範囲の滞在場所がかかるときは、
 * 隠すかどうかを確認してから撮る。OSのテーマに関係なく固定ダークで描く。
 */
export function AnnualReportScreen({ payload, activeStayPlaces, stayPlacesStatus, onClose }: AnnualReportScreenProps) {
  const insets = useContext(SafeAreaInsetsContext) ?? NO_INSETS;
  const pages = useMemo(() => resolveAnnualReportPages(payload), [payload]);
  const player = useStoryPlayer({ pageCount: pages.length });
  const pageId = pages[player.index];
  // 進行バー・ダイアログは固定ダークで描くため、ダークテーマのスタイルを使う
  const appStyles = useMemo(() => createStyles(darkTheme), []);

  const captureRef = useRef<ComponentRef<typeof View> | null>(null);
  const isSharingRef = useRef(false);
  const isMountedRef = useRef(true);
  const longPressedRef = useRef(false);
  const [capture, setCapture] = useState<CaptureState | null>(null);
  const [isPrivacyDialogVisible, setIsPrivacyDialogVisible] = useState(false);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const farthestRoute = useMemo<AnnualReportCoordinate[][]>(
    () => (payload.farthestDay ? [payload.farthestDay.route.map(({ latitude, longitude }) => ({ latitude, longitude }))] : []),
    [payload.farthestDay],
  );
  const hidePrivate = capture?.hidePrivate === true && activeStayPlaces != null;
  const yearSegments = useMemo(
    () =>
      hidePrivate && activeStayPlaces
        ? toPrivacyCoordinateSegments(payload.yearRouteSegments, activeStayPlaces).map((segment) => segment.coordinates)
        : payload.yearRouteSegments,
    [hidePrivate, activeStayPlaces, payload.yearRouteSegments],
  );
  const farthestPrivacySegments = useMemo(
    () =>
      hidePrivate && activeStayPlaces
        ? toPrivacyCoordinateSegments(farthestRoute, activeStayPlaces).map((segment) => segment.coordinates)
        : null,
    [hidePrivate, activeStayPlaces, farthestRoute],
  );

  /** 地図ページに描くルート(非表示範囲の判定対象)。 */
  function routeSegmentsOf(id: AnnualReportPageId): AnnualReportCoordinate[][] {
    return id === 'farthestDay' ? farthestRoute : payload.yearRouteSegments;
  }

  /** 表示中のページを撮って共有する。撮る間は自動送りとページ内アニメーションを止め、完成状態で撮る。 */
  async function startShare(hide: boolean): Promise<void> {
    isSharingRef.current = true;
    player.pause();
    setCapture({ hidePrivate: hide });

    await shareViewAsPng(captureRef, {
      dialogTitle: `すとろりあ 年間レポート ${payload.year}`,
      errorFallbackMessage: 'レポート画像を共有できませんでした。',
      // 完成状態・描き直したルートが描画に反映されるまで2フレーム待つ
      onBeforeCapture: async () => {
        await waitForFrame();
        await waitForFrame();
      },
      shouldAbort: () => !isMountedRef.current,
      onFinally: () => {
        isSharingRef.current = false;
        if (isMountedRef.current) {
          setCapture(null);
          player.resume();
        }
      },
    });
  }

  /** 共有ボタン。地図ページは滞在場所の確認(fail-closed)と、非表示範囲がかかるときの確認ダイアログを挟む。 */
  function handleSharePress(): void {
    if (isSharingRef.current || isPrivacyDialogVisible) {
      return;
    }
    if (isMapPage(pageId)) {
      // 設定が壊れていても hasPrivacyRadiusInSegments は true を返すため、先に読込状態を確認して共有自体を止める
      if (stayPlacesStatus !== 'ready' || activeStayPlaces == null) {
        Alert.alert(
          STAY_PLACES_SHARE_UNAVAILABLE_TITLE,
          stayPlacesStatus === 'error' ? STAY_PLACES_SHARE_ERROR_MESSAGE : STAY_PLACES_SHARE_LOADING_MESSAGE,
        );
        return;
      }
      if (hasPrivacyRadiusInSegments(routeSegmentsOf(pageId), activeStayPlaces)) {
        player.pause();
        setIsPrivacyDialogVisible(true);
        return;
      }
    }
    // 共有の完了は待たない(エラーは shareViewAsPng 内で通知される)
    void startShare(false);
  }

  /** 確認ダイアログでの選択。 */
  function handlePrivacyChoice(choice: 'hide' | 'raw' | 'cancel'): void {
    setIsPrivacyDialogVisible(false);
    if (choice === 'cancel') {
      player.resume();
      return;
    }
    void startShare(choice === 'hide');
  }

  const pageProps: AnnualReportPageProps = {
    payload,
    paused: player.isPaused,
    completed: capture != null,
    contentTop: insets.top + ANNUAL_REPORT_PAGE_TOP_OFFSET,
    contentBottom: insets.bottom + SHARE_AREA_HEIGHT + 6,
  };

  /** ページ識別子に対応するページを描く。 */
  function renderPage(id: AnnualReportPageId) {
    switch (id) {
      case 'opening':
        return <AnnualReportOpeningPage {...pageProps} />;
      case 'activeDays':
        return <AnnualReportActiveDaysPage {...pageProps} />;
      case 'distance':
        return <AnnualReportDistancePage {...pageProps} />;
      case 'yearMap':
        return <AnnualReportYearMapPage {...pageProps} segments={yearSegments} />;
      case 'monthly':
        return <AnnualReportMonthlyDistancePage {...pageProps} />;
      case 'farthestDay':
        return <AnnualReportFarthestDayPage {...pageProps} privacySegments={farthestPrivacySegments} />;
      case 'firstVisits':
        return <AnnualReportFirstVisitsPage {...pageProps} />;
      case 'newAreas':
        return <AnnualReportNewAreasPage {...pageProps} />;
      case 'achievements':
        return <AnnualReportAchievementsPage {...pageProps} />;
      case 'summary':
        return <AnnualReportSummaryPage {...pageProps} segments={yearSegments} />;
    }
  }

  const tapZoneVertical = { top: insets.top + 60, bottom: insets.bottom + SHARE_AREA_HEIGHT };

  return (
    <View style={annualReportStyles.screen}>
      {/* 共有画像に写す範囲。進行バー・閉じる・共有ボタンは含めない */}
      <View ref={captureRef} collapsable={false} style={annualReportStyles.capture}>
        <StoryTransitionView pageKey={pageId}>{renderPage(pageId)}</StoryTransitionView>
        <View style={[annualReportStyles.header, { top: insets.top + 26 }]}>
          <Image source={require('../../../../assets/icon.png')} style={annualReportStyles.headerIcon} />
          <View>
            <Text style={annualReportStyles.headerTitle}>Strollia</Text>
            <Text style={annualReportStyles.headerSubtitle}>{`Report ${payload.year}`}</Text>
          </View>
        </View>
      </View>

      <View style={[annualReportStyles.progress, { top: insets.top + 14 }]}>
        <StoryProgressBar pageCount={pages.length} index={player.index} progress={player.progress} styles={appStyles} />
      </View>

      <Pressable
        accessibilityRole="button"
        accessibilityLabel="前のページ"
        delayLongPress={LONG_PRESS_DELAY_MS}
        style={[annualReportStyles.tapZoneLeft, tapZoneVertical]}
        onPressIn={() => {
          longPressedRef.current = false;
        }}
        onLongPress={() => {
          longPressedRef.current = true;
          player.pause();
        }}
        onPressOut={() => {
          if (longPressedRef.current) player.resume();
        }}
        onPress={player.prev}
      />
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="次のページ"
        delayLongPress={LONG_PRESS_DELAY_MS}
        style={[annualReportStyles.tapZoneRight, tapZoneVertical]}
        onPressIn={() => {
          longPressedRef.current = false;
        }}
        onLongPress={() => {
          longPressedRef.current = true;
          player.pause();
        }}
        onPressOut={() => {
          if (longPressedRef.current) player.resume();
        }}
        onPress={player.next}
      />

      <Pressable
        accessibilityRole="button"
        accessibilityLabel="閉じる"
        hitSlop={8}
        style={[annualReportStyles.closeButton, { top: insets.top + 18 }]}
        onPress={onClose}
      >
        <Feather name="x" size={22} color={annualReportColors.text} />
      </Pressable>

      <ShareButton
        accessibilityLabel="このページを共有"
        disabled={capture != null}
        iconColor="#111111"
        iconSize={16}
        label="共有"
        variant="wide"
        style={[annualReportStyles.shareButton, { bottom: insets.bottom + SHARE_BUTTON_BOTTOM }]}
        textStyle={annualReportStyles.shareButtonText}
        onPress={handleSharePress}
      />

      <Dialog visible={isPrivacyDialogVisible} swipeToClose={false} styles={appStyles} onClose={() => handlePrivacyChoice('cancel')}>
        <View style={[appStyles.gifRangeContent, annualReportStyles.dialogContent]}>
          <Text style={appStyles.gifProgressTitle}>{ANNUAL_REPORT_PRIVACY_DIALOG_TITLE}</Text>
          <Text style={appStyles.gifProgressBody}>{ANNUAL_REPORT_PRIVACY_DIALOG_MESSAGE}</Text>
          <ActionPill
            label={ANNUAL_REPORT_SHARE_HIDDEN_LABEL}
            styles={appStyles}
            backgroundColor={annualReportColors.accent}
            borderColor={annualReportColors.accent}
            textColor={annualReportColors.accentText}
            onPress={() => handlePrivacyChoice('hide')}
          />
          <ActionPill label={ANNUAL_REPORT_SHARE_RAW_LABEL} styles={appStyles} onPress={() => handlePrivacyChoice('raw')} />
          <ActionPill label={ANNUAL_REPORT_SHARE_CANCEL_LABEL} styles={appStyles} onPress={() => handlePrivacyChoice('cancel')} />
        </View>
      </Dialog>
    </View>
  );
}
