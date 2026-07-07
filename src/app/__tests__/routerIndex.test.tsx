import AppEntry from '@/app/index';

// App コンポーネントの依存をスタブ化し、軽量な View でレンダリングを確認する
jest.mock('@/ui/App', () => {
  const { View } = require('react-native'); // eslint-disable-line @typescript-eslint/no-require-imports
  return { __esModule: true, default: View };
});

const ReactTestRenderer = require('react-test-renderer'); // eslint-disable-line @typescript-eslint/no-require-imports
const { act } = ReactTestRenderer;

describe('expo-router エントリポイント (index)', () => {
  test('default export が存在しレンダリングできること', async () => {
    let renderer: ReturnType<typeof ReactTestRenderer.create>;
    await act(async () => {
      renderer = ReactTestRenderer.create(<AppEntry />);
    });

    expect(renderer!.toJSON()).not.toBeNull();
  });
});
