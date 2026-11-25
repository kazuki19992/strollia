import { fireEvent, render, screen } from '@testing-library/react-native';

import { ANNUAL_REPORT_AGGREGATING_DIALOG_MESSAGE, ANNUAL_REPORT_AGGREGATING_DIALOG_TITLE } from '@/ui/appText';
import { AnnualReportAggregatingDialog } from '@/ui/components/AnnualReportAggregatingDialog';

jest.mock('@expo/vector-icons', () => ({
  MaterialCommunityIcons: require('react-native').Text,
}));

const styles = new Proxy({}, { get: (_target, prop) => prop });

describe('年間レポート集計中の案内 AnnualReportAggregatingDialog', () => {
  test('文言は「集計中...」と3行の本文', () => {
    expect(ANNUAL_REPORT_AGGREGATING_DIALOG_TITLE).toBe('集計中...');
    expect(ANNUAL_REPORT_AGGREGATING_DIALOG_MESSAGE).toBe(
      '今年のあしあとをふりかえっています！\nもう少しお待ちください！\n準備ができたら通知でお知らせします',
    );
  });

  test('非表示のときは文言を描画しない', async () => {
    await render(<AnnualReportAggregatingDialog visible={false} styles={styles as never} onClose={jest.fn()} />);

    expect(screen.queryByText(ANNUAL_REPORT_AGGREGATING_DIALOG_TITLE)).toBeNull();
  });

  test('表示中はタイトル・本文とスワイプで閉じるヒントを出す', async () => {
    await render(<AnnualReportAggregatingDialog visible styles={styles as never} onClose={jest.fn()} />);

    expect(screen.getByText(ANNUAL_REPORT_AGGREGATING_DIALOG_TITLE)).toBeTruthy();
    expect(screen.getByText(ANNUAL_REPORT_AGGREGATING_DIALOG_MESSAGE)).toBeTruthy();
    expect(screen.getByText('スワイプで閉じる')).toBeTruthy();
  });

  test('閉じるボタンで閉じる操作を呼ぶ', async () => {
    jest.useFakeTimers();
    const onClose = jest.fn();
    await render(<AnnualReportAggregatingDialog visible styles={styles as never} onClose={onClose} />);

    await fireEvent.press(screen.getByLabelText('閉じる'));
    jest.runAllTimers();

    expect(onClose).toHaveBeenCalledTimes(1);
    jest.useRealTimers();
  });
});
