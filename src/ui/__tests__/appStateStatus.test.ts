import { resolveAppStateStatus } from '@/ui/appStateStatus';

describe('アプリ状態の解決 resolveAppStateStatus', () => {
  it.each(['active', 'background', 'inactive', 'extension', 'unknown'] as const)('既知の状態 %s はそのまま返す', (state) => {
    expect(resolveAppStateStatus(state)).toBe(state);
  });

  it.each([null, undefined, '', 'suspended'])('未取得や未知の値 %p は unknown として扱う', (state) => {
    expect(resolveAppStateStatus(state)).toBe('unknown');
  });
});
