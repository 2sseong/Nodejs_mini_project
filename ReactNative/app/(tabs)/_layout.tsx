import { Tabs } from 'expo-router';
import { Colors } from '../../constants/theme';

export default function TabLayout() {
    return (
        <Tabs
            screenOptions={{
                tabBarActiveTintColor: Colors.primary,
                tabBarInactiveTintColor: Colors.textMuted,
                tabBarStyle: {
                    backgroundColor: Colors.bgCard,
                    borderTopColor: Colors.borderColor,
                },
                headerStyle: {
                    backgroundColor: Colors.primary,
                },
                headerTintColor: Colors.textInverse,
                headerTitleStyle: {
                    fontWeight: 'bold',
                },
            }}
        >
            <Tabs.Screen
                name="rooms"
                options={{
                    title: '채팅',
                    tabBarLabel: '채팅',
                    tabBarIcon: () => null, // 아이콘 추가 가능
                }}
            />
            <Tabs.Screen
                name="users"
                options={{
                    title: '동료',
                    tabBarLabel: '동료',
                    tabBarIcon: () => null,
                }}
            />
            <Tabs.Screen
                name="profile"
                options={{
                    title: '내 정보',
                    tabBarLabel: '내 정보',
                    tabBarIcon: () => null,
                }}
            />
        </Tabs>
    );
}
