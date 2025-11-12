import React, { useState } from 'react';
import MainPage from './MainPage.jsx';
import {
    View,
    Text,
    TextInput,
    TouchableOpacity,
    StyleSheet,
    Dimensions,
    ActivityIndicator,
    Alert, // React Native의 기본 알림 모듈
    ScrollView,
} from 'react-native';

// 백엔드 서버 주소
const BACKEND_URL = 'http://192.168.0.3:1337';

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
    let t = ''; 
    try {
        t = await res.text();
        if (!t) return '응답 본문 없음';
        
        const json = JSON.parse(t);
        return json.message || json.error || '';
    } catch (e) {
        console.error("JSON 파싱 오류 발생. 서버 응답 텍스트:", t);
        console.error("파싱 오류 상세:", e);
        
        if (t && t.length < 100) {
             return t; 
        }
        
        return `서버 응답 형식 오류 (HTTP ${res.status})`; 
    }
}

/**
 * @function LoginPage
 * @description PC 앱 환경에 최적화된 로그인 폼 컴포넌트입니다.
 * @param {object} props
 * @param {(user: object) => void} props.onLoginSuccess - 로그인 성공 시 호출될 콜백 함수입니다.
 * 시간 복잡도: O(1) (상태 업데이트 및 렌더링)
 */
const LoginPage = ({ onLoginSuccess }) => {
    const [form, setForm] = useState({ email: '', password: '' });
    const [showPw, setShowPw] = useState(false);
    const [loading, setLoading] = useState(false);

    const onChange = (name, value) => {
        setForm(prev => ({ ...prev, [name]: value }));
    };

    const validate = () => {
        if (!form.email.trim()) return '이메일을 입력해 주세요.';
        if (!/^\S+@\S+\.\S+$/.test(form.email)) return '이메일 형식이 올바르지 않습니다.';
        if (!form.password) return '비밀번호를 입력해 주세요.';
        if (form.password.length < 4) return '비밀번호는 4자 이상이어야 합니다.';
        return '';
    };

    const onSubmit = async () => {
        const validationError = validate();
        if (validationError) {
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
                
                Alert.alert("로그인 성공", `${data.user.nickname}님 환영합니다!`);
                // 로그인 성공 시 콜백 호출하며 사용자 정보 전달
                if (onLoginSuccess) onLoginSuccess(data.user); 
                
            } else {
                throw new Error("서버 응답에서 유효한 인증 정보를 받지 못했습니다.");
            }
        } catch (err) {
            Alert.alert('로그인 오류', err.message || '알 수 없는 오류가 발생했습니다.');
        } finally {
            setLoading(false);
        }
    };

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
 * 로그인 상태에 따라 페이지를 전환합니다.
 */
export default function App() {
    // 로그인 상태와 사용자 정보를 관리합니다.
    const [isLoggedIn, setIsLoggedIn] = useState(false);
    const [userInfo, setUserInfo] = useState(null);

    /**
     * @function handleLoginSuccess
     * @description 로그인 성공 시 호출되어 상태를 업데이트하고 페이지를 전환합니다.
     * @param {object} user - 사용자 정보 객체
     * 시간 복잡도: O(1)
     */
    const handleLoginSuccess = (user) => {
        setUserInfo(user);
        setIsLoggedIn(true);
    };

    /**
     * @function handleLogout
     * @description 로그아웃 버튼 클릭 시 호출되어 상태를 초기화하고 로그인 페이지로 전환합니다.
     * 시간 복잡도: O(1)
     */
    const handleLogout = () => {
        setIsLoggedIn(false);
        setUserInfo(null);
        if (global.tempAuth) delete global.tempAuth; // 임시 인증 정보 제거
        Alert.alert("로그아웃 완료", "다음에 다시 만나요!");
    };
    
    return (
        <View style={styles.root}>
            {isLoggedIn && userInfo ? (
                // 로그인 성공 시 메인 페이지 렌더링
                <MainPage 
                    onLogout={handleLogout} 
                    user={userInfo} 
                />
            ) : (
                // 로그인 전에는 로그인 페이지 렌더링
                <LoginPage 
                    onLoginSuccess={handleLoginSuccess}
                />
            )}
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
        backgroundColor: '#F9FAFB', 
        alignItems: 'center',
        justifyContent: 'center',
        padding: 48,
    },
    card: {
        backgroundColor: '#FFFFFF',
        borderRadius: 16,
        padding: 40,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.1,
        shadowRadius: 16,
        elevation: 10,
        borderWidth: 1,
        borderColor: '#E5E7EB', 
    },
    header: {
        fontSize: 32,
        fontWeight: '800', 
        color: '#1D4ED8', 
        textAlign: 'center',
        marginBottom: 8,
    },
    subHeader: {
        fontSize: 16,
        color: '#6B7280', 
        textAlign: 'center',
        marginBottom: 40,
    },
    inputGroup: {
        marginBottom: 24,
    },
    inputLabel: {
        fontSize: 14,
        fontWeight: '600', 
        color: '#4B5563', 
        marginBottom: 8,
    },
    textInput: {
        height: 56,
        paddingHorizontal: 20,
        borderWidth: 1,
        borderColor: '#D1D5DB', 
        borderRadius: 12,
        fontSize: 18,
        backgroundColor: '#FFFFFF',
        color: '#1F2937', 
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
        color: '#1F2937', 
    },
    showPwButton: {
        paddingHorizontal: 20,
        height: 56,
        justifyContent: 'center',
    },
    showPwButtonText: {
        color: '#2563EB', 
        fontSize: 14,
        fontWeight: '600',
    },
    loginButton: {
        height: 64,
        borderRadius: 12,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#2563EB', 
        marginTop: 16,
        shadowColor: '#3B82F6', 
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 5,
        elevation: 8,
    },
    loginButtonDisabled: {
        backgroundColor: '#93C5FD', 
    },
    loginButtonText: {
        fontSize: 20,
        fontWeight: '800', 
        color: '#FFFFFF',
    },
    linksContainer: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginTop: 32,
    },
    linkText: {
        fontSize: 14,
        color: '#6B7280', 
    },
    registerLinkText: {
        fontSize: 14,
        color: '#2563EB', 
        fontWeight: '600',
    },
    // --- Main Page Styles (임시) ---
    mainContainer: {
        flex: 1,
        backgroundColor: '#FFFFFF',
    },
    mainHeader: {
        height: 60,
        backgroundColor: '#1D4ED8', 
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 20,
        borderBottomWidth: 1,
        borderBottomColor: '#E5E7EB',
    },
    mainHeaderText: {
        fontSize: 18,
        fontWeight: '700',
        color: '#FFFFFF',
    },
    logoutButton: {
        paddingVertical: 5,
        paddingHorizontal: 10,
        backgroundColor: '#EF4444', 
        borderRadius: 8,
    },
    logoutButtonText: {
        color: '#FFFFFF',
        fontWeight: '600',
        fontSize: 14,
    },
    mainContent: {
        flexGrow: 1,
        padding: 20,
    },
    welcomeText: {
        fontSize: 24,
        fontWeight: 'bold',
        color: '#1F2937',
        marginBottom: 10,
    },
    infoText: {
        fontSize: 16,
        color: '#4B5563',
        marginBottom: 30,
    },
    placeholderText: {
        fontSize: 18,
        color: '#9CA3AF',
        textAlign: 'center',
        marginTop: 50,
        padding: 20,
        borderWidth: 1,
        borderColor: '#E5E7EB',
        borderStyle: 'dashed',
        borderRadius: 10,
    }
});