// navigation/MainTabNavigator.jsx

import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { StyleSheet, Platform } from 'react-native';

// 모듈화된 스타일 가져오기 (경로가 정확한지 확인해 주세요)
// MainTabNavigator가 navigation 폴더에 있고 GlobalStyles가 constants 폴더에 있다면 '../constants/GlobalStyles'로 변경이 필요할 수 있습니다.
// import { GlobalStyles } from '../constants/GlobalStyles'; 

// 페이지 컴포넌트
// import ChatPage from '../pages/ChatPage';
// import NotificationsPage from '../pages/NotificationsPage';
// import FriendPage from '../pages/FriendPage';

// Icon 라이브러리 사용 (필수 설치: npm install react-native-vector-icons)
import Ionicons from 'react-native-vector-icons/Ionicons'; 

// Bottom Tab Navigator 생성
const Tab = createBottomTabNavigator();

/**
 * @function MainTabNavigator
 * 메인 화면 그룹 (채팅, 알림, 친구)을 위한 하단 탭 네비게이터를 생성합니다.
 * 최적화: 탭 바의 배경색과 아이콘 색상을 GlobalStyles를 참조하여 설정합니다.
 */
export default function MainTabNavigator() {
    // GlobalStyles의 색상 상수를 직접 사용하거나, 별도로 정의하여 사용합니다.
    const PRIMARY_COLOR = GlobalStyles.link.color; // 활성 탭 색상으로 링크 색상 사용
    const INACTIVE_COLOR = GlobalStyles.readTheDocs.color; // 비활성 탭 색상

    return (
        <Tab.Navigator
            initialRouteName="Chat"
            screenOptions={({ route }) => ({
                headerShown: false, // 탭 내부 스크린의 기본 헤더 숨김

                // 탭 바 자체의 스타일 정의
                tabBarStyle: [
                    styles.tabBar,
                    { backgroundColor: GlobalStyles.container.backgroundColor } // 앱 기본 배경색을 탭 바 배경색으로 사용
                ],
                
                // 탭 활성/비활성 색상 설정
                tabBarActiveTintColor: PRIMARY_COLOR,
                tabBarInactiveTintColor: INACTIVE_COLOR,
                
                // 탭 바 아이콘 설정 (최적화된 방식)
                tabBarIcon: ({ focused, color, size }) => {
                    let iconName;
                    
                    if (route.name === 'Chat') {
                        iconName = focused ? 'chatbox' : 'chatbox-outline';
                    } else if (route.name === 'Notifications') {
                        iconName = focused ? 'notifications' : 'notifications-outline';
                    } else if (route.name === 'Friends') {
                        iconName = focused ? 'people' : 'people-outline';
                    }
                    // 'size' 대신 고정 크기 사용 (일관성 유지)
                    return <Ionicons name={iconName} size={25} color={color} />;
                },
            })}
        >
            <Tab.Screen 
                name="Chat" 
                component={ChatPage}
                options={{ tabBarLabel: '채팅' }}
            />

            <Tab.Screen 
                name="Notifications" 
                component={NotificationsPage}
                options={{ tabBarLabel: '알림' }}
            />

            <Tab.Screen 
                name="Friends" 
                component={FriendPage} 
                options={{ tabBarLabel: '친구' }}
            />

        </Tab.Navigator>
    );
}

// MainTabNavigator 전용 Stylesheet (모듈화 원칙)
// 이 스타일은 GlobalStyles.js에 포함하거나, 이 파일 하단에 정의하여 사용합니다.
const styles = StyleSheet.create({
    tabBar: {
        // 하단 탭 바 높이 설정
        height: Platform.OS === 'ios' ? 90 : 60, // iOS는 홈 인디케이터 고려
        paddingBottom: Platform.OS === 'ios' ? 25 : 5, // 하단 패딩 조정
        borderTopWidth: 0, // 기본 테두리 제거 (선택 사항)
        elevation: 10, // Android 그림자
    },
    // 추가적인 탭 관련 스타일링 필요 시 여기에 정의
});