import { useState, useEffect } from 'react';
import { View, Text, Switch, StyleSheet, Alert, Platform } from 'react-native';
import { Stack } from 'expo-router';
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import Constants from 'expo-constants';
import { Colors, Spacing, BorderRadius, FontSize } from '../../constants/theme';

// 푸시 알림 핸들러 설정
Notifications.setNotificationHandler({
    handleNotification: async () => ({
        shouldShowAlert: true,
        shouldPlaySound: true,
        shouldSetBadge: true,
        shouldShowBanner: true,  // iOS 배너 알림 표시
        shouldShowList: true,    // iOS 알림 센터 목록 표시
    }),
});

export default function NotificationSettingsScreen() {
    const [pushEnabled, setPushEnabled] = useState(false);
    const [expoPushToken, setExpoPushToken] = useState('');
    const [permissionStatus, setPermissionStatus] = useState<string>('');

    useEffect(() => {
        checkNotificationPermission();
    }, []);

    const checkNotificationPermission = async () => {
        const { status } = await Notifications.getPermissionsAsync();
        setPermissionStatus(status);
        setPushEnabled(status === 'granted');
    };

    const registerForPushNotifications = async () => {
        if (!Device.isDevice) {
            Alert.alert('알림', '실제 기기에서만 푸시 알림을 사용할 수 있습니다.');
            return null;
        }

        try {
            const { status: existingStatus } = await Notifications.getPermissionsAsync();
            let finalStatus = existingStatus;

            if (existingStatus !== 'granted') {
                const { status } = await Notifications.requestPermissionsAsync();
                finalStatus = status;
            }

            if (finalStatus !== 'granted') {
                Alert.alert('알림', '푸시 알림 권한이 거부되었습니다. 설정에서 권한을 허용해주세요.');
                return null;
            }

            // Expo 푸시 토큰 가져오기
            const projectId = Constants.expoConfig?.extra?.eas?.projectId;
            const token = await Notifications.getExpoPushTokenAsync({
                projectId,
            });

            setExpoPushToken(token.data);
            console.log('Expo Push Token:', token.data);

            // Android 채널 설정
            if (Platform.OS === 'android') {
                await Notifications.setNotificationChannelAsync('default', {
                    name: '기본 알림',
                    importance: Notifications.AndroidImportance.MAX,
                    vibrationPattern: [0, 250, 250, 250],
                    lightColor: '#4B6584',
                });
            }

            return token.data;
        } catch (error) {
            console.error('Push notification registration error:', error);
            Alert.alert('오류', '푸시 알림 등록에 실패했습니다.');
            return null;
        }
    };

    const handleTogglePush = async (value: boolean) => {
        if (value) {
            const token = await registerForPushNotifications();
            if (token) {
                setPushEnabled(true);
                setPermissionStatus('granted');

                // TODO: 서버에 푸시 토큰 등록
                // await registerPushToken(token);

                Alert.alert('알림', '푸시 알림이 활성화되었습니다.');
            }
        } else {
            setPushEnabled(false);
            Alert.alert('알림', '푸시 알림이 비활성화되었습니다. 앱에서 알림을 받지 않습니다.');
        }
    };

    return (
        <>
            <Stack.Screen
                options={{
                    title: '알림 설정',
                    headerStyle: { backgroundColor: Colors.primary },
                    headerTintColor: Colors.textInverse,
                }}
            />
            <View style={styles.container}>
                <View style={styles.section}>
                    <View style={styles.settingItem}>
                        <View style={styles.settingInfo}>
                            <Text style={styles.settingTitle}>푸시 알림</Text>
                            <Text style={styles.settingDescription}>
                                새 메시지가 도착하면 알림을 받습니다.
                            </Text>
                        </View>
                        <Switch
                            value={pushEnabled}
                            onValueChange={handleTogglePush}
                            trackColor={{ false: Colors.borderColor, true: Colors.primaryLight }}
                            thumbColor={pushEnabled ? Colors.primary : Colors.textMuted}
                        />
                    </View>
                </View>

                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>알림 정보</Text>
                    <View style={styles.infoItem}>
                        <Text style={styles.infoLabel}>권한 상태</Text>
                        <Text style={[
                            styles.infoValue,
                            { color: permissionStatus === 'granted' ? Colors.success : Colors.danger }
                        ]}>
                            {permissionStatus === 'granted' ? '허용됨' :
                                permissionStatus === 'denied' ? '거부됨' : '미설정'}
                        </Text>
                    </View>
                    {expoPushToken && (
                        <View style={styles.infoItem}>
                            <Text style={styles.infoLabel}>푸시 토큰</Text>
                            <Text style={styles.tokenText} numberOfLines={1}>
                                {expoPushToken.substring(0, 30)}...
                            </Text>
                        </View>
                    )}
                </View>

                <View style={styles.noteSection}>
                    <Text style={styles.noteText}>
                        💡 각 채팅방별로 알림을 설정하려면 채팅방 설정에서 변경할 수 있습니다.
                    </Text>
                </View>
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
        paddingHorizontal: Spacing.lg,
    },
    sectionTitle: {
        fontSize: FontSize.sm,
        color: Colors.textSecondary,
        marginTop: Spacing.md,
        marginBottom: Spacing.sm,
        fontWeight: '600',
    },
    settingItem: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingVertical: Spacing.lg,
        borderBottomWidth: 1,
        borderBottomColor: Colors.borderColor,
    },
    settingInfo: {
        flex: 1,
        marginRight: Spacing.md,
    },
    settingTitle: {
        fontSize: FontSize.base,
        fontWeight: '600',
        color: Colors.textPrimary,
    },
    settingDescription: {
        fontSize: FontSize.sm,
        color: Colors.textSecondary,
        marginTop: Spacing.xs,
    },
    infoItem: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: Spacing.md,
        borderBottomWidth: 1,
        borderBottomColor: Colors.borderColor,
    },
    infoLabel: {
        fontSize: FontSize.sm,
        color: Colors.textSecondary,
    },
    infoValue: {
        fontSize: FontSize.sm,
        fontWeight: '600',
    },
    tokenText: {
        fontSize: FontSize.xs,
        color: Colors.textMuted,
        maxWidth: 200,
    },
    noteSection: {
        margin: Spacing.lg,
        padding: Spacing.md,
        backgroundColor: Colors.primaryLight,
        borderRadius: BorderRadius.md,
    },
    noteText: {
        fontSize: FontSize.sm,
        color: Colors.primary,
        lineHeight: 20,
    },
});
