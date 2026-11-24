import { Redirect } from 'expo-router';
import { useCallback, useEffect, useLayoutEffect, useRef } from 'react';

import type { AnnualReportPayloadV1 } from '@/features/annualReport/annualReportTypes';
import { AnnualReportScreen } from '@/ui/components/annualReport/AnnualReportScreen';
import { type AppStateContextValue, useAppState } from '@/ui/state/AppStateProvider';

/**
 * 年間レポートルート(/annual-report)。
 *
 * 表示できるレポートがない(公開期間外・未完了)ときは、ディープリンクなどで直接来ても地図へ戻す。
 */
export default function AnnualReportRoute(): React.ReactElement {
  const s = useAppState();

  if (!s.annualReport) {
    return <Redirect href="/" />;
  }

  return <AnnualReportRouteContent state={s} payload={s.annualReport} />;
}

/**
 * レポートを表示している間だけ描く本体。
 *
 * 閉じるボタン以外(Androidの戻る・iOSのスワイプ・表示中のリダイレクト)で離れても閉じたときの後処理が
 * 走るよう、アンマウント時に `notifyAnnualReportLeft` を呼ぶ。閉じるボタンで閉じた場合は
 * `closeAnnualReport` が後処理を済ませているため、二重に呼ばない。
 */
function AnnualReportRouteContent({ state, payload }: { state: AppStateContextValue; payload: AnnualReportPayloadV1 }) {
  const closedRef = useRef(false);
  const stateRef = useRef(state);
  useLayoutEffect(() => {
    stateRef.current = state;
  });

  useEffect(
    () => () => {
      if (!closedRef.current) {
        closedRef.current = true;
        stateRef.current.notifyAnnualReportLeft();
      }
    },
    [],
  );

  const handleClose = useCallback(() => {
    if (closedRef.current) return;
    closedRef.current = true;
    stateRef.current.closeAnnualReport();
  }, []);

  return (
    <AnnualReportScreen
      payload={payload}
      activeStayPlaces={state.activeStayPlaces}
      stayPlacesStatus={state.stayPlacesStatus}
      onClose={handleClose}
    />
  );
}
