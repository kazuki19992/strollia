import { act, renderHook } from '@testing-library/react-native';
import * as Notifications from 'expo-notifications';

import { useAnnualReportNotificationResponse } from '@/ui/hooks/useAnnualReportNotificationResponse';

jest.mock('expo-notifications', () => ({
  useLastNotificationResponse: jest.fn(() => null),
  addNotificationResponseReceivedListener: jest.fn(() => ({ remove: jest.fn() })),
}));

/** テスト用通知レスポンスを作るヘルパー。 */
function makeResponse(id: string, data: unknown = { screen: 'annualReport', year: 2026 }) {
  return {
    notification: { request: { identifier: id, content: { data } } },
  } as unknown as Notifications.NotificationResponse;
}

/** 通知タップリスナーを捕捉する。 */
function captureListener() {
  const holder: { listener?: (response: Notifications.NotificationResponse) => void } = {};
  (Notifications.addNotificationResponseReceivedListener as jest.Mock).mockImplementation((cb) => {
    holder.listener = cb;
    return { remove: jest.fn() };
  });
  return holder;
}

describe('年間レポート通知応答 useAnnualReportNotificationResponse', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (Notifications.useLastNotificationResponse as jest.Mock).mockReturnValue(null);
    (Notifications.addNotificationResponseReceivedListener as jest.Mock).mockReturnValue({ remove: jest.fn() });
  });

  it('初期化済みで通知をタップすると対象年を渡して開く', async () => {
    const holder = captureListener();
    const onOpenAnnualReport = jest.fn();
    await renderHook(() => useAnnualReportNotificationResponse({ isReady: true, onOpenAnnualReport }));

    await act(() => {
      holder.listener!(makeResponse('n1'));
    });

    expect(onOpenAnnualReport).toHaveBeenCalledTimes(1);
    expect(onOpenAnnualReport).toHaveBeenCalledWith(2026);
  });

  it('年間レポート以外の通知では開かない', async () => {
    const holder = captureListener();
    const onOpenAnnualReport = jest.fn();
    await renderHook(() => useAnnualReportNotificationResponse({ isReady: true, onOpenAnnualReport }));

    await act(() => {
      holder.listener!(makeResponse('n1', { screen: 'monthlyReport' }));
    });

    expect(onOpenAnnualReport).not.toHaveBeenCalled();
  });

  it('初期化前のタップは初期化後に一度だけ開く', async () => {
    const response = makeResponse('cold-1');
    (Notifications.useLastNotificationResponse as jest.Mock).mockReturnValue(response);
    const onOpenAnnualReport = jest.fn();
    const { rerender } = await renderHook(
      ({ isReady }: { isReady: boolean }) => useAnnualReportNotificationResponse({ isReady, onOpenAnnualReport }),
      { initialProps: { isReady: false } },
    );
    expect(onOpenAnnualReport).not.toHaveBeenCalled();

    await rerender({ isReady: true });
    await rerender({ isReady: true });

    expect(onOpenAnnualReport).toHaveBeenCalledTimes(1);
    expect(onOpenAnnualReport).toHaveBeenCalledWith(2026);
  });

  it('同じ通知IDは二度処理しない', async () => {
    const holder = captureListener();
    const onOpenAnnualReport = jest.fn();
    await renderHook(() => useAnnualReportNotificationResponse({ isReady: true, onOpenAnnualReport }));

    await act(() => {
      holder.listener!(makeResponse('dup'));
      holder.listener!(makeResponse('dup'));
    });

    expect(onOpenAnnualReport).toHaveBeenCalledTimes(1);
  });

  it('リスナー登録後に差し替わった最新の関数を呼ぶ', async () => {
    const holder = captureListener();
    const first = jest.fn();
    const second = jest.fn();
    const { rerender } = await renderHook(
      ({ cb }: { cb: (year: number) => void }) => useAnnualReportNotificationResponse({ isReady: true, onOpenAnnualReport: cb }),
      { initialProps: { cb: first } },
    );
    await rerender({ cb: second });

    await act(() => {
      holder.listener!(makeResponse('n1'));
    });

    expect(first).not.toHaveBeenCalled();
    expect(second).toHaveBeenCalledWith(2026);
  });
});
