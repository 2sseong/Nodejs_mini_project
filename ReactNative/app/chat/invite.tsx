import { useState, useEffect } from 'react';
import { View, Text, TextInput, FlatList, TouchableOpacity, StyleSheet, ActivityIndicator, Alert } from 'react-native';
import { useLocalSearchParams, router, Stack } from 'expo-router';
import { searchUsers, User } from '../../api/users';
import { inviteToRoom } from '../../api/room';
import { Colors, Spacing, BorderRadius, FontSize } from '../../constants/theme';

export default function InviteScreen() {
    const { roomId } = useLocalSearchParams<{ roomId: string }>();
    const [searchQuery, setSearchQuery] = useState('');
    const [users, setUsers] = useState<User[]>([]);
    const [selectedUsers, setSelectedUsers] = useState<string[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [isInviting, setIsInviting] = useState(false);

    useEffect(() => {
        if (searchQuery.trim().length >= 1) {
            const timer = setTimeout(() => {
                handleSearch();
            }, 300);
            return () => clearTimeout(timer);
        } else {
            setUsers([]);
        }
    }, [searchQuery]);

    const handleSearch = async () => {
        if (!searchQuery.trim()) return;

        try {
            setIsLoading(true);
            const users = await searchUsers(searchQuery);
            setUsers(users || []);
        } catch (error) {
            console.error('Search error:', error);
        } finally {
            setIsLoading(false);
        }
    };

    const toggleUserSelection = (userId: string) => {
        setSelectedUsers(prev =>
            prev.includes(userId)
                ? prev.filter(id => id !== userId)
                : [...prev, userId]
        );
    };

    const handleInvite = async () => {
        if (!roomId || selectedUsers.length === 0) {
            Alert.alert('알림', '초대할 사용자를 선택해주세요.');
            return;
        }

        try {
            setIsInviting(true);
            await inviteToRoom(Number(roomId), selectedUsers);
            Alert.alert('성공', '사용자를 초대했습니다.', [
                { text: '확인', onPress: () => router.back() }
            ]);
        } catch (error: any) {
            console.error('Invite error:', error);
            Alert.alert('오류', error.response?.data?.message || '초대에 실패했습니다.');
        } finally {
            setIsInviting(false);
        }
    };

    const renderUser = ({ item }: { item: User }) => {
        const isSelected = selectedUsers.includes(item.USER_ID);

        return (
            <TouchableOpacity
                style={[styles.userItem, isSelected && styles.userItemSelected]}
                onPress={() => toggleUserSelection(item.USER_ID)}
            >
                <View style={styles.avatar}>
                    <Text style={styles.avatarText}>
                        {(item.NICKNAME || item.USER_NICKNAME)?.charAt(0) || '?'}
                    </Text>
                </View>
                <View style={styles.userInfo}>
                    <Text style={styles.userName}>{item.NICKNAME || item.USER_NICKNAME}</Text>
                    {(item.DEPT_NAME || item.POSITION_NAME || item.POS_NAME) && (
                        <Text style={styles.userRole}>
                            {[item.DEPT_NAME, item.POSITION_NAME || item.POS_NAME].filter(Boolean).join(' · ')}
                        </Text>
                    )}
                </View>
                <View style={[styles.checkbox, isSelected && styles.checkboxSelected]}>
                    {isSelected && <Text style={styles.checkmark}>✓</Text>}
                </View>
            </TouchableOpacity>
        );
    };

    return (
        <>
            <Stack.Screen
                options={{
                    title: '사용자 초대',
                    headerStyle: { backgroundColor: Colors.primary },
                    headerTintColor: Colors.textInverse,
                    headerLeft: () => (
                        <TouchableOpacity onPress={() => router.back()} style={{ marginLeft: 10 }}>
                            <Text style={{ color: Colors.textInverse, fontSize: 16 }}>← 취소</Text>
                        </TouchableOpacity>
                    ),
                }}
            />
            <View style={styles.container}>
                {/* 검색창 */}
                <View style={styles.searchContainer}>
                    <TextInput
                        style={styles.searchInput}
                        value={searchQuery}
                        onChangeText={setSearchQuery}
                        placeholder="이름으로 검색..."
                        placeholderTextColor={Colors.textMuted}
                    />
                </View>

                {/* 선택된 사용자 표시 */}
                {selectedUsers.length > 0 && (
                    <View style={styles.selectedContainer}>
                        <Text style={styles.selectedText}>
                            {selectedUsers.length}명 선택됨
                        </Text>
                    </View>
                )}

                {/* 사용자 목록 */}
                {isLoading ? (
                    <ActivityIndicator style={{ marginTop: 40 }} color={Colors.primary} />
                ) : (
                    <FlatList
                        data={users}
                        renderItem={renderUser}
                        keyExtractor={(item) => String(item.USER_ID)}
                        contentContainerStyle={styles.listContent}
                        ListEmptyComponent={
                            searchQuery.trim() ? (
                                <View style={styles.emptyContainer}>
                                    <Text style={styles.emptyText}>검색 결과가 없습니다.</Text>
                                </View>
                            ) : (
                                <View style={styles.emptyContainer}>
                                    <Text style={styles.emptyText}>이름을 검색해주세요.</Text>
                                </View>
                            )
                        }
                    />
                )}

                {/* 초대 버튼 */}
                <TouchableOpacity
                    style={[styles.inviteButton, selectedUsers.length === 0 && styles.inviteButtonDisabled]}
                    onPress={handleInvite}
                    disabled={selectedUsers.length === 0 || isInviting}
                >
                    {isInviting ? (
                        <ActivityIndicator color={Colors.textInverse} />
                    ) : (
                        <Text style={styles.inviteButtonText}>
                            {selectedUsers.length > 0 ? `${selectedUsers.length}명 초대하기` : '사용자를 선택하세요'}
                        </Text>
                    )}
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
    searchContainer: {
        padding: Spacing.md,
        backgroundColor: Colors.bgCard,
        borderBottomWidth: 1,
        borderBottomColor: Colors.borderColor,
    },
    searchInput: {
        backgroundColor: Colors.bgInput,
        borderWidth: 1,
        borderColor: Colors.borderColor,
        borderRadius: BorderRadius.md,
        paddingHorizontal: Spacing.md,
        paddingVertical: Spacing.sm,
        fontSize: FontSize.base,
        color: Colors.textPrimary,
    },
    selectedContainer: {
        padding: Spacing.md,
        backgroundColor: Colors.primaryLight,
    },
    selectedText: {
        color: Colors.primary,
        fontWeight: '600',
    },
    listContent: {
        padding: Spacing.md,
    },
    userItem: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: Spacing.md,
        backgroundColor: Colors.bgCard,
        borderRadius: BorderRadius.md,
        marginBottom: Spacing.sm,
    },
    userItemSelected: {
        backgroundColor: Colors.primaryLight,
        borderColor: Colors.primary,
        borderWidth: 1,
    },
    avatar: {
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: Colors.primary,
        justifyContent: 'center',
        alignItems: 'center',
    },
    avatarText: {
        color: Colors.textInverse,
        fontWeight: 'bold',
        fontSize: FontSize.base,
    },
    userInfo: {
        marginLeft: Spacing.md,
        flex: 1,
    },
    userName: {
        fontSize: FontSize.base,
        fontWeight: '600',
        color: Colors.textPrimary,
    },
    userRole: {
        fontSize: FontSize.sm,
        color: Colors.textSecondary,
        marginTop: Spacing.xs,
    },
    checkbox: {
        width: 24,
        height: 24,
        borderRadius: 12,
        borderWidth: 2,
        borderColor: Colors.borderColor,
        justifyContent: 'center',
        alignItems: 'center',
    },
    checkboxSelected: {
        backgroundColor: Colors.primary,
        borderColor: Colors.primary,
    },
    checkmark: {
        color: Colors.textInverse,
        fontWeight: 'bold',
    },
    emptyContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        paddingTop: 60,
    },
    emptyText: {
        color: Colors.textMuted,
        fontSize: FontSize.base,
    },
    inviteButton: {
        margin: Spacing.md,
        backgroundColor: Colors.primary,
        borderRadius: BorderRadius.lg,
        paddingVertical: Spacing.md,
        alignItems: 'center',
    },
    inviteButtonDisabled: {
        backgroundColor: Colors.textMuted,
    },
    inviteButtonText: {
        color: Colors.textInverse,
        fontWeight: 'bold',
        fontSize: FontSize.base,
    },
});
