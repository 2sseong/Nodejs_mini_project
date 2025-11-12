/**
 * @format
 */

import { AppRegistry } from 'react-native';
import App from './App.tsx';
import { name as appName } from './app.json';
import ChatRoomWindowApp from './windows/ChatRoomWindowApp';

AppRegistry.registerComponent(appName, () => App);

AppRegistry.registerComponent('ChatRoomWindow', () => ChatRoomWindowApp);
