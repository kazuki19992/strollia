import { Alert } from 'react-native';
import { shareViewAsPng } from '@/features/export/capturedViewShare';

const mockIsAvailableAsync = jest.fn();
const mockShareAsync = jest.fn();
jest.mock('expo-sharing', () => ({
  isAvailableAsync: (...args: unknown[]) => mockIsAvailableAsync(...args),
  shareAsync: (...args: unknown[]) => mockShareAsync(...args),
}));

const mockCaptureRef = jest.fn();
jest.mock('react-native-view-shot', () => ({
  captureRef: (...args: unknown[]) => mockCaptureRef(...args),
}));

/** 有効な View ref を模倣する最小スタブ。 */
function makeViewRef(value: object | null = {}) {
  return { current: value } as React.RefObject<any>;
}

describe('capturedViewShare shareViewAsPng', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
    mockIsAvailableAsync.mockResolvedValue(true);
    mockShareAsync.mockResolvedValue(undefined);
    mockCaptureRef.mockResolvedValue('file:///tmp/capture.png');
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('正常系', () => {
    it('captureRef と shareAsync が呼ばれる', async () => {
      await shareViewAsPng(makeViewRef(), {
        dialogTitle: 'すとろりあ 実績',
        errorFallbackMessage: '共有できませんでした。',
      });

      expect(mockCaptureRef).toHaveBeenCalledWith(expect.anything(), { format: 'png', quality: 1, result: 'tmpfile' });
      expect(mockShareAsync).toHaveBeenCalledWith(
        'file:///tmp/capture.png',
        expect.objectContaining({ dialogTitle: 'すとろりあ 実績', mimeType: 'image/png', UTI: 'public.png' }),
      );
      expect(Alert.alert).not.toHaveBeenCalled();
    });

    it('captureOptions を指定すると上書きされる', async () => {
      await shareViewAsPng(makeViewRef(), {
        dialogTitle: 'タイトル',
        errorFallbackMessage: 'エラー',
        captureOptions: { format: 'jpg', quality: 0.8, result: 'tmpfile' },
      });

      expect(mockCaptureRef).toHaveBeenCalledWith(expect.anything(), { format: 'jpg', quality: 0.8, result: 'tmpfile' });
    });

    it('onBeforeCapture を指定すると captureRef より前に実行される', async () => {
      const order: string[] = [];
      const onBeforeCapture = jest.fn().mockImplementation(async () => {
        order.push('before');
      });
      mockCaptureRef.mockImplementation(async () => {
        order.push('capture');
        return 'file:///tmp/x.png';
      });

      await shareViewAsPng(makeViewRef(), {
        dialogTitle: 'タイトル',
        errorFallbackMessage: 'エラー',
        onBeforeCapture,
      });

      expect(order).toEqual(['before', 'capture']);
    });

    it('onFinally を指定すると処理完了後に呼ばれる', async () => {
      const onFinally = jest.fn();

      await shareViewAsPng(makeViewRef(), {
        dialogTitle: 'タイトル',
        errorFallbackMessage: 'エラー',
        onFinally,
      });

      expect(onFinally).toHaveBeenCalledTimes(1);
    });

    it('エラーが発生しても onFinally が呼ばれる', async () => {
      const onFinally = jest.fn();
      mockCaptureRef.mockRejectedValue(new Error('キャプチャ失敗'));

      await shareViewAsPng(makeViewRef(), {
        dialogTitle: 'タイトル',
        errorFallbackMessage: 'フォールバック',
        onFinally,
      });

      expect(onFinally).toHaveBeenCalledTimes(1);
    });
  });

  describe('共有不可（isAvailableAsync が false）', () => {
    it('captureRef を呼ばず「共有できません」のアラートを表示する', async () => {
      mockIsAvailableAsync.mockResolvedValueOnce(false);

      await shareViewAsPng(makeViewRef(), {
        dialogTitle: 'タイトル',
        errorFallbackMessage: 'エラー',
      });

      expect(mockCaptureRef).not.toHaveBeenCalled();
      expect(mockShareAsync).not.toHaveBeenCalled();
      expect(Alert.alert).toHaveBeenCalledWith('共有できません', 'この環境では共有シートを利用できません。');
    });
  });

  describe('エラー発生時', () => {
    it('captureRef がエラーを投げると「共有失敗」アラートにエラーメッセージを表示する', async () => {
      mockCaptureRef.mockRejectedValue(new Error('キャプチャに失敗しました'));

      await shareViewAsPng(makeViewRef(), {
        dialogTitle: 'タイトル',
        errorFallbackMessage: 'フォールバック',
      });

      expect(Alert.alert).toHaveBeenCalledWith('共有失敗', 'キャプチャに失敗しました');
    });

    it('エラーが Error インスタンスでない場合はフォールバックメッセージを表示する', async () => {
      mockCaptureRef.mockRejectedValue('文字列エラー');

      await shareViewAsPng(makeViewRef(), {
        dialogTitle: 'タイトル',
        errorFallbackMessage: '共有に失敗しました。',
      });

      expect(Alert.alert).toHaveBeenCalledWith('共有失敗', '共有に失敗しました。');
    });

    it('shareAsync がエラーを投げると「共有失敗」アラートを表示する', async () => {
      mockShareAsync.mockRejectedValue(new Error('共有シートエラー'));

      await shareViewAsPng(makeViewRef(), {
        dialogTitle: 'タイトル',
        errorFallbackMessage: 'フォールバック',
      });

      expect(Alert.alert).toHaveBeenCalledWith('共有失敗', '共有シートエラー');
    });
  });

  describe('中断判定（shouldAbort）', () => {
    it('onBeforeCapture 完了後に shouldAbort が true を返すと captureRef を呼ばない', async () => {
      let aborted = false;
      const onBeforeCapture = jest.fn().mockImplementation(async () => {
        aborted = true;
      });

      await shareViewAsPng(makeViewRef(), {
        dialogTitle: 'タイトル',
        errorFallbackMessage: 'エラー',
        onBeforeCapture,
        shouldAbort: () => aborted,
      });

      expect(mockIsAvailableAsync).not.toHaveBeenCalled();
      expect(mockCaptureRef).not.toHaveBeenCalled();
      expect(mockShareAsync).not.toHaveBeenCalled();
    });

    it('captureRef 完了後に shouldAbort が true を返すと shareAsync を呼ばない', async () => {
      let captureCount = 0;
      mockCaptureRef.mockImplementation(async () => {
        captureCount += 1;
        return 'file:///tmp/x.png';
      });

      await shareViewAsPng(makeViewRef(), {
        dialogTitle: 'タイトル',
        errorFallbackMessage: 'エラー',
        // captureRef 完了後（2回目の shouldAbort 判定）でのみ true を返す
        shouldAbort: () => captureCount >= 1,
      });

      expect(mockCaptureRef).toHaveBeenCalledTimes(1);
      expect(mockShareAsync).not.toHaveBeenCalled();
    });

    it('shouldAbort が true のときエラーが起きてもアラートを表示しない', async () => {
      mockCaptureRef.mockRejectedValue(new Error('エラー'));

      await shareViewAsPng(makeViewRef(), {
        dialogTitle: 'タイトル',
        errorFallbackMessage: 'フォールバック',
        shouldAbort: () => true,
      });

      expect(Alert.alert).not.toHaveBeenCalled();
    });
  });

  describe('viewRef が null の場合', () => {
    it('viewRef.current が null なら captureRef を呼ばない', async () => {
      await shareViewAsPng(makeViewRef(null), {
        dialogTitle: 'タイトル',
        errorFallbackMessage: 'エラー',
      });

      expect(mockCaptureRef).not.toHaveBeenCalled();
      expect(mockShareAsync).not.toHaveBeenCalled();
    });
  });
});
