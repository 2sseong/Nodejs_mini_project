// components/Topbar/Topbar.jsx
import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
// React Router DOM 대신 React Navigation 훅 사용
import { useNavigation, useRoute } from '@react-navigation/native';
// 아이콘 사용을 위해 react-native-vector-icons 라이브러리가 설치되어 있다고 가정합니다.
import Icon from 'react-native-vector-icons/Ionicons'; 

/**
 * @function Topbar
 * React Native 환경을 위한 커스텀 상단 바 컴포넌트입니다.
 * MainTabNavigator의 헤더가 아닌, 특정 스크린 상단에 커스텀으로 필요할 때 사용됩니다.
 * (여기서는 MainTabs 내부에 통합되지 않고, 별도의 Topbar 역할을 수행한다고 가정)
 * 시간/공간 복잡도: O(1) - 렌더링은 일정 시간이 소요됩니다.
 */
export default function Topbar() {
    // useLocation 대신 useRoute, useNavigate 대신 useNavigation 사용
    const navigation = useNavigation();
    const route = useRoute(); // 현재 화면의 정보를 가져옵니다.

    // 탭 네비게이터의 route name을 사용하도록 변경
    const currentRouteName = route.name;

    // 네비게이션 함수를 간소화하는 헬퍼 함수
    const navigateTo = (screenName) => {
        // MainTabs에서 이동할 경우, 해당 탭으로 이동
        if (['Chat', 'Friends', 'Notifications'].includes(screenName)) {
            // MainTabs 스택 내의 탭으로 이동
            // 이 컴포넌트가 MainTabs 스크린 내부에 있다고 가정하고 탭으로 navigate
            navigation.navigate(screenName);
        } else {
            // Login 같은 외부 스크린으로 이동
             navigation.navigate('Login');
        }
    };

    const routes = [
        { name: 'Login', label: '로그인' },
        { name: 'Chat', label: '채팅' },
        { name: 'Friends', label: '친구' },
        { name: 'Notifications', label: '알림' },
    ];

    const TOPBAR_HEIGHT = 64; // 웹에서 사용한 높이 (paddingTop 64를 기반으로)
const PRIMARY_COLOR = '#007AFF'; // 예시 색상

const styles = StyleSheet.create({
    topbar: {
        // <header> 역할: 가로 전체, 상단 고정, 그림자 효과
        width: '100%',
        height: TOPBAR_HEIGHT,
        flexDirection: 'row', // 주축 방향: 가로 (Flexbox 기본 설정)
        justifyContent: 'space-between', // 양쪽 끝 정렬
        alignItems: 'center', // 세로 중앙 정렬
        paddingHorizontal: 15,
        backgroundColor: '#FFFFFF', // 배경색
        // 그림자 효과 (웹의 box-shadow 대체)
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 3,
        elevation: 4, // Android 그림자
        zIndex: 10, // 다른 요소 위에 나타나도록 설정
    },
    left: {
        // <div> 역할
        alignItems: 'center',
        justifyContent: 'center',
        paddingRight: 15,
        // Role="button" 및 tabIndex={0}는 RN에서 TouchableOpacity가 대신합니다.
    },
    logo: {
        // <span>.logo 역할
        fontSize: 20,
        fontWeight: 'bold',
        color: PRIMARY_COLOR, // 로고 색상
    },
    right: {
        // <nav> 역할
        flexDirection: 'row',
    },
    btn: {
        // <Link className="btn"> 역할
        paddingVertical: 8,
        paddingHorizontal: 12,
        marginLeft: 10, // 버튼 간 간격
        borderRadius: 5,
        backgroundColor: '#F0F0F0', // 기본 버튼 배경
    },
    btnActive: {
        // .active 역할
        backgroundColor: PRIMARY_COLOR,
    },
    btnText: {
        // 텍스트 스타일
        color: '#333333',
        fontWeight: '500',
    },
    btnTextActive: {
        // .active 텍스트 색상
        color: '#FFFFFF',
    },
});

    return (
        <View style={styles.topbar}>
            {/* Left Section: 로고 및 /Chat 이동 기능 */}
            <TouchableOpacity 
                style={styles.left} 
                onPress={() => navigateTo('Chat')}
                activeOpacity={0.7} // 버튼 클릭 시 피드백
            >
                <Text style={styles.logo}>엠아이토크</Text>
            </TouchableOpacity>

            {/* Right Section: 네비게이션 버튼들 */}
            <View style={styles.right}>
                {routes.map((r, index) => (
                    <TouchableOpacity
                        key={index}
                        style={[
                            styles.btn,
                            // 현재 활성화된 탭을 스타일링하기 위해 route name 비교
                            currentRouteName === r.name && styles.btnActive, 
                        ]}
                        onPress={() => navigateTo(r.name)}
                        activeOpacity={0.w}
                    >
                        <Text style={[
                            styles.btnText,
                            currentRouteName === r.name && styles.btnTextActive,
                        ]}>
                            {r.label}
                        </Text>
                    </TouchableOpacity>
                ))}
            </View>
        </View>
    );
}