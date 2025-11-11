import React, { useState } from 'react';
import {
    View,
    Text,
    TextInput,
    TouchableOpacity,
    StyleSheet,
    Dimensions,
    ActivityIndicator,
    Alert // React Native의 기본 알림 모듈
} from 'react-native';

// 백엔드 서버 주소
const BACKEND_URL = 'http://localhost:1337';

// PC 레이아웃을 위해 창 크기를 가져옵니다.
const { width } = Dimensions.get('window');

/**
 * @function safeMessage
 * @description HTTP 응답에서 JSON 메시지나 오류를 안전하게 추출합니다.
 * @param {Response} res - fetch API의 응답 객체입니다.
 * @returns {Promise<string>} - 추출된 메시지 또는 오류 문자열입니다.
 * 시간 복잡도: O(1) (네트워크 I/O 및 JSON 파싱 시간 제외)
 */
async function safeMessage(res) {
    let t = ''; // 텍스트 변수를 try 블록 밖으로 이동
    try {
        t = await res.text();
        if (!t) return '응답 본문 없음';
        
        // 서버가 JSON이 아닌 일반 텍스트를 보낸 경우를 대비해 시도
        const json = JSON.parse(t);
        return json.message || json.error || '';
    } catch (e) {
        // 🚨 서버가 보낸 원본 텍스트를 콘솔에 출력합니다.
        console.error("JSON 파싱 오류 발생. 서버 응답 텍스트:", t);
        console.error("파싱 오류 상세:", e);
        
        // 원본 텍스트가 유의미한 메시지일 수 있으므로 그대로 반환 시도
        if (t && t.length < 100) {
             return t; // 서버가 보낸 순수 텍스트를 메시지로 사용
        }
        
        // 오류가 발생해도 사용자에게는 간단한 메시지 전달
        return `서버 응답 형식 오류 (HTTP ${res.status})`; 
    }
}

/**
 * @function LoginPage
 * @description PC 앱 환경에 최적화된 로그인 폼 컴포넌트입니다.
 * @param {object} props
 * @param {() => void} props.onLoginSuccess - 로그인 성공 시 호출될 콜백 함수입니다.
 * 시간 복잡도: O(1) (상태 업데이트 및 렌더링)
 */
const LoginPage = ({ onLoginSuccess }) => {
    // 상태 관리: O(1)
    const [form, setForm] = useState({ email: '', password: '' });
    const [showPw, setShowPw] = useState(false);
    const [loading, setLoading] = useState(false);

    /**
     * @function onChange
     * @description 입력 값 변경 핸들러.
     * 시간 복잡도: O(1)
     */
    const onChange = (name, value) => {
        setForm(prev => ({ ...prev, [name]: value }));
    };

    /**
     * @function validate
     * @description 폼 입력 유효성 검사.
     * 시간 복잡도: O(1) (정규식 검사는 입력 길이에 비례하지만, 상수 시간으로 간주)
     */
    const validate = () => {
        if (!form.email.trim()) return '이메일을 입력해 주세요.';
        if (!/^\S+@\S+\.\S+$/.test(form.email)) return '이메일 형식이 올바르지 않습니다.';
        if (!form.password) return '비밀번호를 입력해 주세요.';
        if (form.password.length < 4) return '비밀번호는 4자 이상이어야 합니다.';
        return '';
    };

    /**
     * @function onSubmit
     * @description 로그인 제출 로직.
     * 시간 복잡도: O(1) (네트워크 지연 제외)
     */
    const onSubmit = async () => {
        const validationError = validate();
        if (validationError) {
            // React Native의 Alert 사용
            return Alert.alert('입력 오류', validationError);
        }

        setLoading(true);
        
        try {
            const url = `${BACKEND_URL}/api/login`;
            
            const res = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(form),
            });

            if (!res.ok) {
                const msg = await safeMessage(res);
                throw new Error(msg || `로그인 실패 (${res.status})`);
            }

            const data = await res.json();

            if (data.token && data.user) {
                // 실제 RN 앱에서는 AsyncStorage 등에 저장합니다.
                global.tempAuth = {
                    authToken: data.token,
                    userId: data.user.userId,
                    userNickname: data.user.nickname
                };
                
                Alert.alert("로그인 성공", "채팅 서버에 접속했습니다.");
                if (onLoginSuccess) onLoginSuccess();
                
            } else {
                throw new Error("서버 응답에서 유효한 인증 정보를 받지 못했습니다.");
            }
        } catch (err) {
            Alert.alert('로그인 오류', err.message || '알 수 없는 오류가 발생했습니다.');
        } finally {
            setLoading(false);
        }
    };

    // PC 앱처럼 보이도록, 화면 너비의 일부(최대 500px)를 사용합니다.
    const loginCardWidth = Math.min(width * 0.8, 500);

    return (
        <View style={styles.loginContainer}>
            <View style={[styles.card, { width: loginCardWidth }]}>
                <Text style={styles.header}>PC 채팅 클라이언트</Text>
                <Text style={styles.subHeader}>로그인하여 실시간 채팅 서비스에 접속하세요.</Text>

                {/* 이메일 입력 필드 */}
                <View style={styles.inputGroup}>
                    <Text style={styles.inputLabel}>이메일 주소</Text>
                    <TextInput
                        style={styles.textInput}
                        placeholder="이메일을 입력하세요"
                        value={form.email}
                        onChangeText={(v) => onChange('email', v)}
                        keyboardType="email-address"
                        autoCapitalize="none"
                        autoCorrect={false}
                        placeholderTextColor="#9CA3AF"
                    />
                </View>

                {/* 비밀번호 입력 필드 */}
                <View style={styles.inputGroup}>
                    <Text style={styles.inputLabel}>비밀번호</Text>
                    <View style={styles.passwordContainer}>
                        <TextInput
                            style={styles.passwordInput}
                            placeholder="비밀번호를 입력하세요"
                            value={form.password}
                            onChangeText={(v) => onChange('password', v)}
                            secureTextEntry={!showPw}
                            autoCapitalize="none"
                            autoCorrect={false}
                            placeholderTextColor="#9CA3AF"
                        />
                        <TouchableOpacity 
                            style={styles.showPwButton}
                            onPress={() => setShowPw(v => !v)}
                        >
                            <Text style={styles.showPwButtonText}>
                                {showPw ? '숨기기' : '보기'}
                            </Text>
                        </TouchableOpacity>
                    </View>
                </View>

                {/* 로그인 버튼 */}
                <TouchableOpacity
                    style={[styles.loginButton, loading && styles.loginButtonDisabled]}
                    onPress={onSubmit}
                    disabled={loading}
                    activeOpacity={0.7}
                >
                    {loading ? (
                        <ActivityIndicator color="#FFFFFF" size="small" />
                    ) : (
                        <Text style={styles.loginButtonText}>클라이언트 로그인</Text>
                    )}
                </TouchableOpacity>

                {/* 도움말 및 회원가입 링크 */}
                <View style={styles.linksContainer}>
                    <TouchableOpacity 
                        onPress={() => Alert.alert('비밀번호 찾기', '비밀번호 재설정 기능은 준비 중입니다.')}
                    >
                        <Text style={styles.linkText}>비밀번호 찾기</Text>
                    </TouchableOpacity>
                    <TouchableOpacity 
                        onPress={() => Alert.alert('회원가입', '회원가입 기능은 준비 중입니다.')}
                    >
                        <Text style={styles.registerLinkText}>회원가입</Text>
                    </TouchableOpacity>
                </View>
            </View>
        </View>
    );
};

/**
 * @function App
 * @description React Native 애플리케이션의 메인 컴포넌트입니다.
 * 이제 로그인 페이지만 렌더링합니다.
 */
export default function App() {
    
    return (
        <View style={styles.root}>
            <LoginPage 
                onLoginSuccess={() => {
                    console.log("App.jsx: 로그인 성공! (페이지 전환 로직 필요시 추가)");
                }}
            />
        </View>
    );
}

// React Native 스타일 시트 정의
const styles = StyleSheet.create({
    root: {
        flex: 1,
        backgroundColor: '#F3F4F6',
    },
    // --- Login Page Styles ---
    loginContainer: {
        flex: 1,
        backgroundColor: '#F9FAFB', // gray-50
        alignItems: 'center',
        justifyContent: 'center',
        padding: 48,
    },
    card: {
        backgroundColor: '#FFFFFF',
        borderRadius: 16,
        padding: 40,
        // RN에서 그림자 효과는 platform-specific합니다.
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.1,
        shadowRadius: 16,
        elevation: 10,
        borderWidth: 1,
        borderColor: '#E5E7EB', // gray-200
    },
    header: {
        fontSize: 32,
        fontWeight: '800', // Extrabold
        color: '#1D4ED8', // blue-800
        textAlign: 'center',
        marginBottom: 8,
    },
    subHeader: {
        fontSize: 16,
        color: '#6B7280', // gray-500
        textAlign: 'center',
        marginBottom: 40,
    },
    inputGroup: {
        marginBottom: 24,
    },
    inputLabel: {
        fontSize: 14,
        fontWeight: '600', // Semibold
        color: '#4B5563', // gray-700
        marginBottom: 8,
    },
    textInput: {
        height: 56,
        paddingHorizontal: 20,
        borderWidth: 1,
        borderColor: '#D1D5DB', // gray-300
        borderRadius: 12,
        fontSize: 18,
        backgroundColor: '#FFFFFF',
        color: '#1F2937', // gray-900
    },
    passwordContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: '#D1D5DB',
        borderRadius: 12,
        backgroundColor: '#FFFFFF',
    },
    passwordInput: {
        flex: 1,
        height: 56,
        paddingHorizontal: 20,
        fontSize: 18,
        color: '#1F2937', // gray-900
    },
    showPwButton: {
        paddingHorizontal: 20,
        height: 56,
        justifyContent: 'center',
    },
    showPwButtonText: {
        color: '#2563EB', // blue-600
        fontSize: 14,
        fontWeight: '600',
    },
    loginButton: {
        height: 64,
        borderRadius: 12,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#2563EB', // blue-600
        marginTop: 16,
        // RN에서 그림자 효과
        shadowColor: '#3B82F6', // blue-500
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 5,
        elevation: 8,
    },
    loginButtonDisabled: {
        backgroundColor: '#93C5FD', // blue-300
    },
    loginButtonText: {
        fontSize: 20,
        fontWeight: '800', // Extrabold
        color: '#FFFFFF',
    },
    linksContainer: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginTop: 32,
    },
    linkText: {
        fontSize: 14,
        color: '#6B7280', // gray-500
    },
    registerLinkText: {
        fontSize: 14,
        color: '#2563EB', // blue-600
        fontWeight: '600',
    },
});