/**
 * @format
 */

import { AppRegistry } from 'react-native';
import App from './App.tsx';
import { name as appName } from './app.json';
import ChatExternalWindow from './external/chatExternalWindow';  //보조창 추가하려고 함

AppRegistry.registerComponent(appName, () => App);
AppRegistry.registerComponent('ChatExternalWindow', () => ChatExternalWindow); //보조창 추가하려고 함

