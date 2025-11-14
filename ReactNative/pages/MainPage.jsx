import { useState } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    Dimensions,
} from 'react-native';
import Roompage from './RoomPage.jsx'

// NOTE: 이 환경에서는 react-native-vector-icons 패키지를 직접 불러올 수 없으므로,
// 사용자 프로젝트에 'react-native-vector-icons/Feather'가 설치 및 링크되었다고 가정하고 코드를 작성합니다.
// 실제 사용 시 'react-native-vector-icons' 패키지를 설치해야 합니다.
import Feather from 'react-native-vector-icons/Feather'; 
// 이 환경에서 테스트를 위해 Feather 컴포넌트가 없다고 가정하고, 
// 경고 메시지 없이 실행되도록 아래와 같이 대체 아이콘 정의를 사용합니다.
/*const Icon = (props) => {
    // 개발 환경에 따라 아이콘이 표시되지 않을 경우를 대비한 텍스트 대체
    try {
        if (!Feather) throw new Error("Feather not available");
        return <Feather {...props} />;
    } catch (e) {
        return <Text style={{ color: props.color, fontSize: props.size, padding: 5 }}>[{props.name}]</Text>;
    }
}*/
const Icon = Feather;


// --- 1. 서브 페이지: UserPage (Placeholder) ---
/**
 * @function UserPage
 * @description 사용자 정보 및 프로필 설정을 표시하는 페이지입니다.
 * 시간 복잡도: O(1)
 */
const UserPage = () => (
    <View style={styles.contentPage}>
        <Text style={styles.contentHeader}>사용자 설정 👤</Text>
        <Text style={styles.contentSubText}>계정 정보, 개인 설정 등을 여기서 관리합니다.</Text>
        <Icon name="user" size={100} color="#4F46E5" style={{ marginTop: 50 }} />
    </View>
);

// --- 2. 서브 페이지: ChatPage (Placeholder) ---
/**
 * @function ChatPage
 * @description 실시간 채팅방 목록 및 대화 인터페이스를 표시하는 페이지입니다.
 * 시간 복잡도: O(1)
 */
const ChatPage = () => (
    <View style={styles.contentPage}>
        <Text style={styles.contentHeader}>실시간 채팅 💬</Text>
        <Text style={styles.contentSubText}>현재 활성화된 채팅방 목록을 표시합니다.</Text>
        <Icon name="message-square" size={100} color="#059669" style={{ marginTop: 50 }} />
    </View>
);

// --- 3. 메인 컴포넌트: MainPage ---
/**
 * @function MainPage
 * @description 사이드바 기반 탭 내비게이션을 구현하는 메인 레이아웃 컴포넌트입니다.
 * @param {object} props
 * @param {() => void} props.onLogout - 로그아웃 처리 함수입니다.
 * @param {object} props.userInfo - 로그인된 사용자 정보입니다.
 * 시간 복잡도: O(1) (상태 업데이트 및 렌더링)
 */
export default function MainPage({ onLogout, userInfo }) {
    // 현재 선택된 탭 상태 ('User' 또는 'Chat')를 관리합니다.
    const [currentTab, setCurrentTab] = useState('User'); 
    
    // 화면 너비를 사용하여 PC 환경에 최적화된 레이아웃 크기를 계산합니다.
    const { width } = Dimensions.get('window');
    const sidebarWidth = Math.min(width * 0.15, 80); // 최소 15% 또는 80px

    /**
     * @function renderContent
     * @description currentTab 상태에 따라 적절한 페이지 컴포넌트를 렌더링합니다.
     * 시간 복잡도: O(1)
     */
    const renderContent = () => {
        switch (currentTab) {
            case 'User':
                return <UserPage />;
            case 'Chat':
                return <Roompage />;
            default:
                return <UserPage />;
        }
    };
    
    // 사이드바 아이템 컴포넌트
    const SidebarItem = ({ name, label, iconName, isActive, onPress }) => (
        <TouchableOpacity 
            style={[styles.sidebarItem, isActive && styles.sidebarItemActive]}
            onPress={() => onPress(name)}
            activeOpacity={0.7}
        >
            <Icon 
                name={iconName} 
                size={24} 
                color={isActive ? '#FFFFFF' : '#9CA3AF'} // gray-400
            />
            <Text style={[styles.sidebarLabel, isActive && styles.sidebarLabelActive]}>
                {label}
            </Text>
        </TouchableOpacity>
    );

    return (
        <View style={styles.container}>
            {/* 1. Sidebar (PC 레이아웃의 왼쪽 내비게이션) */}
            <View style={[styles.sidebar, { width: sidebarWidth }]}>
                
                {/* 로고 영역 */}
                <View style={styles.logoArea}>
                    <Text style={styles.logoText}>C</Text>
                </View>

                {/* 내비게이션 아이콘 영역 */}
                <View style={styles.navArea}>
                    <SidebarItem
                        name="User"
                        label="사용자"
                        iconName="user"
                        isActive={currentTab === 'User'}
                        onPress={setCurrentTab}
                    />

                    <SidebarItem
                        name="Chat"
                        label="채팅"
                        iconName="message-square"
                        isActive={currentTab === 'Chat'}
                        onPress={setCurrentTab}
                    />
                    
                </View>

                {/* 로그아웃 영역 */}
                <TouchableOpacity 
                    style={styles.logoutButton}
                    onPress={onLogout}
                >
                    <Icon name="log-out" size={24} color="#FCA5A5" /> 
                </TouchableOpacity>
            </View>

            {/* 2. Main Content Area */}
            <View style={styles.mainContent}>
                {renderContent()}
            </View>
        </View>
    );
}

// --- 4. 스타일 시트 정의 ---
const styles = StyleSheet.create({
    container: {
        flex: 1,
        flexDirection: 'row',
        backgroundColor: '#F3F4F6', // gray-100
    },
    // --- Sidebar Styles ---
    sidebar: {
        backgroundColor: '#1F2937', // gray-900
        paddingVertical: 10,
        alignItems: 'center',
        justifyContent: 'space-between',
        borderRightWidth: 1,
        borderRightColor: '#4B5563', // gray-600
    },
    logoArea: {
        width: 48,
        height: 48,
        borderRadius: 12,
        backgroundColor: '#2563EB', // blue-600
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 20,
    },
    logoText: {
        fontSize: 24,
        fontWeight: 'bold',
        color: '#FFFFFF',
    },
    navArea: {
        flex: 1,
        width: '100%',
        alignItems: 'center',
        paddingTop: 10,
    },
    sidebarItem: {
        width: '80%',
        paddingVertical: 10,
        marginVertical: 4,
        borderRadius: 10,
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: 60,
    },
    sidebarItemActive: {
        backgroundColor: '#374151', // gray-700
    },
    sidebarLabel: {
        fontSize: 12,
        color: '#9CA3AF', // gray-400
        marginTop: 4,
    },
    sidebarLabelActive: {
        color: '#FFFFFF',
        fontWeight: '600',
    },
    logoutButton: {
        width: '80%',
        paddingVertical: 10,
        marginVertical: 10,
        borderRadius: 10,
        alignItems: 'center',
        justifyContent: 'center',
        borderTopWidth: 1,
        borderTopColor: '#374151',
    },
    
    // --- Main Content Styles ---
    mainContent: {
        flex: 1,
        padding: 0,
    },
    
    // --- Page Content Styles ---
    contentPage: {
        flex: 1,
        backgroundColor: '#FFFFFF',
        padding: 40,
        alignItems: 'center',
        justifyContent: 'center',
    },
    contentHeader: {
        fontSize: 32,
        fontWeight: 'bold',
        color: '#1F2937',
        marginBottom: 10,
    },
    contentSubText: {
        fontSize: 18,
        color: '#6B7280',
        marginBottom: 40,
    },
});