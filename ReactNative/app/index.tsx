import { Redirect } from 'expo-router';
import { useEffect, useState } from 'react';
import { checkAuth } from '../api/auth';
import { View, ActivityIndicator } from 'react-native';
import { Colors } from '../constants/theme';

export default function Index() {
    const [isLoading, setIsLoading] = useState(true);
    const [isAuthenticated, setIsAuthenticated] = useState(false);

    useEffect(() => {
        const check = async () => {
            const authenticated = await checkAuth();
            setIsAuthenticated(authenticated);
            setIsLoading(false);
        };
        check();
    }, []);

    if (isLoading) {
        return (
            <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: Colors.bgPage }}>
                <ActivityIndicator size="large" color={Colors.primary} />
            </View>
        );
    }

    // 인증 상태에 따라 리다이렉트
    if (isAuthenticated) {
        return <Redirect href="/(tabs)/rooms" />;
    } else {
        return <Redirect href="/(auth)/login" />;
    }
}
