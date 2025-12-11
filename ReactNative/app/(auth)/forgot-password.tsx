import { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert, KeyboardAvoidingView, Platform } from 'react-native';
import { router } from 'expo-router';
import { forgotPassword } from '../../api/auth';
import { Colors, Spacing, BorderRadius, FontSize } from '../../constants/theme';

export default function ForgotPasswordScreen() {
    const [email, setEmail] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [isSent, setIsSent] = useState(false);

    const handleSubmit = async () => {
        if (!email) {
            Alert.alert('알림', '이메일을 입력해주세요.');
            return;
        }

        setIsLoading(true);
        try {
            await forgotPassword(email);
            setIsSent(true);
        } catch (error: any) {
            Alert.alert('오류', error.response?.data?.message || '요청에 실패했습니다.');
        } finally {
            setIsLoading(false);
        }
    };

    if (isSent) {
        return (
            <View style={styles.container}>
                <View style={styles.content}>
                    <Text style={styles.title}>이메일 전송 완료</Text>
                    <Text style={styles.subtitle}>
                        입력하신 이메일로 비밀번호 재설정 링크를 보냈습니다.
                    </Text>
                    <TouchableOpacity
                        style={styles.button}
                        onPress={() => router.back()}
                    >
                        <Text style={styles.buttonText}>로그인으로 돌아가기</Text>
                    </TouchableOpacity>
                </View>
            </View>
        );
    }

    return (
        <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            style={styles.container}
        >
            <View style={styles.content}>
                <Text style={styles.title}>비밀번호 찾기</Text>
                <Text style={styles.subtitle}>
                    가입 시 사용한 이메일을 입력하세요.
                </Text>

                <View style={styles.form}>
                    <TextInput
                        style={styles.input}
                        placeholder="이메일"
                        placeholderTextColor={Colors.textMuted}
                        value={email}
                        onChangeText={setEmail}
                        keyboardType="email-address"
                        autoCapitalize="none"
                    />

                    <TouchableOpacity
                        style={[styles.button, isLoading && styles.buttonDisabled]}
                        onPress={handleSubmit}
                        disabled={isLoading}
                    >
                        <Text style={styles.buttonText}>
                            {isLoading ? '전송 중...' : '비밀번호 재설정 요청'}
                        </Text>
                    </TouchableOpacity>

                    <TouchableOpacity onPress={() => router.back()} style={styles.backLink}>
                        <Text style={styles.link}>← 로그인으로 돌아가기</Text>
                    </TouchableOpacity>
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
    title: {
        fontSize: FontSize.xxxl,
        fontWeight: 'bold',
        color: Colors.textPrimary,
        textAlign: 'center',
        marginBottom: Spacing.sm,
    },
    subtitle: {
        fontSize: FontSize.base,
        color: Colors.textSecondary,
        textAlign: 'center',
        marginBottom: Spacing.xxl,
    },
    form: {
        gap: Spacing.lg,
    },
    input: {
        backgroundColor: Colors.bgInput,
        borderWidth: 1,
        borderColor: Colors.borderColor,
        borderRadius: BorderRadius.md,
        padding: Spacing.lg,
        fontSize: FontSize.base,
        color: Colors.textPrimary,
    },
    button: {
        backgroundColor: Colors.primary,
        borderRadius: BorderRadius.md,
        padding: Spacing.lg,
        alignItems: 'center',
    },
    buttonDisabled: {
        backgroundColor: Colors.textMuted,
    },
    buttonText: {
        color: Colors.textInverse,
        fontSize: FontSize.lg,
        fontWeight: '600',
    },
    backLink: {
        alignItems: 'center',
        marginTop: Spacing.md,
    },
    link: {
        color: Colors.primary,
        fontSize: FontSize.sm,
    },
});
