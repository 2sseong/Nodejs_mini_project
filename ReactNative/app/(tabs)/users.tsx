import { useState, useEffect, useCallback } from 'react';
import { View, Text, TextInput, FlatList, TouchableOpacity, StyleSheet, ActivityIndicator, Alert, RefreshControl, Modal } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { searchUsers, toggleUserPick, User } from '../../api/users';
import { checkOneToOneChat, createOneToOneChat } from '../../api/chat';
import { Colors, Spacing, BorderRadius, FontSize } from '../../constants/theme';
import * as SecureStore from 'expo-secure-store';

export default function UsersScreen() {
    const [users, setUsers] = useState<User[]>([]);
    const [filteredUsers, setFilteredUsers] = useState<User[]>([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [isLoading, setIsLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [currentUserId, setCurrentUserId] = useState<string | null>(null);

    // 1:1 채팅 모달 상태
    const [chatModalVisible, setChatModalVisible] = useState(false);
    const [selectedUser, setSelectedUser] = useState<User | null>(null);
    const [newRoomName, setNewRoomName] = useState('');
    const [isCreatingChat, setIsCreatingChat] = useState(false);

    useFocusEffect(
        useCallback(() => {
            loadCurrentUser();
            loadUsers();
        }, [])
    );

    const loadCurrentUser = async () => {
        const userData = await SecureStore.getItemAsync('userData');
        if (userData) {
            const user = JSON.parse(userData);
            setCurrentUserId(user.userId);
        }
    };

    const loadUsers = async () => {
        try {
            setIsLoading(true);
            // 빈 검색어로 전체 사용자 조회
            const result = await searchUsers('');
            setUsers(result || []);
            setFilteredUsers(result || []);
        } catch (error) {
            console.error('Failed to load users:', error);
        } finally {
            setIsLoading(false);
            setRefreshing(false);
        }
    };

    const handleSearch = (query: string) => {
        setSearchQuery(query);
        if (!query.trim()) {
            setFilteredUsers(users);
        } else {
            const filtered = users.filter(user =>
                (user.NICKNAME || user.USER_NICKNAME || '').toLowerCase().includes(query.toLowerCase()) ||
                (user.DEPT_NAME || '').toLowerCase().includes(query.toLowerCase())
            );
            setFilteredUsers(filtered);
        }
    };

    const handleTogglePick = async (userId: string, isPicked: boolean) => {
        try {
            await toggleUserPick(userId, !isPicked);
            // 로컬 상태 업데이트
            setUsers(prev => prev.map(u =>
                u.USER_ID === userId ? { ...u, IS_PICKED: !isPicked } : u
            ));
            setFilteredUsers(prev => prev.map(u =>
                u.USER_ID === userId ? { ...u, IS_PICKED: !isPicked } : u
            ));
        } catch (error) {
            console.error('Toggle pick failed:', error);
            Alert.alert('오류', '즐겨찾기 변경에 실패했습니다.');
        }
    };

    const handleStartChat = async (targetUser: User) => {
        try {
            // 1:1 채팅방 존재 확인
            const result = await checkOneToOneChat(Number(targetUser.USER_ID));

            if (result.exists && result.roomId) {
                // 기존 채팅방으로 이동
                router.push({
                    pathname: '/chat/[roomId]',
                    params: { roomId: result.roomId, roomName: targetUser.NICKNAME || targetUser.USER_NICKNAME }
                });
            } else {
                // 새 1:1 채팅방 생성 모달 표시
                setSelectedUser(targetUser);
                setNewRoomName(targetUser.NICKNAME || targetUser.USER_NICKNAME || '1:1 채팅');
                setChatModalVisible(true);
            }
        } catch (error) {
            console.error('Start chat failed:', error);
            Alert.alert('오류', '채팅 시작에 실패했습니다.');
        }
    };

    const handleCreateChatRoom = async () => {
        if (!selectedUser || !newRoomName.trim()) return;

        setIsCreatingChat(true);
        try {
            const newRoom = await createOneToOneChat(Number(selectedUser.USER_ID), newRoomName.trim());
            setChatModalVisible(false);
            setSelectedUser(null);
            setNewRoomName('');
            router.push({
                pathname: '/chat/[roomId]',
                params: { roomId: newRoom.roomId, roomName: newRoomName.trim() }
            });
        } catch (err) {
            Alert.alert('오류', '채팅방 생성에 실패했습니다.');
        } finally {
            setIsCreatingChat(false);
        }
    };

    const renderUser = ({ item }: { item: User }) => {
        // 서버에서 NICKNAME으로 반환됨
        const nickname = (item as any).NICKNAME || (item as any).userNickname || item.USER_NICKNAME || '알 수 없음';
        const isPicked = (item as any).ISPICK === 1 || (item as any).isPick === 1 || (item as any).IS_PICKED || false;

        // 본인 제외
        if (String(item.USER_ID) === String(currentUserId)) return null;

        return (
            <TouchableOpacity
                style={styles.userItem}
                onPress={() => handleStartChat(item)}
            >
                <View style={styles.avatar}>
                    <Text style={styles.avatarText}>
                        {nickname.charAt(0)}
                    </Text>
                </View>
                <View style={styles.userInfo}>
                    <Text style={styles.userName}>{nickname}</Text>
                    {(item.DEPT_NAME || item.POS_NAME || item.POSITION_NAME) && (
                        <Text style={styles.userRole}>
                            {[item.DEPT_NAME, item.POS_NAME || item.POSITION_NAME].filter(Boolean).join(' · ')}
                        </Text>
                    )}
                </View>
                <TouchableOpacity
                    style={styles.pickButton}
                    onPress={() => handleTogglePick(item.USER_ID, isPicked)}
                >
                    <Text style={[styles.pickIcon, isPicked && styles.pickIconActive]}>
                        {isPicked ? '★' : '☆'}
                    </Text>
                </TouchableOpacity>
            </TouchableOpacity>
        );
    };

    const onRefresh = () => {
        setRefreshing(true);
        loadUsers();
    };

    if (isLoading) {
        return (
            <View style={styles.centered}>
                <ActivityIndicator size="large" color={Colors.primary} />
            </View>
        );
    }

    return (
        <View style={styles.container}>
            {/* 검색창 */}
            <View style={styles.searchContainer}>
                <TextInput
                    style={styles.searchInput}
                    value={searchQuery}
                    onChangeText={handleSearch}
                    placeholder="이름 또는 부서로 검색..."
                    placeholderTextColor={Colors.textMuted}
                />
            </View>

            {/* 사용자 목록 */}
            <FlatList
                data={filteredUsers}
                renderItem={renderUser}
                keyExtractor={(item, index) => item.USER_ID ? String(item.USER_ID) : `user_${index}`}
                contentContainerStyle={styles.listContent}
                refreshControl={
                    <RefreshControl
                        refreshing={refreshing}
                        onRefresh={onRefresh}
                        colors={[Colors.primary]}
                    />
                }
                ListEmptyComponent={
                    <View style={styles.emptyContainer}>
                        <Text style={styles.emptyText}>
                            {searchQuery ? '검색 결과가 없습니다.' : '사용자가 없습니다.'}
                        </Text>
                    </View>
                }
            />

            {/* 1:1 채팅 생성 모달 */}
            <Modal
                visible={chatModalVisible}
                animationType="slide"
                transparent={true}
                onRequestClose={() => setChatModalVisible(false)}
            >
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <Text style={styles.modalTitle}>1:1 채팅 시작</Text>

                        <Text style={styles.modalLabel}>
                            {selectedUser?.NICKNAME || selectedUser?.USER_NICKNAME}님과 새 채팅방을 만듭니다
                        </Text>

                        <Text style={styles.inputLabel}>채팅방 이름</Text>
                        <TextInput
                            style={styles.modalInput}
                            value={newRoomName}
                            onChangeText={setNewRoomName}
                            placeholder="채팅방 이름을 입력하세요"
                            placeholderTextColor={Colors.textMuted}
                            maxLength={50}
                        />

                        <View style={styles.modalButtons}>
                            <TouchableOpacity
                                style={[styles.modalButton, styles.modalButtonCancel]}
                                onPress={() => {
                                    setChatModalVisible(false);
                                    setSelectedUser(null);
                                    setNewRoomName('');
                                }}
                                disabled={isCreatingChat}
                            >
                                <Text style={styles.modalButtonCancelText}>취소</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={[styles.modalButton, styles.modalButtonConfirm, !newRoomName.trim() && styles.modalButtonDisabled]}
                                onPress={handleCreateChatRoom}
                                disabled={!newRoomName.trim() || isCreatingChat}
                            >
                                <Text style={styles.modalButtonConfirmText}>
                                    {isCreatingChat ? '생성 중...' : '시작하기'}
                                </Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>
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
    avatar: {
        width: 48,
        height: 48,
        borderRadius: 24,
        backgroundColor: Colors.primary,
        justifyContent: 'center',
        alignItems: 'center',
    },
    avatarText: {
        color: Colors.textInverse,
        fontWeight: 'bold',
        fontSize: FontSize.lg,
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
    pickButton: {
        padding: Spacing.sm,
    },
    pickIcon: {
        fontSize: 24,
        color: Colors.textMuted,
    },
    pickIconActive: {
        color: Colors.warning,
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
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    modalContent: {
        backgroundColor: Colors.bgCard,
        borderRadius: BorderRadius.lg,
        padding: Spacing.lg,
        width: '85%',
        maxWidth: 400,
    },
    modalTitle: {
        fontSize: FontSize.xl,
        fontWeight: '600',
        color: Colors.textPrimary,
        marginBottom: Spacing.md,
        textAlign: 'center',
    },
    modalLabel: {
        fontSize: FontSize.base,
        color: Colors.textSecondary,
        marginBottom: Spacing.md,
        textAlign: 'center',
    },
    inputLabel: {
        fontSize: FontSize.sm,
        color: Colors.textSecondary,
        marginBottom: Spacing.xs,
    },
    modalInput: {
        backgroundColor: Colors.bgInput,
        borderWidth: 1,
        borderColor: Colors.borderColor,
        borderRadius: BorderRadius.md,
        paddingHorizontal: Spacing.md,
        paddingVertical: Spacing.sm,
        fontSize: FontSize.base,
        color: Colors.textPrimary,
        marginBottom: Spacing.lg,
    },
    modalButtons: {
        flexDirection: 'row',
        gap: Spacing.sm,
    },
    modalButton: {
        flex: 1,
        paddingVertical: Spacing.md,
        borderRadius: BorderRadius.md,
        alignItems: 'center',
    },
    modalButtonCancel: {
        backgroundColor: Colors.bgInput,
        borderWidth: 1,
        borderColor: Colors.borderColor,
    },
    modalButtonConfirm: {
        backgroundColor: Colors.primary,
    },
    modalButtonDisabled: {
        backgroundColor: Colors.textMuted,
    },
    modalButtonCancelText: {
        color: Colors.textPrimary,
        fontWeight: '600',
    },
    modalButtonConfirmText: {
        color: Colors.textInverse,
        fontWeight: '600',
    },
});
