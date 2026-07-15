import { initializeSentry } from './src/config/sentry';
import './src/features/location/backgroundLocationTask';

initializeSentry();

// expo-router がルートレイアウト経由でアプリを起動する。
// registerRootComponent は expo-router/entry 内部で呼ばれる。
import 'expo-router/entry';
