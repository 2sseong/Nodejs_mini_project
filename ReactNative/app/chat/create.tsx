import { useState, useEffect } from 'react';
import { View, Text, TextInput, FlatList, TouchableOpacity, StyleSheet, ActivityIndicator, Alert } from 'react-native';
import { router, Stack } from 'expo-router';
import { searchUsers, User } from '../../api/users';
import { createRoom } from '../../api/room';
import { Colors, Spacing, BorderRadius, FontSize } from '../../constants/theme';

export default function CreateRoomScreen() {
    const [roomName, setRoomName] = useState('');
    const [searchQuery, setSearchQuery] = useState('');
    const [users, setUsers] = useState<User[]>([]);
    const [selectedUsers, setSelectedUsers] = useState<User[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [isCreating, setIsCreating] = useState(false);

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
            const results = await searchUsers(searchQuery);
            // 이미 선택된 사용자 제외
            const selectedIds = new Set(selectedUsers.map(u => u.USER_ID));
            const filtered = results.filter((u: User) => !selectedIds.has(u.USER_ID));
            setUsers(filtered);
        } catch (error) {
            console.error('Search error:', error);
        } finally {
            setIsLoading(false);
        }
    };

    const addUser = (user: User) => {
        setSelectedUsers(prev => [...prev, user]);
        setUsers(prev => prev.filter(u => u.USER_ID !== user.USER_ID));
        setSearchQuery('');
    };

    const removeUser = (userId: string) => {
        setSelectedUsers(prev => prev.filter(u => u.USER_ID !== userId));
    };

    const handleCreate = async () => {
        if (!roomName.trim()) {
            Alert.alert('알림', '채팅방 이름을 입력해주세요.');
            return;
        }
        if (selectedUsers.length === 0) {
            Alert.alert('알림', '최소 1명의 참여자를 추가해주세요.');
            return;
        }

        try {
            setIsCreating(true);
            const memberIds = selectedUsers.map(u => u.USER_ID);
            const response = await createRoom(roomName.trim(), memberIds);

            Alert.alert('성공', '채팅방이 생성되었습니다.', [
                {
                    text: '확인',
                    onPress: () => {
                        router.back();
                        // 생성된 방으로 이동
                        if (response.data?.roomId) {
                            setTimeout(() => {
                                router.push({
                                    pathname: '/chat/[roomId]',
                                    params: { roomId: response.data.roomId, roomName: roomName.trim() }
                                });
                            }, 100);
                        }
                    }
                }
            ]);
        } catch (error: any) {
            console.error('Create room error:', error);
            Alert.alert('오류', error.response?.data?.message || '채팅방 생성에 실패했습니다.');
        } finally {
            setIsCreating(false);
        }
    };

    const renderSelectedUser = ({ item }: { item: User }) => (
        <View style={styles.selectedUserChip}>
            <Text style={styles.selectedUserName}>{item.NICKNAME || item.USER_NICKNAME}</Text>
            <TouchableOpacity onPress={() => removeUser(item.USER_ID)}>
                <Text style={styles.removeButton}>✕</Text>
            </TouchableOpacity>
        </View>
    );

    const renderSearchResult = ({ item }: { item: User }) => (
        <TouchableOpacity
            style={styles.userItem}
            onPress={() => addUser(item)}
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
            <Text style={styles.addButton}>+ 추가</Text>
        </TouchableOpacity>
    );

    return (
        <>
            <Stack.Screen
                options={{
                    title: '새 채팅방',
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
                {/* 채팅방 이름 */}
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>채팅방 이름</Text>
                    <TextInput
                        style={styles.roomNameInput}
                        value={roomName}
                        onChangeText={setRoomName}
                        placeholder="채팅방 이름을 입력하세요"
                        placeholderTextColor={Colors.textMuted}
                        maxLength={50}
                    />
                </View>

                {/* 선택된 참여자 */}
                {selectedUsers.length > 0 && (
                    <View style={styles.section}>
                        <Text style={styles.sectionTitle}>참여자 ({selectedUsers.length}명)</Text>
                        <FlatList
                            data={selectedUsers}
                            renderItem={renderSelectedUser}
                            keyExtractor={(item) => item.USER_ID}
                            horizontal
                            showsHorizontalScrollIndicator={false}
                            contentContainerStyle={styles.selectedUserList}
                        />
                    </View>
                )}

                {/* 사용자 검색 */}
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>참여자 추가</Text>
                    <TextInput
                        style={styles.searchInput}
                        value={searchQuery}
                        onChangeText={setSearchQuery}
                        placeholder="이름으로 검색..."
                        placeholderTextColor={Colors.textMuted}
                    />
                </View>

                {/* 검색 결과 */}
                {isLoading ? (
                    <ActivityIndicator style={{ marginTop: 20 }} color={Colors.primary} />
                ) : (
                    <FlatList
                        data={users}
                        renderItem={renderSearchResult}
                        keyExtractor={(item) => item.USER_ID}
                        contentContainerStyle={styles.searchResults}
                        ListEmptyComponent={
                            searchQuery.trim() ? (
                                <View style={styles.emptyContainer}>
                                    <Text style={styles.emptyText}>검색 결과가 없습니다.</Text>
                                </View>
                            ) : null
                        }
                    />
                )}

                {/* 생성 버튼 */}
                <TouchableOpacity
                    style={[styles.createButton, (!roomName.trim() || selectedUsers.length === 0) && styles.createButtonDisabled]}
                    onPress={handleCreate}
                    disabled={!roomName.trim() || selectedUsers.length === 0 || isCreating}
                >
                    {isCreating ? (
                        <ActivityIndicator color={Colors.textInverse} />
                    ) : (
                        <Text style={styles.createButtonText}>채팅방 만들기</Text>
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
    section: {
        padding: Spacing.md,
        backgroundColor: Colors.bgCard,
        borderBottomWidth: 1,
        borderBottomColor: Colors.borderColor,
    },
    sectionTitle: {
        fontSize: FontSize.sm,
        color: Colors.textSecondary,
        marginBottom: Spacing.sm,
        fontWeight: '600',
    },
    roomNameInput: {
        backgroundColor: Colors.bgInput,
        borderWidth: 1,
        borderColor: Colors.borderColor,
        borderRadius: BorderRadius.md,
        paddingHorizontal: Spacing.md,
        paddingVertical: Spacing.md,
        fontSize: FontSize.base,
        color: Colors.textPrimary,
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
    selectedUserList: {
        paddingVertical: Spacing.sm,
    },
    selectedUserChip: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: Colors.primaryLight,
        borderRadius: BorderRadius.full,
        paddingHorizontal: Spacing.md,
        paddingVertical: Spacing.sm,
        marginRight: Spacing.sm,
    },
    selectedUserName: {
        color: Colors.primary,
        fontWeight: '600',
        marginRight: Spacing.sm,
    },
    removeButton: {
        color: Colors.primary,
        fontSize: FontSize.sm,
    },
    searchResults: {
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
    avatar: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: Colors.primary,
        justifyContent: 'center',
        alignItems: 'center',
    },
    avatarText: {
        color: Colors.textInverse,
        fontWeight: 'bold',
        fontSize: FontSize.sm,
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
    addButton: {
        color: Colors.primary,
        fontWeight: '600',
    },
    emptyContainer: {
        alignItems: 'center',
        paddingTop: 40,
    },
    emptyText: {
        color: Colors.textMuted,
        fontSize: FontSize.base,
    },
    createButton: {
        margin: Spacing.md,
        backgroundColor: Colors.primary,
        borderRadius: BorderRadius.lg,
        paddingVertical: Spacing.md,
        alignItems: 'center',
    },
    createButtonDisabled: {
        backgroundColor: Colors.textMuted,
    },
    createButtonText: {
        color: Colors.textInverse,
        fontWeight: 'bold',
        fontSize: FontSize.base,
    },
});
