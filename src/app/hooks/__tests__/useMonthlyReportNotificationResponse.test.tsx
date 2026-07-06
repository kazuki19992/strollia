import * as Notifications from 'expo-notifications';

import {
  useMonthlyReportNotificationResponse,
  UseMonthlyReportNotificationResponseArgs,
} from '@/app/hooks/useMonthlyReportNotificationResponse';
import { isMonthlyReportNotification } from '@/features/reports/monthlyReportNotificationService';

const ReactTestRenderer = require('react-test-renderer');
const { act } = ReactTestRenderer;

jest.mock('expo-notifications', () => ({
  useLastNotificationResponse: jest.fn(() => null),
  addNotificationResponseReceivedListener: jest.fn(() => ({ remove: jest.fn() })),
}));

jest.mock('@/features/reports/monthlyReportNotificationService', () => ({
  isMonthlyReportNotification: jest.fn(),
  setupMonthlyReportNotificationChannel: jest.fn().mockResolvedValue(undefined),
  syncMonthlyReportNotification: jest.fn().mockResolvedValue(undefined),
}));

/** テスト用通知レスポンスを作るヘルパー。 */
function makeNotificationResponse(id: string) {
  return {
    notification: {
      request: {
        identifier: id,
        content: { data: { type: 'monthly_report' } },
      },
    },
  } as unknown as Notifications.NotificationResponse;
}

/** hookを実行するための最小コンポーネント。 */
function HookProbe(props: UseMonthlyReportNotificationResponseArgs) {
  useMonthlyReportNotificationResponse(props);
  return null;
}

describe('月次レポート通知応答 useMonthlyReportNotificationResponse', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (isMonthlyReportNotification as jest.Mock).mockReturnValue(true);
    (Notifications.useLastNotificationResponse as jest.Mock).mockReturnValue(null);
    (Notifications.addNotificationResponseReceivedListener as jest.Mock).mockReturnValue({ remove: jest.fn() });
  });

  describe('addNotificationResponseReceivedListener の購読', () => {
    it('マウント時に addNotificationResponseReceivedListener を呼ぶ', () => {
      act(() => {
        ReactTestRenderer.create(<HookProbe isReady={false} onOpenMonthlyReport={jest.fn()} />);
      });

      expect(Notifications.addNotificationResponseReceivedListener).toHaveBeenCalledTimes(1);
    });

    it('アンマウント時に subscription.remove を呼ぶ', () => {
      const removeMock = jest.fn();
      (Notifications.addNotificationResponseReceivedListener as jest.Mock).mockReturnValue({ remove: removeMock });

      let renderer: ReturnType<typeof ReactTestRenderer.create>;
      act(() => {
        renderer = ReactTestRenderer.create(<HookProbe isReady={false} onOpenMonthlyReport={jest.fn()} />);
      });

      act(() => {
        renderer.unmount();
      });

      expect(removeMock).toHaveBeenCalledTimes(1);
    });

    it('月次レポート通知タップで isReady=true なら onOpenMonthlyReport を呼ぶ', () => {
      let listener: ((response: Notifications.NotificationResponse) => void) | undefined;
      (Notifications.addNotificationResponseReceivedListener as jest.Mock).mockImplementation((cb) => {
        listener = cb;
        return { remove: jest.fn() };
      });

      const onOpenMonthlyReport = jest.fn();

      act(() => {
        ReactTestRenderer.create(<HookProbe isReady onOpenMonthlyReport={onOpenMonthlyReport} />);
      });

      act(() => {
        listener!(makeNotificationResponse('notif-1'));
      });

      expect(onOpenMonthlyReport).toHaveBeenCalledTimes(1);
    });

    it('月次レポート通知タップで isReady=false なら onOpenMonthlyReport を呼ばない', () => {
      let listener: ((response: Notifications.NotificationResponse) => void) | undefined;
      (Notifications.addNotificationResponseReceivedListener as jest.Mock).mockImplementation((cb) => {
        listener = cb;
        return { remove: jest.fn() };
      });

      const onOpenMonthlyReport = jest.fn();

      act(() => {
        ReactTestRenderer.create(<HookProbe isReady={false} onOpenMonthlyReport={onOpenMonthlyReport} />);
      });

      act(() => {
        listener!(makeNotificationResponse('notif-1'));
      });

      expect(onOpenMonthlyReport).not.toHaveBeenCalled();
    });

    it('月次レポート以外の通知タップでは onOpenMonthlyReport を呼ばない', () => {
      (isMonthlyReportNotification as jest.Mock).mockReturnValue(false);

      let listener: ((response: Notifications.NotificationResponse) => void) | undefined;
      (Notifications.addNotificationResponseReceivedListener as jest.Mock).mockImplementation((cb) => {
        listener = cb;
        return { remove: jest.fn() };
      });

      const onOpenMonthlyReport = jest.fn();

      act(() => {
        ReactTestRenderer.create(<HookProbe isReady onOpenMonthlyReport={onOpenMonthlyReport} />);
      });

      act(() => {
        listener!(makeNotificationResponse('notif-1'));
      });

      expect(onOpenMonthlyReport).not.toHaveBeenCalled();
    });

    it('同じ通知 ID が2回来ても onOpenMonthlyReport は1回しか呼ばれない', () => {
      let listener: ((response: Notifications.NotificationResponse) => void) | undefined;
      (Notifications.addNotificationResponseReceivedListener as jest.Mock).mockImplementation((cb) => {
        listener = cb;
        return { remove: jest.fn() };
      });

      const onOpenMonthlyReport = jest.fn();

      act(() => {
        ReactTestRenderer.create(<HookProbe isReady onOpenMonthlyReport={onOpenMonthlyReport} />);
      });

      act(() => {
        listener!(makeNotificationResponse('notif-dup'));
        listener!(makeNotificationResponse('notif-dup'));
      });

      expect(onOpenMonthlyReport).toHaveBeenCalledTimes(1);
    });
  });

  describe('useLastNotificationResponse 経由の起動時処理', () => {
    it('isReady=true かつ月次レポート通知が残っていれば onOpenMonthlyReport を呼ぶ', () => {
      const response = makeNotificationResponse('launch-notif-1');
      (Notifications.useLastNotificationResponse as jest.Mock).mockReturnValue(response);

      const onOpenMonthlyReport = jest.fn();

      act(() => {
        ReactTestRenderer.create(<HookProbe isReady onOpenMonthlyReport={onOpenMonthlyReport} />);
      });

      expect(onOpenMonthlyReport).toHaveBeenCalledTimes(1);
    });

    it('isReady=false のときは lastNotificationResponse があっても呼ばない', () => {
      const response = makeNotificationResponse('launch-notif-2');
      (Notifications.useLastNotificationResponse as jest.Mock).mockReturnValue(response);

      const onOpenMonthlyReport = jest.fn();

      act(() => {
        ReactTestRenderer.create(<HookProbe isReady={false} onOpenMonthlyReport={onOpenMonthlyReport} />);
      });

      expect(onOpenMonthlyReport).not.toHaveBeenCalled();
    });

    it('isReady が false → true に変わると lastNotificationResponse を処理する', () => {
      const response = makeNotificationResponse('launch-notif-3');
      (Notifications.useLastNotificationResponse as jest.Mock).mockReturnValue(response);

      const onOpenMonthlyReport = jest.fn();
      let renderer: ReturnType<typeof ReactTestRenderer.create>;

      act(() => {
        renderer = ReactTestRenderer.create(<HookProbe isReady={false} onOpenMonthlyReport={onOpenMonthlyReport} />);
      });

      expect(onOpenMonthlyReport).not.toHaveBeenCalled();

      act(() => {
        renderer.update(<HookProbe isReady onOpenMonthlyReport={onOpenMonthlyReport} />);
      });

      expect(onOpenMonthlyReport).toHaveBeenCalledTimes(1);
    });

    it('lastNotificationResponse が null のときは何もしない', () => {
      (Notifications.useLastNotificationResponse as jest.Mock).mockReturnValue(null);

      const onOpenMonthlyReport = jest.fn();

      act(() => {
        ReactTestRenderer.create(<HookProbe isReady onOpenMonthlyReport={onOpenMonthlyReport} />);
      });

      expect(onOpenMonthlyReport).not.toHaveBeenCalled();
    });

    it('月次レポート以外の lastNotificationResponse は無視する', () => {
      (isMonthlyReportNotification as jest.Mock).mockReturnValue(false);
      const response = makeNotificationResponse('other-notif');
      (Notifications.useLastNotificationResponse as jest.Mock).mockReturnValue(response);

      const onOpenMonthlyReport = jest.fn();

      act(() => {
        ReactTestRenderer.create(<HookProbe isReady onOpenMonthlyReport={onOpenMonthlyReport} />);
      });

      expect(onOpenMonthlyReport).not.toHaveBeenCalled();
    });
  });

  describe('onOpenMonthlyReport の最新化', () => {
    it('onOpenMonthlyReport が更新されても通知リスナーは最新の関数を呼ぶ', () => {
      let listener: ((response: Notifications.NotificationResponse) => void) | undefined;
      (Notifications.addNotificationResponseReceivedListener as jest.Mock).mockImplementation((cb) => {
        listener = cb;
        return { remove: jest.fn() };
      });

      const firstCallback = jest.fn();
      const secondCallback = jest.fn();
      let renderer: ReturnType<typeof ReactTestRenderer.create>;

      act(() => {
        renderer = ReactTestRenderer.create(<HookProbe isReady onOpenMonthlyReport={firstCallback} />);
      });

      act(() => {
        renderer.update(<HookProbe isReady onOpenMonthlyReport={secondCallback} />);
      });

      act(() => {
        listener!(makeNotificationResponse('notif-latest'));
      });

      // 最新の secondCallback が呼ばれる
      expect(secondCallback).toHaveBeenCalledTimes(1);
      expect(firstCallback).not.toHaveBeenCalled();
    });
  });
});
