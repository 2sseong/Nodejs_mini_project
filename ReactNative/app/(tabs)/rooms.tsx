import { useEffect, useState, useCallback } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet, RefreshControl, ActivityIndicator } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { Room } from '../../api/room';
import { Colors, Spacing, BorderRadius, FontSize } from '../../constants/theme';
import { createSocket, getSocket } from '../../utils/socket';
import * as SecureStore from 'expo-secure-store';

export default function RoomsScreen() {
    const [rooms, setRooms] = useState<Room[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);

    const fetchRooms = useCallback(async () => {
        try {
            let socket = getSocket();

            if (!socket || !socket.connected) {
                socket = await createSocket();
            }

            if (!socket) {
                console.error('[Rooms] Socket not available');
                setIsLoading(false);
                return;
            }

            const userDataStr = await SecureStore.getItemAsync('userData');
            const tokenStr = await SecureStore.getItemAsync('authToken');

            if (!userDataStr || !tokenStr) {
                console.error('[Rooms] No user data or token');
                setIsLoading(false);
                return;
            }

            const userData = JSON.parse(userDataStr);

            // 채팅방 목록 요청 (Socket.io)
            console.log('[Rooms] Fetching rooms via socket...');
            socket.emit('rooms:fetch', {
                userId: userData.userId,
                authToken: tokenStr
            });

            // 응답 리스너 (한 번만 등록)
            const handleRoomsList = (roomsList: Room[]) => {
                console.log('[Rooms] Received rooms:', roomsList?.length);
                setRooms(roomsList || []);
                setIsLoading(false);
                setRefreshing(false);
            };

            // 기존 리스너 제거 후 등록
            socket.off('rooms:list');
            socket.on('rooms:list', handleRoomsList);

        } catch (error) {
            console.error('[Rooms] Error fetching rooms:', error);
            setIsLoading(false);
            setRefreshing(false);
        }
    }, []);

    // 화면에 포커스될 때마다 새로고침
    useFocusEffect(
        useCallback(() => {
            fetchRooms();
        }, [fetchRooms])
    );

    const onRefresh = useCallback(async () => {
        setRefreshing(true);
        await fetchRooms();
    }, [fetchRooms]);

    const formatTime = (dateString: string | undefined) => {
        if (!dateString) return '';
        const date = new Date(dateString);
        const now = new Date();

        // 오늘이면 시간만 표시
        if (date.toDateString() === now.toDateString()) {
            return date.toLocaleTimeString('ko-KR', {
                hour: '2-digit',
                minute: '2-digit',
            });
        }

        // 어제 또는 이전이면 날짜 표시
        return date.toLocaleDateString('ko-KR', {
            month: 'short',
            day: 'numeric',
        });
    };

    const renderRoom = ({ item }: { item: Room }) => (
        <TouchableOpacity
            style={styles.roomItem}
            onPress={() => router.push(`/chat/${item.ROOM_ID}`)}
        >
            <View style={styles.roomAvatar}>
                <Text style={styles.avatarText}>
                    {item.ROOM_NAME?.charAt(0) || '?'}
                </Text>
            </View>
            <View style={styles.roomInfo}>
                <View style={styles.roomHeader}>
                    <Text style={styles.roomName} numberOfLines={1}>
                        {item.ROOM_NAME}
                    </Text>
                    {item.LAST_MSG_DATE && (
                        <Text style={styles.lastTime}>
                            {formatTime(item.LAST_MSG_DATE)}
                        </Text>
                    )}
                </View>
                <View style={styles.roomFooter}>
                    <Text style={styles.lastMessage} numberOfLines={1}>
                        {item.LAST_MESSAGE || '대화 없음'}
                    </Text>
                    {item.UNREAD_COUNT && item.UNREAD_COUNT > 0 ? (
                        <View style={styles.unreadBadge}>
                            <Text style={styles.unreadText}>
                                {item.UNREAD_COUNT > 99 ? '99+' : item.UNREAD_COUNT}
                            </Text>
                        </View>
                    ) : null}
                </View>
            </View>
        </TouchableOpacity>
    );

    if (isLoading) {
        return (
            <View style={styles.centered}>
                <ActivityIndicator size="large" color={Colors.primary} />
                <Text style={styles.loadingText}>채팅방 불러오는 중...</Text>
            </View>
        );
    }

    return (
        <View style={styles.container}>
            {rooms.length === 0 ? (
                <View style={styles.centered}>
                    <Text style={styles.emptyIcon}>💬</Text>
                    <Text style={styles.emptyText}>참여 중인 채팅방이 없습니다</Text>
                    <TouchableOpacity style={styles.refreshButton} onPress={onRefresh}>
                        <Text style={styles.refreshText}>새로고침</Text>
                    </TouchableOpacity>
                </View>
            ) : (
                <FlatList
                    data={rooms}
                    renderItem={renderRoom}
                    keyExtractor={(item) => String(item.ROOM_ID)}
                    refreshControl={
                        <RefreshControl
                            refreshing={refreshing}
                            onRefresh={onRefresh}
                            colors={[Colors.primary]}
                            tintColor={Colors.primary}
                        />
                    }
                    ItemSeparatorComponent={() => <View style={styles.separator} />}
                />
            )}

            {/* 채팅방 생성 FAB 버튼 */}
            <TouchableOpacity
                style={styles.fab}
                onPress={() => router.push('/chat/create')}
            >
                <Text style={styles.fabText}>+</Text>
            </TouchableOpacity>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: Colors.bgPage,
    },
    centered: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: Spacing.xl,
    },
    loadingText: {
        color: Colors.textSecondary,
        fontSize: FontSize.base,
        marginTop: Spacing.md,
    },
    emptyIcon: {
        fontSize: 60,
        marginBottom: Spacing.md,
    },
    emptyText: {
        color: Colors.textMuted,
        fontSize: FontSize.lg,
        marginBottom: Spacing.lg,
    },
    refreshButton: {
        backgroundColor: Colors.primary,
        paddingHorizontal: Spacing.xl,
        paddingVertical: Spacing.md,
        borderRadius: BorderRadius.md,
    },
    refreshText: {
        color: Colors.textInverse,
        fontSize: FontSize.base,
        fontWeight: '600',
    },
    roomItem: {
        flexDirection: 'row',
        padding: Spacing.lg,
        backgroundColor: Colors.bgCard,
        alignItems: 'center',
    },
    roomAvatar: {
        width: 50,
        height: 50,
        borderRadius: 25,
        backgroundColor: Colors.primary,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: Spacing.md,
    },
    avatarText: {
        color: Colors.textInverse,
        fontSize: FontSize.xl,
        fontWeight: 'bold',
    },
    roomInfo: {
        flex: 1,
    },
    roomHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: Spacing.xs,
    },
    roomName: {
        fontSize: FontSize.lg,
        fontWeight: '600',
        color: Colors.textPrimary,
        flex: 1,
        marginRight: Spacing.sm,
    },
    lastTime: {
        fontSize: FontSize.xs,
        color: Colors.textMuted,
    },
    roomFooter: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    lastMessage: {
        fontSize: FontSize.sm,
        color: Colors.textSecondary,
        flex: 1,
        marginRight: Spacing.sm,
    },
    unreadBadge: {
        backgroundColor: Colors.danger,
        borderRadius: BorderRadius.full,
        paddingHorizontal: Spacing.sm,
        paddingVertical: Spacing.xs,
        minWidth: 20,
        alignItems: 'center',
    },
    unreadText: {
        color: Colors.textInverse,
        fontSize: FontSize.xs,
        fontWeight: 'bold',
    },
    separator: {
        height: 1,
        backgroundColor: Colors.borderColor,
    },
    fab: {
        position: 'absolute',
        right: Spacing.lg,
        bottom: Spacing.lg,
        width: 56,
        height: 56,
        borderRadius: 28,
        backgroundColor: Colors.primary,
        justifyContent: 'center',
        alignItems: 'center',
        elevation: 5,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.25,
        shadowRadius: 4,
    },
    fabText: {
        color: Colors.textInverse,
        fontSize: 28,
        fontWeight: 'bold',
    },
});
