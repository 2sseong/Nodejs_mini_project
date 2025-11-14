import { NativeModules } from 'react-native';
const Native = NativeModules.ChatWindowManager as { open?: (roomId: string, title?: string) => Promise<boolean> };
export function openExternalChat(roomId: string, roomName?: string) {
  if (typeof Native?.open !== 'function') return Promise.resolve(false);
  return Native.open(String(roomId), String(roomName ?? '채팅')).then(Boolean).catch(() => false);
}

import { DeviceEventEmitter } from 'react-native';
DeviceEventEmitter.addListener('ChatWindowOpened', p => console.log('OPENED', p));
DeviceEventEmitter.addListener('ChatWindowClosed', p => console.log('CLOSED', p));