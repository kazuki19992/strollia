import { registerRootComponent } from 'expo';

import { initializeSentry, wrapWithSentry } from './src/config/sentry';
import './src/features/location/backgroundLocationTask';

import App from './App';

initializeSentry();

// registerRootComponent calls AppRegistry.registerComponent('main', () => App);
// It also ensures that whether you load the app in Expo Go or in a native build,
// the environment is set up appropriately
registerRootComponent(wrapWithSentry(App));
