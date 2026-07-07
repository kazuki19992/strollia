import { AppCompatShell } from './AppCompatShell';
import { AppStateProvider } from './state/AppStateProvider';

/**
 * Strolliaのルートコンポーネント。
 *
 * AppStateProvider でフック結線・全状態を管理し、
 * AppCompatShell が screenMode ベースの旧レンダリング構造を担う。
 *
 * expo-router 移行の段階A互換維持層。
 * テストは引き続きこのコンポーネントを直接レンダリングできる。
 */
export default function App() {
  return (
    <AppStateProvider>
      <AppCompatShell />
    </AppStateProvider>
  );
}
