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
                }}
            />
            <Tabs.Screen
                name="profile"
                options={{
                    title: '내 정보',
                    tabBarLabel: '내 정보',
                }}
            />
        </Tabs>
    );
}
