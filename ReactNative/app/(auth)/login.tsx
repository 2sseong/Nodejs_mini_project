import { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert, KeyboardAvoidingView, Platform, Image } from 'react-native';
import { router } from 'expo-router';
import { login } from '../../api/auth';
import * as SecureStore from 'expo-secure-store';
import { Colors, Spacing, BorderRadius, FontSize } from '../../constants/theme';

export default function LoginScreen() {
    const [form, setForm] = useState({ email: '', password: '' });
    const [showPw, setShowPw] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');

    // 유효성 검사 (Client와 동일)
    const validate = (): string => {
        if (!form.email.trim()) return '이메일을 입력해 주세요.';
        if (!/^\S+@\S+\.\S+$/.test(form.email)) return '이메일 형식이 올바르지 않습니다.';
        if (!form.password) return '비밀번호를 입력해 주세요.';
        if (form.password.length < 4) return '비밀번호는 4자 이상이어야 합니다.';
        return '';
    };

    const handleLogin = async () => {
        const validationError = validate();
        if (validationError) {
            setError(validationError);
            return;
        }

        setError('');
        setIsLoading(true);

        try {
            // login 함수 호출 (email/password)
            const data = await login({ email: form.email, password: form.password });

            if (data.token && data.user) {
                // SecureStore에 인증 정보 저장 (Client의 localStorage와 동일)
                await SecureStore.setItemAsync('authToken', data.token);
                await SecureStore.setItemAsync('userId', data.user.userId.toString());
                await SecureStore.setItemAsync('userNickname', data.user.nickname);
                await SecureStore.setItemAsync('username', data.user.username || '');
                await SecureStore.setItemAsync('userData', JSON.stringify(data.user));

                // 채팅방 목록 페이지로 이동
                router.replace('/(tabs)/rooms');
            } else {
                throw new Error('서버 응답에서 유효한 인증 토큰을 받지 못했습니다.');
            }
        } catch (err: any) {
            setError(err.message || '알 수 없는 오류가 발생했습니다.');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            style={styles.container}
        >
            <View style={styles.content}>
                {/* 로고 */}
                <View style={styles.logoContainer}>
                    <Text style={styles.logoText}>💬</Text>
                    <Text style={styles.title}>엠아이토크</Text>
                </View>

                <View style={styles.form}>
                    {/* 이메일 입력 */}
                    <View style={styles.field}>
                        <Text style={styles.label}>이메일</Text>
                        <TextInput
                            style={styles.input}
                            placeholder="you@example.com"
                            placeholderTextColor={Colors.textMuted}
                            value={form.email}
                            onChangeText={(text) => setForm({ ...form, email: text })}
                            autoCapitalize="none"
                            keyboardType="email-address"
                            autoComplete="email"
                        />
                    </View>

                    {/* 비밀번호 입력 */}
                    <View style={styles.field}>
                        <Text style={styles.label}>비밀번호</Text>
                        <View style={styles.pwBox}>
                            <TextInput
                                style={styles.pwInput}
                                placeholder="비밀번호"
                                placeholderTextColor={Colors.textMuted}
                                value={form.password}
                                onChangeText={(text) => setForm({ ...form, password: text })}
                                secureTextEntry={!showPw}
                                autoComplete="password"
                            />
                            <TouchableOpacity
                                style={styles.pwToggle}
                                onPress={() => setShowPw(!showPw)}
                            >
                                <Text style={styles.pwToggleText}>
                                    {showPw ? '숨김' : '보기'}
                                </Text>
                            </TouchableOpacity>
                        </View>
                    </View>

                    {/* 에러 메시지 */}
                    {error ? <Text style={styles.error}>{error}</Text> : null}

                    {/* 로그인 버튼 */}
                    <TouchableOpacity
                        style={[styles.button, isLoading && styles.buttonDisabled]}
                        onPress={handleLogin}
                        disabled={isLoading}
                    >
                        <Text style={styles.buttonText}>
                            {isLoading ? '로그인 중…' : '로그인'}
                        </Text>
                    </TouchableOpacity>

                    {/* 링크들 */}
                    <View style={styles.helpRow}>
                        <TouchableOpacity onPress={() => router.push('/(auth)/forgot-password')}>
                            <Text style={styles.link}>비밀번호 찾기</Text>
                        </TouchableOpacity>
                        <TouchableOpacity onPress={() => router.push('/(auth)/signup')}>
                            <Text style={styles.link}>회원가입</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </View>
        </KeyboardAvoidingView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: Colors.bgPage,
    },
    content: {
        flex: 1,
        justifyContent: 'center',
        padding: Spacing.xl,
    },
    logoContainer: {
        alignItems: 'center',
        marginBottom: Spacing.xxl,
    },
    logoText: {
        fontSize: 60,
        marginBottom: Spacing.sm,
    },
    title: {
        fontSize: FontSize.xxxl,
        fontWeight: 'bold',
        color: Colors.textPrimary,
    },
    form: {
        gap: Spacing.md,
    },
    field: {
        marginBottom: Spacing.sm,
    },
    label: {
        fontSize: FontSize.sm,
        fontWeight: '500',
        color: Colors.textPrimary,
        marginBottom: Spacing.xs,
    },
    input: {
        backgroundColor: Colors.bgInput,
        borderWidth: 1,
        borderColor: Colors.borderColor,
        borderRadius: BorderRadius.md,
        padding: Spacing.md,
        fontSize: FontSize.base,
        color: Colors.textPrimary,
    },
    pwBox: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: Colors.bgInput,
        borderWidth: 1,
        borderColor: Colors.borderColor,
        borderRadius: BorderRadius.md,
    },
    pwInput: {
        flex: 1,
        padding: Spacing.md,
        fontSize: FontSize.base,
        color: Colors.textPrimary,
    },
    pwToggle: {
        paddingHorizontal: Spacing.md,
        paddingVertical: Spacing.md,
    },
    pwToggleText: {
        color: Colors.primary,
        fontSize: FontSize.sm,
    },
    error: {
        color: Colors.danger,
        fontSize: FontSize.sm,
        textAlign: 'center',
        marginTop: Spacing.sm,
    },
    button: {
        backgroundColor: Colors.primary,
        borderRadius: BorderRadius.md,
        padding: Spacing.lg,
        alignItems: 'center',
        marginTop: Spacing.md,
    },
    buttonDisabled: {
        backgroundColor: Colors.textMuted,
    },
    buttonText: {
        color: Colors.textInverse,
        fontSize: FontSize.lg,
        fontWeight: '600',
    },
    helpRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginTop: Spacing.lg,
    },
    link: {
        color: Colors.primary,
        fontSize: FontSize.sm,
    },
});
