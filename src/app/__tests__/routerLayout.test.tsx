import RootLayout from '@/app/_layout';

// expo-router の Slot をスタブ化してレンダリングだけ確認する
jest.mock('expo-router', () => ({
  Slot: 'Slot',
}));

// wrapWithSentry はコンポーネントをそのまま返すスタブ
jest.mock('@/config/sentry', () => ({
  wrapWithSentry: (component: unknown) => component,
}));

const ReactTestRenderer = require('react-test-renderer'); // eslint-disable-line @typescript-eslint/no-require-imports
const { act } = ReactTestRenderer;

describe('expo-router ルートレイアウト (_layout)', () => {
  test('default export が存在しレンダリングできること', async () => {
    let renderer: ReturnType<typeof ReactTestRenderer.create>;
    await act(async () => {
      renderer = ReactTestRenderer.create(<RootLayout />);
    });

    expect(renderer!.toJSON()).not.toBeNull();
  });
});
