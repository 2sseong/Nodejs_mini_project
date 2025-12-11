import { useState, useEffect, useCallback } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Image, Alert, TextInput, Modal, ActivityIndicator } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { logout, getStoredUser, verifyPassword, updateUserInfo, uploadProfileImage } from '../../api/auth';
import { Colors, Spacing, BorderRadius, FontSize } from '../../constants/theme';
import { API_BASE_URL } from '../../api/client';

export default function ProfileScreen() {
    const [user, setUser] = useState<any>(null);
    const [editModalVisible, setEditModalVisible] = useState(false);
    const [passwordModalVisible, setPasswordModalVisible] = useState(false);
    const [changePasswordModalVisible, setChangePasswordModalVisible] = useState(false);

    // 비밀번호 확인
    const [verifyPasswordInput, setVerifyPasswordInput] = useState('');
    const [isVerifying, setIsVerifying] = useState(false);
    const [isPasswordVerified, setIsPasswordVerified] = useState(false);

    // 프로필 수정
    const [editNickname, setEditNickname] = useState('');
    const [isUpdating, setIsUpdating] = useState(false);

    // 비밀번호 변경
    const [currentPassword, setCurrentPassword] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [isChangingPassword, setIsChangingPassword] = useState(false);

    const loadUser = async () => {
        const userData = await getStoredUser();
        setUser(userData);
        if (userData) {
            setEditNickname(userData.nickname || '');
        }
    };

    useFocusEffect(
        useCallback(() => {
            loadUser();
        }, [])
    );

    const handleLogout = () => {
        Alert.alert('로그아웃', '정말 로그아웃 하시겠습니까?', [
            { text: '취소', style: 'cancel' },
            {
                text: '로그아웃',
                style: 'destructive',
                onPress: async () => {
                    await logout();
                    router.replace('/(auth)/login');
                },
            },
        ]);
    };

    // 비밀번호 확인 후 수정 화면 열기
    const handleVerifyPassword = async () => {
        if (!verifyPasswordInput.trim()) {
            Alert.alert('알림', '비밀번호를 입력해주세요.');
            return;
        }

        try {
            setIsVerifying(true);
            const response = await verifyPassword(verifyPasswordInput);
            if (response.success) {
                setIsPasswordVerified(true);
                setPasswordModalVisible(false);
                setEditModalVisible(true);
                setVerifyPasswordInput('');
            } else {
                Alert.alert('오류', '비밀번호가 일치하지 않습니다.');
            }
        } catch (error: any) {
            Alert.alert('오류', error.response?.data?.message || '비밀번호 확인에 실패했습니다.');
        } finally {
            setIsVerifying(false);
        }
    };

    // 프로필 이미지 변경
    const handleChangeProfileImage = async () => {
        try {
            const result = await ImagePicker.launchImageLibraryAsync({
                mediaTypes: ImagePicker.MediaTypeOptions.Images,
                allowsEditing: true,
                aspect: [1, 1],
                quality: 0.8,
            });

            if (!result.canceled && result.assets[0]) {
                setIsUpdating(true);
                const formData = new FormData();
                const uri = result.assets[0].uri;
                const filename = uri.split('/').pop() || 'profile.jpg';
                const match = /\.(\w+)$/.exec(filename);
                const type = match ? `image/${match[1]}` : 'image/jpeg';

                formData.append('profilePic', {
                    uri,
                    name: filename,
                    type,
                } as any);

                await uploadProfileImage(formData);
                await loadUser();
                Alert.alert('성공', '프로필 이미지가 변경되었습니다.');
            }
        } catch (error: any) {
            Alert.alert('오류', error.response?.data?.message || '이미지 업로드에 실패했습니다.');
        } finally {
            setIsUpdating(false);
        }
    };

    // 닉네임 변경
    const handleUpdateNickname = async () => {
        if (!editNickname.trim()) {
            Alert.alert('알림', '닉네임을 입력해주세요.');
            return;
        }

        try {
            setIsUpdating(true);
            await updateUserInfo({ nickname: editNickname.trim() });
            await loadUser();
            setEditModalVisible(false);
            setIsPasswordVerified(false);
            Alert.alert('성공', '닉네임이 변경되었습니다.');
        } catch (error: any) {
            Alert.alert('오류', error.response?.data?.message || '닉네임 변경에 실패했습니다.');
        } finally {
            setIsUpdating(false);
        }
    };

    // 비밀번호 변경
    const handleChangePassword = async () => {
        if (!currentPassword || !newPassword || !confirmPassword) {
            Alert.alert('알림', '모든 필드를 입력해주세요.');
            return;
        }
        if (newPassword !== confirmPassword) {
            Alert.alert('알림', '새 비밀번호가 일치하지 않습니다.');
            return;
        }
        if (newPassword.length < 6) {
            Alert.alert('알림', '비밀번호는 6자 이상이어야 합니다.');
            return;
        }

        try {
            setIsChangingPassword(true);
            await updateUserInfo({
                currentPassword,
                newPassword
            });
            setChangePasswordModalVisible(false);
            setCurrentPassword('');
            setNewPassword('');
            setConfirmPassword('');
            Alert.alert('성공', '비밀번호가 변경되었습니다.');
        } catch (error: any) {
            Alert.alert('오류', error.response?.data?.message || '비밀번호 변경에 실패했습니다.');
        } finally {
            setIsChangingPassword(false);
        }
    };

    return (
        <View style={styles.container}>
            <View style={styles.profileCard}>
                <TouchableOpacity onPress={handleChangeProfileImage} disabled={isUpdating}>
                    {user?.profileImg ? (
                        <Image
                            source={{ uri: `${API_BASE_URL}/profile/${user.profileImg}` }}
                            style={styles.avatar}
                        />
                    ) : (
                        <View style={styles.avatarPlaceholder}>
                            <Text style={styles.avatarText}>
                                {user?.nickname?.charAt(0) || '?'}
                            </Text>
                        </View>
                    )}
                    <View style={styles.editBadge}>
                        <Text style={styles.editBadgeText}>📷</Text>
                    </View>
                </TouchableOpacity>
                <Text style={styles.nickname}>{user?.nickname || '사용자'}</Text>
                <Text style={styles.userId}>@{user?.id || 'unknown'}</Text>
            </View>

            <View style={styles.menu}>
                <TouchableOpacity
                    style={styles.menuItem}
                    onPress={() => setPasswordModalVisible(true)}
                >
                    <Text style={styles.menuText}>프로필 수정</Text>
                    <Text style={styles.menuArrow}>›</Text>
                </TouchableOpacity>
                <TouchableOpacity
                    style={styles.menuItem}
                    onPress={() => setChangePasswordModalVisible(true)}
                >
                    <Text style={styles.menuText}>비밀번호 변경</Text>
                    <Text style={styles.menuArrow}>›</Text>
                </TouchableOpacity>
                <TouchableOpacity
                    style={styles.menuItem}
                    onPress={() => router.push('/settings/notifications')}
                >
                    <Text style={styles.menuText}>알림 설정</Text>
                    <Text style={styles.menuArrow}>›</Text>
                </TouchableOpacity>
            </View>

            <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
                <Text style={styles.logoutText}>로그아웃</Text>
            </TouchableOpacity>

            {/* 비밀번호 확인 모달 */}
            <Modal
                visible={passwordModalVisible}
                animationType="fade"
                transparent={true}
                onRequestClose={() => setPasswordModalVisible(false)}
            >
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <Text style={styles.modalTitle}>비밀번호 확인</Text>
                        <Text style={styles.modalSubtitle}>프로필 수정을 위해 비밀번호를 입력해주세요.</Text>
                        <TextInput
                            style={styles.modalInput}
                            value={verifyPasswordInput}
                            onChangeText={setVerifyPasswordInput}
                            placeholder="비밀번호"
                            placeholderTextColor={Colors.textMuted}
                            secureTextEntry
                        />
                        <View style={styles.modalButtons}>
                            <TouchableOpacity
                                style={styles.modalCancelButton}
                                onPress={() => {
                                    setPasswordModalVisible(false);
                                    setVerifyPasswordInput('');
                                }}
                            >
                                <Text style={styles.modalCancelText}>취소</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={styles.modalConfirmButton}
                                onPress={handleVerifyPassword}
                                disabled={isVerifying}
                            >
                                {isVerifying ? (
                                    <ActivityIndicator color={Colors.textInverse} />
                                ) : (
                                    <Text style={styles.modalConfirmText}>확인</Text>
                                )}
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>

            {/* 프로필 수정 모달 */}
            <Modal
                visible={editModalVisible}
                animationType="slide"
                transparent={true}
                onRequestClose={() => setEditModalVisible(false)}
            >
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <Text style={styles.modalTitle}>프로필 수정</Text>
                        <Text style={styles.inputLabel}>닉네임</Text>
                        <TextInput
                            style={styles.modalInput}
                            value={editNickname}
                            onChangeText={setEditNickname}
                            placeholder="닉네임"
                            placeholderTextColor={Colors.textMuted}
                        />
                        <View style={styles.modalButtons}>
                            <TouchableOpacity
                                style={styles.modalCancelButton}
                                onPress={() => {
                                    setEditModalVisible(false);
                                    setIsPasswordVerified(false);
                                }}
                            >
                                <Text style={styles.modalCancelText}>취소</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={styles.modalConfirmButton}
                                onPress={handleUpdateNickname}
                                disabled={isUpdating}
                            >
                                {isUpdating ? (
                                    <ActivityIndicator color={Colors.textInverse} />
                                ) : (
                                    <Text style={styles.modalConfirmText}>저장</Text>
                                )}
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>

            {/* 비밀번호 변경 모달 */}
            <Modal
                visible={changePasswordModalVisible}
                animationType="slide"
                transparent={true}
                onRequestClose={() => setChangePasswordModalVisible(false)}
            >
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <Text style={styles.modalTitle}>비밀번호 변경</Text>
                        <TextInput
                            style={styles.modalInput}
                            value={currentPassword}
                            onChangeText={setCurrentPassword}
                            placeholder="현재 비밀번호"
                            placeholderTextColor={Colors.textMuted}
                            secureTextEntry
                        />
                        <TextInput
                            style={styles.modalInput}
                            value={newPassword}
                            onChangeText={setNewPassword}
                            placeholder="새 비밀번호"
                            placeholderTextColor={Colors.textMuted}
                            secureTextEntry
                        />
                        <TextInput
                            style={styles.modalInput}
                            value={confirmPassword}
                            onChangeText={setConfirmPassword}
                            placeholder="새 비밀번호 확인"
                            placeholderTextColor={Colors.textMuted}
                            secureTextEntry
                        />
                        <View style={styles.modalButtons}>
                            <TouchableOpacity
                                style={styles.modalCancelButton}
                                onPress={() => {
                                    setChangePasswordModalVisible(false);
                                    setCurrentPassword('');
                                    setNewPassword('');
                                    setConfirmPassword('');
                                }}
                            >
                                <Text style={styles.modalCancelText}>취소</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={styles.modalConfirmButton}
                                onPress={handleChangePassword}
                                disabled={isChangingPassword}
                            >
                                {isChangingPassword ? (
                                    <ActivityIndicator color={Colors.textInverse} />
                                ) : (
                                    <Text style={styles.modalConfirmText}>변경</Text>
                                )}
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
        padding: Spacing.lg,
    },
    profileCard: {
        backgroundColor: Colors.bgCard,
        borderRadius: BorderRadius.lg,
        padding: Spacing.xl,
        alignItems: 'center',
        marginBottom: Spacing.lg,
    },
    avatar: {
        width: 80,
        height: 80,
        borderRadius: 40,
        marginBottom: Spacing.md,
    },
    avatarPlaceholder: {
        width: 80,
        height: 80,
        borderRadius: 40,
        backgroundColor: Colors.primary,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: Spacing.md,
    },
    avatarText: {
        color: Colors.textInverse,
        fontSize: FontSize.xxxl,
        fontWeight: 'bold',
    },
    editBadge: {
        position: 'absolute',
        bottom: Spacing.md,
        right: -4,
        backgroundColor: Colors.bgCard,
        borderRadius: 12,
        width: 24,
        height: 24,
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: Colors.borderColor,
    },
    editBadgeText: {
        fontSize: 12,
    },
    nickname: {
        fontSize: FontSize.xl,
        fontWeight: 'bold',
        color: Colors.textPrimary,
        marginBottom: Spacing.xs,
    },
    userId: {
        fontSize: FontSize.sm,
        color: Colors.textSecondary,
    },
    menu: {
        backgroundColor: Colors.bgCard,
        borderRadius: BorderRadius.lg,
        marginBottom: Spacing.lg,
    },
    menuItem: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: Spacing.lg,
        borderBottomWidth: 1,
        borderBottomColor: Colors.borderColor,
    },
    menuText: {
        fontSize: FontSize.base,
        color: Colors.textPrimary,
    },
    menuArrow: {
        fontSize: FontSize.xl,
        color: Colors.textMuted,
    },
    logoutButton: {
        backgroundColor: Colors.dangerLight,
        borderRadius: BorderRadius.md,
        padding: Spacing.lg,
        alignItems: 'center',
    },
    logoutText: {
        color: Colors.danger,
        fontSize: FontSize.base,
        fontWeight: '600',
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
        maxWidth: 340,
    },
    modalTitle: {
        fontSize: FontSize.lg,
        fontWeight: 'bold',
        color: Colors.textPrimary,
        marginBottom: Spacing.sm,
        textAlign: 'center',
    },
    modalSubtitle: {
        fontSize: FontSize.sm,
        color: Colors.textSecondary,
        marginBottom: Spacing.lg,
        textAlign: 'center',
    },
    inputLabel: {
        fontSize: FontSize.sm,
        color: Colors.textSecondary,
        marginBottom: Spacing.sm,
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
        marginBottom: Spacing.md,
    },
    modalButtons: {
        flexDirection: 'row',
        marginTop: Spacing.md,
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
