import { useState, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert, ScrollView, KeyboardAvoidingView, Platform } from 'react-native';
import { router } from 'expo-router';
import { signup, getDepartments, getPositions } from '../../api/auth';
import { Colors, Spacing, BorderRadius, FontSize } from '../../constants/theme';

interface Department {
    deptId: number;
    deptName: string;
}

interface Position {
    posId: number;
    posName: string;
}

export default function SignupScreen() {
    const [form, setForm] = useState({
        email: '',
        password: '',
        confirmPassword: '',
        nickname: '',
        deptId: 0,
        posId: 0,
        phone: '',
    });
    const [isLoading, setIsLoading] = useState(false);
    const [deptList, setDeptList] = useState<Department[]>([]);
    const [posList, setPosList] = useState<Position[]>([]);
    const [showDeptPicker, setShowDeptPicker] = useState(false);
    const [showPosPicker, setShowPosPicker] = useState(false);

    // 부서/직급 목록 로드
    useEffect(() => {
        const fetchOptions = async () => {
            try {
                const depts = await getDepartments();
                const positions = await getPositions();
                setDeptList(depts);
                setPosList(positions);

                if (depts.length > 0) setForm(prev => ({ ...prev, deptId: depts[0].deptId }));
                if (positions.length > 0) setForm(prev => ({ ...prev, posId: positions[0].posId }));
            } catch (error) {
                console.error('부서/직급 정보를 불러오는데 실패했습니다.', error);
            }
        };
        fetchOptions();
    }, []);

    const selectedDept = deptList.find(d => d.deptId === form.deptId);
    const selectedPos = posList.find(p => p.posId === form.posId);

    const handleSignup = async () => {
        const { email, password, confirmPassword, nickname, deptId, posId, phone } = form;

        if (!email || !password || !nickname || !deptId || !posId || !phone) {
            Alert.alert('알림', '모든 필드를 입력해주세요.');
            return;
        }

        if (password !== confirmPassword) {
            Alert.alert('알림', '비밀번호가 일치하지 않습니다.');
            return;
        }

        const formatPhone = (rawPhone: string) => {
            const digits = rawPhone.replace(/\D/g, '');
            if (digits.length === 11) {
                return `${digits.slice(0, 3)}-${digits.slice(3, 7)}-${digits.slice(7)}`;
            } else if (digits.length === 10) {
                return `${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6)}`;
            }
            return digits;
        };

        setIsLoading(true);
        try {
            const result = await signup({
                email,
                password,
                nickname,
                deptId: Number(deptId),
                posId: Number(posId),
                phone: formatPhone(phone),
            });

            if (result.ok) {
                Alert.alert('성공', result.data.message || '회원가입이 완료되었습니다.', [
                    { text: '확인', onPress: () => router.back() }
                ]);
            } else {
                Alert.alert('회원가입 실패', result.data.message || '회원가입에 실패했습니다.');
            }
        } catch (error: any) {
            Alert.alert('회원가입 실패', error.response?.data?.message || '회원가입에 실패했습니다.');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            style={styles.container}
        >
            <ScrollView contentContainerStyle={styles.content}>
                <Text style={styles.title}>회원가입</Text>

                <View style={styles.form}>
                    {/* 이메일 */}
                    <View style={styles.field}>
                        <Text style={styles.label}>이메일 *</Text>
                        <TextInput
                            style={styles.input}
                            placeholder="you@example.com"
                            placeholderTextColor={Colors.textMuted}
                            value={form.email}
                            onChangeText={(text) => setForm({ ...form, email: text })}
                            autoCapitalize="none"
                            keyboardType="email-address"
                        />
                    </View>

                    {/* 닉네임 */}
                    <View style={styles.field}>
                        <Text style={styles.label}>이름 *</Text>
                        <TextInput
                            style={styles.input}
                            placeholder="이름"
                            placeholderTextColor={Colors.textMuted}
                            value={form.nickname}
                            onChangeText={(text) => setForm({ ...form, nickname: text })}
                        />
                    </View>

                    {/* 부서 선택 */}
                    <View style={styles.field}>
                        <Text style={styles.label}>부서 *</Text>
                        <TouchableOpacity
                            style={styles.selectButton}
                            onPress={() => setShowDeptPicker(!showDeptPicker)}
                        >
                            <Text style={styles.selectText}>
                                {selectedDept?.deptName || '부서를 선택하세요'}
                            </Text>
                            <Text style={styles.selectArrow}>▼</Text>
                        </TouchableOpacity>
                        {showDeptPicker && (
                            <View style={styles.optionList}>
                                {deptList.map((dept) => (
                                    <TouchableOpacity
                                        key={dept.deptId}
                                        style={[styles.option, form.deptId === dept.deptId && styles.optionSelected]}
                                        onPress={() => {
                                            setForm({ ...form, deptId: dept.deptId });
                                            setShowDeptPicker(false);
                                        }}
                                    >
                                        <Text style={styles.optionText}>{dept.deptName}</Text>
                                    </TouchableOpacity>
                                ))}
                            </View>
                        )}
                    </View>

                    {/* 직급 선택 */}
                    <View style={styles.field}>
                        <Text style={styles.label}>직급 *</Text>
                        <TouchableOpacity
                            style={styles.selectButton}
                            onPress={() => setShowPosPicker(!showPosPicker)}
                        >
                            <Text style={styles.selectText}>
                                {selectedPos?.posName || '직급을 선택하세요'}
                            </Text>
                            <Text style={styles.selectArrow}>▼</Text>
                        </TouchableOpacity>
                        {showPosPicker && (
                            <View style={styles.optionList}>
                                {posList.map((pos) => (
                                    <TouchableOpacity
                                        key={pos.posId}
                                        style={[styles.option, form.posId === pos.posId && styles.optionSelected]}
                                        onPress={() => {
                                            setForm({ ...form, posId: pos.posId });
                                            setShowPosPicker(false);
                                        }}
                                    >
                                        <Text style={styles.optionText}>{pos.posName}</Text>
                                    </TouchableOpacity>
                                ))}
                            </View>
                        )}
                    </View>

                    {/* 전화번호 */}
                    <View style={styles.field}>
                        <Text style={styles.label}>전화번호 *</Text>
                        <TextInput
                            style={styles.input}
                            placeholder="01012345678 (- 없이)"
                            placeholderTextColor={Colors.textMuted}
                            value={form.phone}
                            onChangeText={(text) => setForm({ ...form, phone: text })}
                            keyboardType="phone-pad"
                        />
                    </View>

                    {/* 비밀번호 */}
                    <View style={styles.field}>
                        <Text style={styles.label}>비밀번호 *</Text>
                        <TextInput
                            style={styles.input}
                            placeholder="비밀번호"
                            placeholderTextColor={Colors.textMuted}
                            value={form.password}
                            onChangeText={(text) => setForm({ ...form, password: text })}
                            secureTextEntry
                        />
                    </View>

                    {/* 비밀번호 확인 */}
                    <View style={styles.field}>
                        <Text style={styles.label}>비밀번호 확인 *</Text>
                        <TextInput
                            style={styles.input}
                            placeholder="비밀번호 확인"
                            placeholderTextColor={Colors.textMuted}
                            value={form.confirmPassword}
                            onChangeText={(text) => setForm({ ...form, confirmPassword: text })}
                            secureTextEntry
                        />
                    </View>

                    <TouchableOpacity
                        style={[styles.button, isLoading && styles.buttonDisabled]}
                        onPress={handleSignup}
                        disabled={isLoading}
                    >
                        <Text style={styles.buttonText}>
                            {isLoading ? '가입 중...' : '회원가입'}
                        </Text>
                    </TouchableOpacity>

                    <TouchableOpacity onPress={() => router.back()} style={styles.backLink}>
                        <Text style={styles.link}>← 로그인으로 돌아가기</Text>
                    </TouchableOpacity>
                </View>
            </ScrollView>
        </KeyboardAvoidingView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: Colors.bgPage,
    },
    content: {
        flexGrow: 1,
        padding: Spacing.xl,
        paddingTop: Spacing.xxl,
    },
    title: {
        fontSize: FontSize.xxxl,
        fontWeight: 'bold',
        color: Colors.textPrimary,
        textAlign: 'center',
        marginBottom: Spacing.xl,
    },
    form: {
        gap: Spacing.sm,
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
    selectButton: {
        backgroundColor: Colors.bgInput,
        borderWidth: 1,
        borderColor: Colors.borderColor,
        borderRadius: BorderRadius.md,
        padding: Spacing.md,
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    selectText: {
        fontSize: FontSize.base,
        color: Colors.textPrimary,
    },
    selectArrow: {
        fontSize: FontSize.sm,
        color: Colors.textMuted,
    },
    optionList: {
        backgroundColor: Colors.bgCard,
        borderWidth: 1,
        borderColor: Colors.borderColor,
        borderRadius: BorderRadius.md,
        marginTop: Spacing.xs,
    },
    option: {
        padding: Spacing.md,
        borderBottomWidth: 1,
        borderBottomColor: Colors.borderColor,
    },
    optionSelected: {
        backgroundColor: Colors.bgHover,
    },
    optionText: {
        fontSize: FontSize.base,
        color: Colors.textPrimary,
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
    backLink: {
        alignItems: 'center',
        marginTop: Spacing.lg,
    },
    link: {
        color: Colors.primary,
        fontSize: FontSize.sm,
    },
});
