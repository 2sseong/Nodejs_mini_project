import { useState, useEffect } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet, ActivityIndicator, Alert, TextInput, Modal } from 'react-native';
import { useLocalSearchParams, router, Stack } from 'expo-router';
import { Colors, Spacing, BorderRadius, FontSize } from '../../constants/theme';
import { createSocket, getSocket } from '../../utils/socket';
import * as SecureStore from 'expo-secure-store';

interface Notice {
    NOTICE_ID: number;
    CONTENT: string;
    CREATED_AT: string;
    CREATED_BY_NICKNAME: string;
    IS_ACTIVE: boolean;
}

export default function NoticesScreen() {
    const { roomId } = useLocalSearchParams<{ roomId: string }>();
    const [notices, setNotices] = useState<Notice[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [selectedNotice, setSelectedNotice] = useState<Notice | null>(null);
    const [isCreateModalVisible, setIsCreateModalVisible] = useState(false);
    const [newNoticeContent, setNewNoticeContent] = useState('');

    useEffect(() => {
        initSocket();
    }, [roomId]);

    const initSocket = async () => {
        let socket = getSocket();
        if (!socket || !socket.connected) {
            socket = await createSocket();
        }

        if (!socket) {
            setIsLoading(false);
            return;
        }

        // 방 조인
        socket.emit('room:join', { roomId });

        // 공지 목록 요청
        socket.emit('room:get_all_notices', { roomId });

        // 공지 목록 수신
        socket.on('room:all_notices', (data: { roomId: string; notices: Notice[] }) => {
            if (String(data.roomId) === String(roomId)) {
                setNotices(data.notices || []);
                setIsLoading(false);
            }
        });

        // 공지 삭제 확인
        socket.on('room:notice_deleted', (data: { roomId: string; noticeId: number }) => {
            if (String(data.roomId) === String(roomId)) {
                setNotices(prev => prev.filter(n => n.NOTICE_ID !== data.noticeId));
            }
        });

        return () => {
            socket?.emit('room:leave', { roomId });
            socket?.off('room:all_notices');
            socket?.off('room:notice_deleted');
        };
    };

    const handleDeleteNotice = (noticeId: number) => {
        Alert.alert(
            '공지 삭제',
            '이 공지를 삭제하시겠습니까?',
            [
                { text: '취소', style: 'cancel' },
                {
                    text: '삭제',
                    style: 'destructive',
                    onPress: () => {
                        const socket = getSocket();
                        socket?.emit('room:delete_notice', { roomId, noticeId });
                    }
                }
            ]
        );
    };

    const handleCreateNotice = async () => {
        if (!newNoticeContent.trim()) {
            Alert.alert('알림', '공지 내용을 입력해주세요.');
            return;
        }

        try {
            const socket = getSocket();
            const userData = await SecureStore.getItemAsync('userData');
            const user = userData ? JSON.parse(userData) : null;

            socket?.emit('room:set_notice', {
                roomId,
                content: newNoticeContent.trim(),
                userId: user?.userId
            });

            setIsCreateModalVisible(false);
            setNewNoticeContent('');

            // 잠시 후 목록 갱신
            setTimeout(() => {
                socket?.emit('room:get_all_notices', { roomId });
            }, 500);
        } catch (error) {
            console.error('Create notice error:', error);
            Alert.alert('오류', '공지 등록에 실패했습니다.');
        }
    };

    const formatDate = (dateString: string): string => {
        const date = new Date(dateString);
        return date.toLocaleDateString('ko-KR', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    };

    const renderNotice = ({ item }: { item: Notice }) => (
        <TouchableOpacity
            style={[styles.noticeItem, item.IS_ACTIVE && styles.activeNotice]}
            onPress={() => setSelectedNotice(selectedNotice?.NOTICE_ID === item.NOTICE_ID ? null : item)}
        >
            <View style={styles.noticeHeader}>
                <View style={styles.noticeInfo}>
                    {item.IS_ACTIVE && <Text style={styles.activeBadge}>현재 공지</Text>}
                    <Text style={styles.noticeAuthor}>{item.CREATED_BY_NICKNAME}</Text>
                    <Text style={styles.noticeDate}>{formatDate(item.CREATED_AT)}</Text>
                </View>
                <TouchableOpacity
                    style={styles.deleteButton}
                    onPress={() => handleDeleteNotice(item.NOTICE_ID)}
                >
                    <Text>🗑️</Text>
                </TouchableOpacity>
            </View>
            <Text
                style={styles.noticeContent}
                numberOfLines={selectedNotice?.NOTICE_ID === item.NOTICE_ID ? undefined : 2}
            >
                {item.CONTENT}
            </Text>
        </TouchableOpacity>
    );

    if (isLoading) {
        return (
            <View style={styles.centered}>
                <ActivityIndicator size="large" color={Colors.primary} />
            </View>
        );
    }

    return (
        <>
            <Stack.Screen
                options={{
                    title: '공지사항',
                    headerStyle: { backgroundColor: Colors.primary },
                    headerTintColor: Colors.textInverse,
                    headerLeft: () => (
                        <TouchableOpacity onPress={() => router.back()} style={{ marginLeft: 10 }}>
                            <Text style={{ color: Colors.textInverse, fontSize: 16 }}>← 뒤로</Text>
                        </TouchableOpacity>
                    ),
                    headerRight: () => (
                        <TouchableOpacity
                            onPress={() => setIsCreateModalVisible(true)}
                            style={{ marginRight: 10 }}
                        >
                            <Text style={{ color: Colors.textInverse, fontSize: 16 }}>+ 등록</Text>
                        </TouchableOpacity>
                    ),
                }}
            />
            <View style={styles.container}>
                <FlatList
                    data={notices}
                    renderItem={renderNotice}
                    keyExtractor={(item) => String(item.NOTICE_ID)}
                    contentContainerStyle={styles.listContent}
                    ListEmptyComponent={
                        <View style={styles.emptyContainer}>
                            <Text style={styles.emptyIcon}>📢</Text>
                            <Text style={styles.emptyText}>등록된 공지가 없습니다.</Text>
                        </View>
                    }
                />
            </View>

            {/* 공지 등록 모달 */}
            <Modal
                visible={isCreateModalVisible}
                animationType="slide"
                transparent={true}
                onRequestClose={() => setIsCreateModalVisible(false)}
            >
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <Text style={styles.modalTitle}>공지 등록</Text>
                        <TextInput
                            style={styles.modalInput}
                            value={newNoticeContent}
                            onChangeText={setNewNoticeContent}
                            placeholder="공지 내용을 입력하세요"
                            placeholderTextColor={Colors.textMuted}
                            multiline
                            numberOfLines={4}
                            textAlignVertical="top"
                        />
                        <View style={styles.modalButtons}>
                            <TouchableOpacity
                                style={styles.modalCancelButton}
                                onPress={() => {
                                    setIsCreateModalVisible(false);
                                    setNewNoticeContent('');
                                }}
                            >
                                <Text style={styles.modalCancelText}>취소</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={styles.modalConfirmButton}
                                onPress={handleCreateNotice}
                            >
                                <Text style={styles.modalConfirmText}>등록</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>
        </>
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
    listContent: {
        padding: Spacing.md,
        flexGrow: 1,
    },
    noticeItem: {
        padding: Spacing.md,
        backgroundColor: Colors.bgCard,
        borderRadius: BorderRadius.md,
        marginBottom: Spacing.sm,
    },
    activeNotice: {
        borderLeftWidth: 4,
        borderLeftColor: Colors.primary,
    },
    noticeHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        marginBottom: Spacing.sm,
    },
    noticeInfo: {
        flexDirection: 'row',
        alignItems: 'center',
        flexWrap: 'wrap',
        flex: 1,
    },
    activeBadge: {
        backgroundColor: Colors.primary,
        color: Colors.textInverse,
        paddingHorizontal: Spacing.sm,
        paddingVertical: 2,
        borderRadius: BorderRadius.sm,
        fontSize: FontSize.xs,
        marginRight: Spacing.sm,
        overflow: 'hidden',
    },
    noticeAuthor: {
        fontSize: FontSize.sm,
        color: Colors.textPrimary,
        fontWeight: '600',
        marginRight: Spacing.sm,
    },
    noticeDate: {
        fontSize: FontSize.xs,
        color: Colors.textMuted,
    },
    deleteButton: {
        padding: Spacing.xs,
    },
    noticeContent: {
        fontSize: FontSize.base,
        color: Colors.textPrimary,
        lineHeight: 22,
    },
    emptyContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        paddingTop: 100,
    },
    emptyIcon: {
        fontSize: 48,
        marginBottom: Spacing.md,
    },
    emptyText: {
        color: Colors.textMuted,
        fontSize: FontSize.base,
    },
    // 모달 스타일
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'center',
        alignItems: 'center',
        padding: Spacing.lg,
    },
    modalContent: {
        backgroundColor: Colors.bgCard,
        borderRadius: BorderRadius.lg,
        padding: Spacing.xl,
        width: '100%',
        maxWidth: 400,
    },
    modalTitle: {
        fontSize: FontSize.lg,
        fontWeight: 'bold',
        color: Colors.textPrimary,
        marginBottom: Spacing.md,
        textAlign: 'center',
    },
    modalInput: {
        backgroundColor: Colors.bgInput,
        borderWidth: 1,
        borderColor: Colors.borderColor,
        borderRadius: BorderRadius.md,
        paddingHorizontal: Spacing.md,
        paddingVertical: Spacing.md,
        fontSize: FontSize.base,
        color: Colors.textPrimary,
        minHeight: 120,
    },
    modalButtons: {
        flexDirection: 'row',
        marginTop: Spacing.lg,
    },
    modalCancelButton: {
        flex: 1,
        padding: Spacing.md,
        alignItems: 'center',
        borderRadius: BorderRadius.md,
        backgroundColor: Colors.bgInput,
        marginRight: Spacing.sm,
    },
    modalCancelText: {
        color: Colors.textSecondary,
        fontWeight: '600',
    },
    modalConfirmButton: {
        flex: 1,
        padding: Spacing.md,
        alignItems: 'center',
        borderRadius: BorderRadius.md,
        backgroundColor: Colors.primary,
    },
    modalConfirmText: {
        color: Colors.textInverse,
        fontWeight: '600',
    },
});
