/**
 * @format
 */

import { AppRegistry } from 'react-native';
import App from './App.tsx';
import { name as appName } from './app.json';
import ChatExternalWindow from './external/chatExternalWindow';

AppRegistry.registerComponent(appName, () => App);
AppRegistry.registerComponent('ChatExternalWindow', () => ChatExternalWindow);

