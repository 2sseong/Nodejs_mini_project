/* eslint-disable react-native/no-inline-styles */
// /external/ChatExternalWindow.tsx
import React from 'react';
import { SafeAreaView, Text, View, StyleSheet } from 'react-native';

export default function ChatExternalWindow(props: any) {
  const roomId = props?.roomId;
  const title = props?.roomName ?? `방 ${roomId}`;
  return (
    <SafeAreaView style={S.safe}>
      <View style={S.header}><Text style={S.title}>{title}</Text></View>
      {/* 여기서 roomId만 받아 그 방의 채팅 화면을 렌더링하거나, 최소 버전으로 메시지 UI를 구성 */}
      <View style={{ padding: 16 }}><Text>외부창 - Room: {roomId}</Text></View>
    </SafeAreaView>
  );
}
const S = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#fff' },
  header: { height: 48, paddingHorizontal: 12, justifyContent: 'center', borderBottomWidth: 1, borderBottomColor: '#eee' },
  title: { fontSize: 16, fontWeight: '800' },
});
