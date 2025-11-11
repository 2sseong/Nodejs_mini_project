import React from 'react';
// React Native의 기본 UI 컴포넌트인 View를 가져옵니다.
import { View } from 'react-native'; 
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

// 모듈화된 GlobalStyles를 가져옵니다. (경로 가정: '../constants/GlobalStyles')
// 프로젝트 루트에서 상대 경로로 수정했습니다.
// import { GlobalStyles } from './constants/GlobalStyles,js';

// 네비게이션 모듈화 (경로 가정: './navigation/MainTabNavigator')
import MainTabNavigator from './navigation/MainTabNavigator.jsx';

// 페이지 컴포넌트 (경로 가정: './pages/LoginPage')
import LoginPage from './pages/LoginPage.jsx';

// Stack Navigator 생성
const Stack = createNativeStackNavigator();

/**
 * @function App
 * 최상위 컴포넌트: 모든 네비게이션 스택을 관리합니다.
 * @note React Native 표준에 맞게, NavigationContainer가 최상위 View 역할을 하도록 수정했습니다.
 * 시간 복잡도: O(1) - 네비게이션 구조 초기화는 일정 시간이 소요됩니다.
 * 공간 복잡도: O(N) - N은 스크린의 개수 (스택에 저장되는 컴포넌트 참조)
 */
export default function App() {
    return (
        // 네비게이션 컨테이너가 최상위 컴포넌트의 역할을 수행하여 앱 전체 컨텍스트를 제공합니다.
        <NavigationContainer 
            // NavigationContainer에 GlobalStyles의 기본 배경색을 적용하여 앱 전체 배경색을 설정합니다.
            // GlobalStyles.container의 flex: 1 속성은 NavigationContainer가 처리합니다.
            // style={{ backgroundColor: GlobalStyles.container.backgroundColor }}
        >
            {/* 기본 Stack Navigator를 사용하여 주요 화면 전환을 관리합니다. */}
            <Stack.Navigator 
                // 웹의 Topbar 대신, MainTabs 내부에서 TabNavigator가 UI를 담당합니다.
                screenOptions={{ headerShown: false }} 
            >
                {/* 1. 로그인 스크린 */}
                <Stack.Screen 
                    name="Login" 
                    component={LoginPage} 
                />
                
                {/* 2. 메인 탭 네비게이터 (로그인 후 접근하는 화면 그룹) */}
                <Stack.Screen 
                    name="MainTabs" 
                    component={MainTabNavigator} 
                />
                
                {/* 404 처리는 React Native에서는 일반적으로 필요하지 않지만, 
                    에러 핸들링 스크린을 추가할 수 있습니다. 
                */}
            </Stack.Navigator>
        </NavigationContainer>
    );
}