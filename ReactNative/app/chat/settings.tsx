import { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Alert, Switch } from 'react-native';
import { useLocalSearchParams, router, Stack } from 'expo-router';
import { getNotificationSetting, setNotificationSetting, leaveRoom } from '../../api/room';
import { Colors, Spacing, BorderRadius, FontSize } from '../../constants/theme';
import * as SecureStore from 'expo-secure-store';

export default function ChatSettingsScreen() {
    const { roomId, roomName } = useLocalSearchParams<{ roomId: string; roomName?: string }>();
    const [notificationEnabled, setNotificationEnabled] = useState(true);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        loadSettings();
    }, [roomId]);

    const loadSettings = async () => {
        try {
            const enabled = await getNotificationSetting(Number(roomId));
            setNotificationEnabled(enabled);
        } catch (error) {
            console.error('Load settings error:', error);
        } finally {
            setIsLoading(false);
        }
    };

    const handleNotificationToggle = async (value: boolean) => {
        try {
            setNotificationEnabled(value);
            await setNotificationSetting(Number(roomId), value);
        } catch (error) {
            console.error('Toggle notification error:', error);
            setNotificationEnabled(!value);
            Alert.alert('오류', '알림 설정 변경에 실패했습니다.');
        }
    };

    const handleLeaveRoom = () => {
        Alert.alert(
            '채팅방 나가기',
            '정말 이 채팅방을 나가시겠습니까?\n대화 내용은 더 이상 볼 수 없습니다.',
            [
                { text: '취소', style: 'cancel' },
                {
                    text: '나가기',
                    style: 'destructive',
                    onPress: async () => {
                        try {
                            const userData = await SecureStore.getItemAsync('userData');
                            const user = userData ? JSON.parse(userData) : null;

                            await leaveRoom(Number(roomId), Number(user?.userId), user?.nickname || '');

                            // 채팅방 목록으로 이동
                            router.replace('/(tabs)/rooms');
                        } catch (error: any) {
                            console.error('Leave room error:', error);
                            Alert.alert('오류', error.response?.data?.message || '채팅방 나가기에 실패했습니다.');
                        }
                    }
                }
            ]
        );
    };

    return (
        <>
            <Stack.Screen
                options={{
                    title: '채팅방 설정',
                    headerStyle: { backgroundColor: Colors.primary },
                    headerTintColor: Colors.textInverse,
                    headerLeft: () => (
                        <TouchableOpacity onPress={() => router.back()} style={{ marginLeft: 10 }}>
                            <Text style={{ color: Colors.textInverse, fontSize: 16 }}>← 뒤로</Text>
                        </TouchableOpacity>
                    ),
                }}
            />
            <View style={styles.container}>
                {/* 채팅방 정보 */}
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>채팅방 정보</Text>
                    <View style={styles.infoItem}>
                        <Text style={styles.infoLabel}>채팅방 이름</Text>
                        <Text style={styles.infoValue}>{roomName || '채팅방'}</Text>
                    </View>
                </View>

                {/* 알림 설정 */}
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>알림</Text>
                    <View style={styles.settingItem}>
                        <View style={styles.settingInfo}>
                            <Text style={styles.settingLabel}>알림 받기</Text>
                            <Text style={styles.settingDescription}>
                                새 메시지 알림을 받습니다.
                            </Text>
                        </View>
                        <Switch
                            value={notificationEnabled}
                            onValueChange={handleNotificationToggle}
                            trackColor={{ false: Colors.borderColor, true: Colors.primaryLight }}
                            thumbColor={notificationEnabled ? Colors.primary : Colors.textMuted}
                        />
                    </View>
                </View>

                {/* 바로가기 */}
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>바로가기</Text>
                    <TouchableOpacity
                        style={styles.menuItem}
                        onPress={() => router.push({ pathname: '/chat/members', params: { roomId } })}
                    >
                        <Text style={styles.menuText}>👥 멤버 목록</Text>
                        <Text style={styles.menuArrow}>›</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={styles.menuItem}
                        onPress={() => router.push({ pathname: '/chat/files', params: { roomId } })}
                    >
                        <Text style={styles.menuText}>📁 파일 목록</Text>
                        <Text style={styles.menuArrow}>›</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={styles.menuItem}
                        onPress={() => router.push({ pathname: '/chat/notices', params: { roomId } })}
                    >
                        <Text style={styles.menuText}>📢 공지사항</Text>
                        <Text style={styles.menuArrow}>›</Text>
                    </TouchableOpacity>
                </View>

                {/* 채팅방 나가기 */}
                <TouchableOpacity style={styles.leaveButton} onPress={handleLeaveRoom}>
                    <Text style={styles.leaveButtonText}>채팅방 나가기</Text>
                </TouchableOpacity>
            </View>
        </>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: Colors.bgPage,
    },
    section: {
        backgroundColor: Colors.bgCard,
        marginTop: Spacing.md,
    },
    sectionTitle: {
        fontSize: FontSize.sm,
        color: Colors.textSecondary,
        padding: Spacing.md,
        paddingBottom: Spacing.sm,
        fontWeight: '600',
    },
    infoItem: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: Spacing.md,
        borderTopWidth: 1,
        borderTopColor: Colors.borderColor,
    },
    infoLabel: {
        fontSize: FontSize.base,
        color: Colors.textSecondary,
    },
    infoValue: {
        fontSize: FontSize.base,
        color: Colors.textPrimary,
        fontWeight: '600',
    },
    settingItem: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: Spacing.md,
        borderTopWidth: 1,
        borderTopColor: Colors.borderColor,
    },
    settingInfo: {
        flex: 1,
        marginRight: Spacing.md,
    },
    settingLabel: {
        fontSize: FontSize.base,
        color: Colors.textPrimary,
        fontWeight: '600',
    },
    settingDescription: {
        fontSize: FontSize.sm,
        color: Colors.textSecondary,
        marginTop: Spacing.xs,
    },
    menuItem: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: Spacing.md,
        borderTopWidth: 1,
        borderTopColor: Colors.borderColor,
    },
    menuText: {
        fontSize: FontSize.base,
        color: Colors.textPrimary,
    },
    menuArrow: {
        fontSize: FontSize.xl,
        color: Colors.textMuted,
    },
    leaveButton: {
        margin: Spacing.lg,
        padding: Spacing.md,
        backgroundColor: Colors.dangerLight,
        borderRadius: BorderRadius.md,
        alignItems: 'center',
    },
    leaveButtonText: {
        color: Colors.danger,
        fontSize: FontSize.base,
        fontWeight: '600',
    },
});
