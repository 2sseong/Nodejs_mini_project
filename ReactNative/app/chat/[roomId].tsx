import { useState, useEffect, useRef, useCallback } from 'react';
import { View, Text, TextInput, TouchableOpacity, FlatList, StyleSheet, KeyboardAvoidingView, Platform, ActivityIndicator, Modal, Alert, Image } from 'react-native';
import { useLocalSearchParams, router, Stack } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { useChatSocket } from '../../hooks/useChatSocket';
import { Message, searchMessages, SearchResult, uploadFile } from '../../api/chat';
import { Colors, Spacing, BorderRadius, FontSize } from '../../constants/theme';
import { API_BASE_URL } from '../../api/client';
import * as SecureStore from 'expo-secure-store';

// 날짜 포맷팅 헬퍼
const formatDate = (dateString: string): string => {
    const date = new Date(dateString);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    if (date.toDateString() === today.toDateString()) {
        return '오늘';
    } else if (date.toDateString() === yesterday.toDateString()) {
        return '어제';
    } else {
        return date.toLocaleDateString('ko-KR', {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            weekday: 'short'
        });
    }
};

// 같은 날짜인지 확인
const isSameDay = (date1: string, date2: string): boolean => {
    return new Date(date1).toDateString() === new Date(date2).toDateString();
};

// 시스템 메시지 타입
type MessageType = 'TEXT' | 'SYSTEM' | 'FILE' | 'IMAGE';

export default function ChatScreen() {
    const { roomId, roomName } = useLocalSearchParams<{ roomId: string; roomName?: string }>();
    const [inputText, setInputText] = useState('');
    const [userId, setUserId] = useState<string | null>(null);
    const [searchModalVisible, setSearchModalVisible] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
    const [isSearching, setIsSearching] = useState(false);

    // 메시지 수정/삭제 상태
    const [editingMessage, setEditingMessage] = useState<Message | null>(null);
    const [actionModalVisible, setActionModalVisible] = useState(false);
    const [selectedMessage, setSelectedMessage] = useState<Message | null>(null);

    const flatListRef = useRef<FlatList>(null);
    const isFirstLoad = useRef(true);

    const {
        connected,
        messages,
        isLoading,
        isLoadingMore,
        hasMoreMessages,
        currentNotice,
        sendMessage,
        editMessage,
        deleteMessage,
        setNotice,
        loadMoreMessages,
        markAsRead
    } = useChatSocket(roomId ? Number(roomId) : null);

    // 사용자 ID 로드
    useEffect(() => {
        const loadUserId = async () => {
            const data = await SecureStore.getItemAsync('userData');
            if (data) {
                const user = JSON.parse(data);
                setUserId(user.userId);
            }
        };
        loadUserId();
    }, []);

    // 새 메시지 도착 시 스크롤 및 읽음 처리
    useEffect(() => {
        if (messages.length > 0) {
            if (isFirstLoad.current) {
                // 첫 로드 시 바닥으로 스크롤
                setTimeout(() => {
                    flatListRef.current?.scrollToEnd({ animated: false });
                    markAsRead();
                }, 100);
                isFirstLoad.current = false;
            } else {
                // 새 메시지 시 부드럽게 스크롤
                setTimeout(() => {
                    flatListRef.current?.scrollToEnd({ animated: true });
                    markAsRead();
                }, 100);
            }
        }
    }, [messages, markAsRead]);

    // 방 입장 시 읽음 처리
    useEffect(() => {
        if (connected && messages.length > 0) {
            markAsRead();
        }
    }, [connected]);

    const handleSend = () => {
        if (!inputText.trim()) return;
        sendMessage(inputText);
        setInputText('');
    };

    const formatTime = (dateString: string) => {
        const date = new Date(dateString);
        return date.toLocaleTimeString('ko-KR', {
            hour: '2-digit',
            minute: '2-digit',
        });
    };

    // 무한 스크롤 - 맨 위에 도달했을 때
    const handleLoadMore = useCallback(() => {
        if (!isLoadingMore && hasMoreMessages) {
            loadMoreMessages();
        }
    }, [isLoadingMore, hasMoreMessages, loadMoreMessages]);

    // 이미지 선택 및 업로드
    const handleImagePick = async () => {
        try {
            const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
            if (!permissionResult.granted) {
                Alert.alert('권한 필요', '이미지를 선택하려면 갤러리 접근 권한이 필요합니다.');
                return;
            }

            const result = await ImagePicker.launchImageLibraryAsync({
                mediaTypes: ImagePicker.MediaTypeOptions.Images,
                allowsEditing: false,
                quality: 0.8,
            });

            if (!result.canceled && result.assets[0]) {
                const asset = result.assets[0];
                const formData = new FormData();

                formData.append('file', {
                    uri: asset.uri,
                    type: asset.mimeType || 'image/jpeg',
                    name: asset.fileName || `image_${Date.now()}.jpg`,
                } as any);

                formData.append('roomId', String(roomId));

                const uploadResult = await uploadFile(formData);
                if (uploadResult && uploadResult.fileUrl) {
                    // 이미지 메시지 전송
                    sendMessage(`[이미지] ${API_BASE_URL}${uploadResult.fileUrl}`);
                }
            }
        } catch (error) {
            console.error('이미지 업로드 오류:', error);
            Alert.alert('오류', '이미지 업로드에 실패했습니다.');
        }
    };

    // 메시지 롱프레스 핸들러
    const handleMessageLongPress = (msg: Message) => {
        setSelectedMessage(msg);
        setActionModalVisible(true);
    };

    // 메시지 수정 시작
    const handleStartEdit = () => {
        if (!selectedMessage) return;
        setEditingMessage(selectedMessage);
        setInputText(selectedMessage.CONTENT);
        setActionModalVisible(false);
    };

    // 메시지 수정 취소
    const handleCancelEdit = () => {
        setEditingMessage(null);
        setInputText('');
    };

    // 메시지 수정 전송
    const handleSaveEdit = () => {
        if (!editingMessage || !inputText.trim()) return;
        editMessage(editingMessage.MSG_ID, inputText.trim());
        setEditingMessage(null);
        setInputText('');
    };

    // 메시지 삭제
    const handleDeleteMessage = () => {
        if (!selectedMessage) return;
        Alert.alert(
            '메시지 삭제',
            '이 메시지를 삭제하시겠습니까?',
            [
                { text: '취소', style: 'cancel' },
                {
                    text: '삭제',
                    style: 'destructive',
                    onPress: () => {
                        deleteMessage(selectedMessage.MSG_ID);
                        setActionModalVisible(false);
                        setSelectedMessage(null);
                    }
                }
            ]
        );
    };

    // 공지로 설정
    const handleSetNotice = () => {
        if (!selectedMessage) return;
        setNotice(selectedMessage.MSG_ID, selectedMessage.CONTENT);
        setActionModalVisible(false);
        setSelectedMessage(null);
        Alert.alert('알림', '공지로 설정되었습니다.');
    };

    // 메시지 검색
    const handleSearch = async () => {
        if (!searchQuery.trim() || !roomId) return;

        setIsSearching(true);
        try {
            const results = await searchMessages(Number(roomId), searchQuery);
            setSearchResults(results || []);
        } catch (error) {
            console.error('Search error:', error);
            Alert.alert('오류', '메시지 검색에 실패했습니다.');
        } finally {
            setIsSearching(false);
        }
    };

    // 날짜 구분선 렌더링
    const renderDateSeparator = (date: string) => (
        <View style={styles.dateSeparator}>
            <View style={styles.dateLine} />
            <Text style={styles.dateText}>{formatDate(date)}</Text>
            <View style={styles.dateLine} />
        </View>
    );

    // 시스템 메시지 렌더링
    const renderSystemMessage = (item: Message) => (
        <View style={styles.systemMessageContainer}>
            <Text style={styles.systemMessageText}>{item.CONTENT}</Text>
        </View>
    );

    const renderMessage = ({ item, index }: { item: Message; index: number }) => {
        const msgType = (item as any).MSG_TYPE || 'TEXT';

        // 시스템 메시지
        if (msgType === 'SYSTEM') {
            return (
                <View>
                    {/* 날짜 구분선 */}
                    {(index === 0 || !isSameDay(messages[index - 1].CREATED_AT, item.CREATED_AT)) &&
                        renderDateSeparator(item.CREATED_AT)}
                    {renderSystemMessage(item)}
                </View>
            );
        }

        const isMine = String(item.USER_ID) === String(userId);
        const prevMsg = index > 0 ? messages[index - 1] : null;
        const showAvatar = !prevMsg || prevMsg.USER_ID !== item.USER_ID ||
            (prevMsg && !isSameDay(prevMsg.CREATED_AT, item.CREATED_AT));
        const showDateSeparator = index === 0 || !isSameDay(messages[index - 1].CREATED_AT, item.CREATED_AT);

        return (
            <View>
                {/* 날짜 구분선 */}
                {showDateSeparator && renderDateSeparator(item.CREATED_AT)}

                <TouchableOpacity
                    activeOpacity={0.7}
                    onLongPress={() => handleMessageLongPress(item)}
                    delayLongPress={500}
                >
                    <View style={[styles.messageRow, isMine && styles.messageRowMine]}>
                        {/* 상대방 메시지 - 아바타 */}
                        {!isMine && showAvatar && (
                            <View style={styles.avatar}>
                                <Text style={styles.avatarText}>
                                    {item.NICKNAME?.charAt(0) || '?'}
                                </Text>
                            </View>
                        )}
                        {!isMine && !showAvatar && <View style={styles.avatarPlaceholder} />}

                        <View style={[styles.messageContainer, isMine && styles.messageContainerMine]}>
                            {/* 닉네임 (상대방만) */}
                            {!isMine && showAvatar && (
                                <Text style={styles.nickname}>{item.NICKNAME}</Text>
                            )}

                            <View style={[styles.messageBubble, isMine ? styles.bubbleMine : styles.bubbleTheirs]}>
                                <Text style={[styles.messageText, isMine && styles.messageTextMine]}>
                                    {item.CONTENT}
                                </Text>
                                {(item as any).IS_EDITED && (
                                    <Text style={styles.editedLabel}>(수정됨)</Text>
                                )}
                            </View>

                            <View style={[styles.messageInfo, isMine && styles.messageInfoMine]}>
                                {(item.UNREAD_COUNT ?? 0) > 0 && (
                                    <Text style={styles.unreadCount}>{item.UNREAD_COUNT}</Text>
                                )}
                                <Text style={styles.messageTime}>{formatTime(item.CREATED_AT)}</Text>
                            </View>
                        </View>
                    </View>
                </TouchableOpacity>
            </View>
        );
    };

    // 검색 결과 아이템 렌더링
    const renderSearchResult = ({ item }: { item: SearchResult }) => (
        <TouchableOpacity
            style={styles.searchResultItem}
            onPress={() => {
                setSearchModalVisible(false);
                setSearchQuery('');
                setSearchResults([]);
                // TODO: 해당 메시지로 스크롤
            }}
        >
            <Text style={styles.searchResultNickname}>{item.NICKNAME}</Text>
            <Text style={styles.searchResultContent} numberOfLines={2}>{item.CONTENT}</Text>
            <Text style={styles.searchResultTime}>{formatDate(item.CREATED_AT)} {formatTime(item.CREATED_AT)}</Text>
        </TouchableOpacity>
    );

    if (isLoading) {
        return (
            <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color={Colors.primary} />
                <Text style={styles.loadingText}>채팅 불러오는 중...</Text>
            </View>
        );
    }

    return (
        <>
            <Stack.Screen
                options={{
                    title: roomName || '채팅',
                    headerStyle: { backgroundColor: Colors.primary },
                    headerTintColor: Colors.textInverse,
                    headerLeft: () => (
                        <TouchableOpacity onPress={() => router.back()} style={{ marginLeft: 10 }}>
                            <Text style={{ color: Colors.textInverse, fontSize: 16 }}>← 뒤로</Text>
                        </TouchableOpacity>
                    ),
                    headerRight: () => (
                        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                            <TouchableOpacity
                                onPress={() => setSearchModalVisible(true)}
                                style={{ marginRight: 15 }}
                            >
                                <Text style={{ color: Colors.textInverse, fontSize: 16 }}>🔍</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                onPress={() => router.push({
                                    pathname: '/chat/settings',
                                    params: { roomId, roomName }
                                })}
                                style={{ marginRight: 10 }}
                            >
                                <Text style={{ color: Colors.textInverse, fontSize: 16 }}>⚙️</Text>
                            </TouchableOpacity>
                        </View>
                    ),
                }}
            />
            <KeyboardAvoidingView
                style={styles.container}
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
            >
                {/* 연결 상태 표시 */}
                {!connected && (
                    <View style={styles.connectionBar}>
                        <Text style={styles.connectionText}>연결 중...</Text>
                    </View>
                )}

                {/* 메시지 목록 */}
                <FlatList
                    ref={flatListRef}
                    data={messages}
                    renderItem={renderMessage}
                    keyExtractor={(item, index) => String(item.MSG_ID || `temp_${index}`)}
                    contentContainerStyle={styles.messageList}
                    onEndReached={handleLoadMore}
                    onEndReachedThreshold={0.1}
                    inverted={false}
                    ListHeaderComponent={
                        isLoadingMore ? (
                            <View style={styles.loadingMoreContainer}>
                                <ActivityIndicator size="small" color={Colors.primary} />
                                <Text style={styles.loadingMoreText}>이전 메시지 불러오는 중...</Text>
                            </View>
                        ) : null
                    }
                    ListEmptyComponent={
                        <View style={styles.emptyContainer}>
                            <Text style={styles.emptyText}>대화를 시작해보세요!</Text>
                        </View>
                    }
                />

                {/* 수정 모드 표시 */}
                {editingMessage && (
                    <View style={styles.editingBar}>
                        <Text style={styles.editingText}>메시지 수정 중...</Text>
                        <TouchableOpacity onPress={handleCancelEdit}>
                            <Text style={styles.editingCancel}>취소</Text>
                        </TouchableOpacity>
                    </View>
                )}

                {/* 입력창 */}
                <View style={styles.inputContainer}>
                    {!editingMessage && (
                        <TouchableOpacity
                            style={styles.attachButton}
                            onPress={handleImagePick}
                        >
                            <Text style={styles.attachButtonText}>📎</Text>
                        </TouchableOpacity>
                    )}
                    <TextInput
                        style={styles.input}
                        value={inputText}
                        onChangeText={setInputText}
                        placeholder={editingMessage ? "수정할 내용을 입력하세요" : "메시지를 입력하세요"}
                        placeholderTextColor={Colors.textMuted}
                        multiline
                        maxLength={1000}
                    />
                    <TouchableOpacity
                        style={[styles.sendButton, !inputText.trim() && styles.sendButtonDisabled]}
                        onPress={editingMessage ? handleSaveEdit : handleSend}
                        disabled={!inputText.trim()}
                    >
                        <Text style={styles.sendButtonText}>{editingMessage ? '수정' : '전송'}</Text>
                    </TouchableOpacity>
                </View>
            </KeyboardAvoidingView>

            {/* 액션 모달 */}
            <Modal
                visible={actionModalVisible}
                animationType="slide"
                transparent={true}
                onRequestClose={() => setActionModalVisible(false)}
            >
                <TouchableOpacity
                    style={styles.actionModalOverlay}
                    activeOpacity={1}
                    onPress={() => setActionModalVisible(false)}
                >
                    <View style={styles.actionModalContent}>
                        <Text style={styles.actionModalTitle}>메시지 옵션</Text>

                        {selectedMessage && String(selectedMessage.USER_ID) === String(userId) && (
                            <>
                                <TouchableOpacity style={styles.actionButton} onPress={handleStartEdit}>
                                    <Text style={styles.actionButtonText}>✏️ 수정하기</Text>
                                </TouchableOpacity>
                                <TouchableOpacity style={styles.actionButton} onPress={handleDeleteMessage}>
                                    <Text style={[styles.actionButtonText, { color: Colors.danger }]}>🗑️ 삭제하기</Text>
                                </TouchableOpacity>
                            </>
                        )}

                        <TouchableOpacity style={styles.actionButton} onPress={handleSetNotice}>
                            <Text style={styles.actionButtonText}>📢 공지로 설정</Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                            style={[styles.actionButton, styles.actionButtonCancel]}
                            onPress={() => setActionModalVisible(false)}
                        >
                            <Text style={styles.actionButtonText}>취소</Text>
                        </TouchableOpacity>
                    </View>
                </TouchableOpacity>
            </Modal>

            {/* 검색 모달 */}
            <Modal
                visible={searchModalVisible}
                animationType="slide"
                transparent={true}
                onRequestClose={() => setSearchModalVisible(false)}
            >
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <View style={styles.modalHeader}>
                            <Text style={styles.modalTitle}>메시지 검색</Text>
                            <TouchableOpacity onPress={() => setSearchModalVisible(false)}>
                                <Text style={styles.modalClose}>✕</Text>
                            </TouchableOpacity>
                        </View>

                        <View style={styles.searchInputContainer}>
                            <TextInput
                                style={styles.searchInput}
                                value={searchQuery}
                                onChangeText={setSearchQuery}
                                placeholder="검색어를 입력하세요"
                                placeholderTextColor={Colors.textMuted}
                                onSubmitEditing={handleSearch}
                                returnKeyType="search"
                            />
                            <TouchableOpacity
                                style={styles.searchButton}
                                onPress={handleSearch}
                            >
                                <Text style={styles.searchButtonText}>검색</Text>
                            </TouchableOpacity>
                        </View>

                        {isSearching ? (
                            <ActivityIndicator style={{ marginTop: 20 }} color={Colors.primary} />
                        ) : (
                            <FlatList
                                data={searchResults}
                                renderItem={renderSearchResult}
                                keyExtractor={(item) => String(item.MSG_ID)}
                                contentContainerStyle={styles.searchResultList}
                                ListEmptyComponent={
                                    searchQuery.trim() ? (
                                        <Text style={styles.noResultText}>검색 결과가 없습니다.</Text>
                                    ) : null
                                }
                            />
                        )}
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
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: Colors.bgPage,
    },
    loadingText: {
        marginTop: Spacing.md,
        color: Colors.textSecondary,
    },
    connectionBar: {
        backgroundColor: Colors.warning,
        padding: Spacing.sm,
        alignItems: 'center',
    },
    connectionText: {
        color: Colors.textPrimary,
        fontSize: FontSize.sm,
    },
    messageList: {
        padding: Spacing.md,
        flexGrow: 1,
    },
    loadingMoreContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        padding: Spacing.md,
    },
    loadingMoreText: {
        marginLeft: Spacing.sm,
        color: Colors.textSecondary,
        fontSize: FontSize.sm,
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
    // 날짜 구분선
    dateSeparator: {
        flexDirection: 'row',
        alignItems: 'center',
        marginVertical: Spacing.lg,
    },
    dateLine: {
        flex: 1,
        height: 1,
        backgroundColor: Colors.borderColor,
    },
    dateText: {
        marginHorizontal: Spacing.md,
        color: Colors.textMuted,
        fontSize: FontSize.xs,
    },
    // 시스템 메시지
    systemMessageContainer: {
        alignItems: 'center',
        marginVertical: Spacing.sm,
    },
    systemMessageText: {
        backgroundColor: Colors.bgCard,
        color: Colors.textSecondary,
        paddingHorizontal: Spacing.md,
        paddingVertical: Spacing.sm,
        borderRadius: BorderRadius.full,
        fontSize: FontSize.xs,
        overflow: 'hidden',
    },
    // 메시지 스타일
    messageRow: {
        flexDirection: 'row',
        marginBottom: Spacing.sm,
        alignItems: 'flex-end',
    },
    messageRowMine: {
        justifyContent: 'flex-end',
    },
    avatar: {
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: Colors.primary,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: Spacing.sm,
    },
    avatarPlaceholder: {
        width: 36,
        marginRight: Spacing.sm,
    },
    avatarText: {
        color: Colors.textInverse,
        fontWeight: 'bold',
        fontSize: FontSize.sm,
    },
    messageContainer: {
        maxWidth: '75%',
    },
    messageContainerMine: {
        alignItems: 'flex-end',
    },
    nickname: {
        fontSize: FontSize.xs,
        color: Colors.textSecondary,
        marginBottom: Spacing.xs,
        marginLeft: Spacing.xs,
    },
    messageBubble: {
        borderRadius: BorderRadius.lg,
        padding: Spacing.md,
        maxWidth: '100%',
    },
    bubbleMine: {
        backgroundColor: Colors.primary,
        borderBottomRightRadius: BorderRadius.xs,
    },
    bubbleTheirs: {
        backgroundColor: Colors.bgCard,
        borderBottomLeftRadius: BorderRadius.xs,
    },
    messageText: {
        fontSize: FontSize.base,
        color: Colors.textPrimary,
        lineHeight: 22,
    },
    messageTextMine: {
        color: Colors.textInverse,
    },
    messageInfo: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: Spacing.xs,
        gap: Spacing.xs,
    },
    messageInfoMine: {
        flexDirection: 'row-reverse',
    },
    unreadCount: {
        fontSize: FontSize.xs,
        color: Colors.primary,
        fontWeight: 'bold',
    },
    messageTime: {
        fontSize: FontSize.xs,
        color: Colors.textMuted,
    },
    inputContainer: {
        flexDirection: 'row',
        padding: Spacing.md,
        backgroundColor: Colors.bgCard,
        borderTopWidth: 1,
        borderTopColor: Colors.borderColor,
        alignItems: 'flex-end',
    },
    input: {
        flex: 1,
        backgroundColor: Colors.bgInput,
        borderWidth: 1,
        borderColor: Colors.borderColor,
        borderRadius: BorderRadius.lg,
        paddingHorizontal: Spacing.md,
        paddingVertical: Spacing.sm,
        fontSize: FontSize.base,
        color: Colors.textPrimary,
        maxHeight: 100,
    },
    sendButton: {
        marginLeft: Spacing.sm,
        backgroundColor: Colors.primary,
        borderRadius: BorderRadius.lg,
        paddingHorizontal: Spacing.lg,
        paddingVertical: Spacing.sm,
        justifyContent: 'center',
    },
    sendButtonDisabled: {
        backgroundColor: Colors.textMuted,
    },
    attachButton: {
        marginRight: Spacing.sm,
        padding: Spacing.sm,
        justifyContent: 'center',
        alignItems: 'center',
    },
    attachButtonText: {
        fontSize: 20,
    },
    editedLabel: {
        fontSize: FontSize.xs,
        color: Colors.textMuted,
        marginTop: 2,
    },
    editingBar: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: Spacing.sm,
        backgroundColor: Colors.primary + '20',
        borderBottomWidth: 1,
        borderBottomColor: Colors.borderColor,
    },
    editingText: {
        color: Colors.primary,
        fontSize: FontSize.sm,
    },
    editingCancel: {
        color: Colors.danger,
        fontWeight: '600',
    },
    actionModalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'flex-end',
    },
    actionModalContent: {
        backgroundColor: Colors.bgCard,
        borderTopLeftRadius: BorderRadius.xl,
        borderTopRightRadius: BorderRadius.xl,
        padding: Spacing.lg,
    },
    actionModalTitle: {
        fontSize: FontSize.lg,
        fontWeight: '600',
        color: Colors.textPrimary,
        marginBottom: Spacing.md,
        textAlign: 'center',
    },
    actionButton: {
        padding: Spacing.md,
        borderBottomWidth: 1,
        borderBottomColor: Colors.borderColor,
    },
    actionButtonText: {
        fontSize: FontSize.base,
        color: Colors.textPrimary,
    },
    actionButtonCancel: {
        borderBottomWidth: 0,
        marginTop: Spacing.sm,
    },
    sendButtonText: {
        color: Colors.textInverse,
        fontWeight: '600',
        fontSize: FontSize.base,
    },
    // 모달 스타일
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'flex-end',
    },
    modalContent: {
        backgroundColor: Colors.bgCard,
        borderTopLeftRadius: BorderRadius.xl,
        borderTopRightRadius: BorderRadius.xl,
        maxHeight: '80%',
        minHeight: '50%',
    },
    modalHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: Spacing.lg,
        borderBottomWidth: 1,
        borderBottomColor: Colors.borderColor,
    },
    modalTitle: {
        fontSize: FontSize.lg,
        fontWeight: 'bold',
        color: Colors.textPrimary,
    },
    modalClose: {
        fontSize: FontSize.xl,
        color: Colors.textSecondary,
    },
    searchInputContainer: {
        flexDirection: 'row',
        padding: Spacing.md,
        borderBottomWidth: 1,
        borderBottomColor: Colors.borderColor,
    },
    searchInput: {
        flex: 1,
        backgroundColor: Colors.bgInput,
        borderWidth: 1,
        borderColor: Colors.borderColor,
        borderRadius: BorderRadius.md,
        paddingHorizontal: Spacing.md,
        paddingVertical: Spacing.sm,
        fontSize: FontSize.base,
        color: Colors.textPrimary,
    },
    searchButton: {
        marginLeft: Spacing.sm,
        backgroundColor: Colors.primary,
        borderRadius: BorderRadius.md,
        paddingHorizontal: Spacing.lg,
        justifyContent: 'center',
    },
    searchButtonText: {
        color: Colors.textInverse,
        fontWeight: '600',
    },
    searchResultList: {
        padding: Spacing.md,
    },
    searchResultItem: {
        padding: Spacing.md,
        borderBottomWidth: 1,
        borderBottomColor: Colors.borderColor,
    },
    searchResultNickname: {
        fontSize: FontSize.sm,
        fontWeight: 'bold',
        color: Colors.textPrimary,
    },
    searchResultContent: {
        fontSize: FontSize.base,
        color: Colors.textSecondary,
        marginTop: Spacing.xs,
    },
    searchResultTime: {
        fontSize: FontSize.xs,
        color: Colors.textMuted,
        marginTop: Spacing.xs,
    },
    noResultText: {
        textAlign: 'center',
        color: Colors.textMuted,
        marginTop: Spacing.xl,
    },
});
