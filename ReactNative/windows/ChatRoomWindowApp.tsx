import React from 'react';
import { View, StyleSheet } from 'react-native';
import ChatRoomScreen from '../pages/_shared/ChatRoomScreen';

export default function ChatRoomWindowApp(props: { roomId?: string; roomTitle?: string }) {
  return (
    <View style={S.root}>
      <ChatRoomScreen roomId={props?.roomId ?? ''} roomTitle={props?.roomTitle} floating />
    </View>
  );
}

const S = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#FFFFFF' },
});
