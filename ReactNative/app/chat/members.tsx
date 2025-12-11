import { useState, useEffect } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet, ActivityIndicator, Alert } from 'react-native';
import { useLocalSearchParams, router, Stack } from 'expo-router';
import { getRoomMembers, RoomMember } from '../../api/room';
import { Colors, Spacing, BorderRadius, FontSize } from '../../constants/theme';

export default function RoomMembersScreen() {
    const { roomId, roomName } = useLocalSearchParams<{ roomId: string; roomName?: string }>();
    const [members, setMembers] = useState<RoomMember[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        loadMembers();
    }, [roomId]);

    const loadMembers = async () => {
        if (!roomId) return;

        try {
            setIsLoading(true);
            const result = await getRoomMembers(Number(roomId));
            // API가 직접 배열을 반환
            setMembers(Array.isArray(result) ? result : []);
        } catch (error) {
            console.error('Failed to load members:', error);
            Alert.alert('오류', '멤버 목록을 불러오는데 실패했습니다.');
        } finally {
            setIsLoading(false);
        }
    };

    const renderMember = ({ item }: { item: RoomMember }) => (
        <TouchableOpacity style={styles.memberItem}>
            <View style={styles.avatarContainer}>
                <View style={styles.avatar}>
                    <Text style={styles.avatarText}>
                        {item.USER_NICKNAME?.charAt(0) || '?'}
                    </Text>
                </View>
            </View>
            <View style={styles.memberInfo}>
                <Text style={styles.memberName}>{item.USER_NICKNAME}</Text>
                {(item.DEPT_NAME || item.POS_NAME) && (
                    <Text style={styles.memberRole}>
                        {[item.DEPT_NAME, item.POS_NAME].filter(Boolean).join(' · ')}
                    </Text>
                )}
            </View>
        </TouchableOpacity>
    );

    if (isLoading) {
        return (
            <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color={Colors.primary} />
            </View>
        );
    }

    return (
        <>
            <Stack.Screen
                options={{
                    title: `멤버 (${members.length}명)`,
                    headerStyle: { backgroundColor: Colors.primary },
                    headerTintColor: Colors.textInverse,
                    headerLeft: () => (
                        <TouchableOpacity onPress={() => router.back()} style={{ marginLeft: 10 }}>
                            <Text style={{ color: Colors.textInverse, fontSize: 16 }}>← 뒤로</Text>
                        </TouchableOpacity>
                    ),
                    headerRight: () => (
                        <TouchableOpacity
                            onPress={() => router.push({
                                pathname: '/chat/invite',
                                params: { roomId }
                            })}
                            style={{ marginRight: 10 }}
                        >
                            <Text style={{ color: Colors.textInverse, fontSize: 16 }}>+ 초대</Text>
                        </TouchableOpacity>
                    ),
                }}
            />
            <View style={styles.container}>
                <FlatList
                    data={members}
                    renderItem={renderMember}
                    keyExtractor={(item) => String(item.USER_ID)}
                    contentContainerStyle={styles.listContent}
                    ListEmptyComponent={
                        <View style={styles.emptyContainer}>
                            <Text style={styles.emptyText}>멤버가 없습니다.</Text>
                        </View>
                    }
                />
            </View>
        </>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: Colors.bgPage,
    },
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: Colors.bgPage,
    },
    listContent: {
        padding: Spacing.md,
    },
    memberItem: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: Spacing.md,
        backgroundColor: Colors.bgCard,
        borderRadius: BorderRadius.md,
        marginBottom: Spacing.sm,
    },
    avatarContainer: {
        position: 'relative',
    },
    avatar: {
        width: 48,
        height: 48,
        borderRadius: 24,
        backgroundColor: Colors.primary,
        justifyContent: 'center',
        alignItems: 'center',
    },
    avatarOnline: {
        borderWidth: 2,
        borderColor: Colors.success,
    },
    avatarText: {
        color: Colors.textInverse,
        fontWeight: 'bold',
        fontSize: FontSize.lg,
    },
    onlineIndicator: {
        position: 'absolute',
        bottom: 2,
        right: 2,
        width: 12,
        height: 12,
        borderRadius: 6,
        backgroundColor: Colors.success,
        borderWidth: 2,
        borderColor: Colors.bgCard,
    },
    memberInfo: {
        marginLeft: Spacing.md,
        flex: 1,
    },
    memberName: {
        fontSize: FontSize.base,
        fontWeight: '600',
        color: Colors.textPrimary,
    },
    memberRole: {
        fontSize: FontSize.sm,
        color: Colors.textSecondary,
        marginTop: Spacing.xs,
    },
    emptyContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        paddingTop: 100,
    },
    emptyText: {
        color: Colors.textMuted,
        fontSize: FontSize.base,
    },
});
