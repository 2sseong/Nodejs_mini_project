import { Routes, Route, Navigate, Outlet } from 'react-router-dom'; // [수정] Outlet 추가
import Topbar from './components/Topbar/Topbar.jsx';
import LoginPage from './pages/LoginPage.jsx';
import ChatPage from './pages/ChatPage.jsx';
import NotificationsPage from './pages/NotificationsPage.jsx';
import FriendPage from './pages/FriendPage.jsx';
import SignupPage from './pages/SignupPage.jsx';
import Titlebar from './components/Titlebar/Titlebar.jsx';
import NotificationWindowPage from './pages/NotificationWindowPage.jsx'; 
import { useAuth } from './hooks/useAuth.js';
import './App.css';

// 보호된 라우트 컴포넌트
const ProtectedRoute = ({ children }) => {
    const { userId, authLoaded } = useAuth();
    if (!authLoaded) return <div>Loading...</div>;
    if (!userId) return <Navigate to="/login" replace />;
    return children;
};

// [신규] 메인 레이아웃 컴포넌트
// (Titlebar, Topbar 등 앱의 기본 프레임을 담당)
const MainLayout = () => {
    return (
        <div className="App">
            <Titlebar />
            <Topbar />
            <div className="content-area">
                {/* Outlet 자리에 자식 라우트(ChatPage 등)가 렌더링됨 */}
                <Outlet />
            </div>
        </div>
    );
};

export default function App() {
    return (
        <Routes>
            {/* 1. 알림 윈도우용 라우트 (레이아웃 없이 독립적) */}
            {/* 가장 먼저 매칭시켜서 메인 레이아웃의 영향을 받지 않게 함 */}
            <Route path="/notification" element={<NotificationWindowPage />} />

            {/* 2. 메인 앱 라우트들 (MainLayout으로 감쌈) */}
            <Route element={<MainLayout />}>
                <Route path="/" element={<Navigate to="/chat" replace />} />
                <Route path="/login" element={<LoginPage />} />
                <Route path="/signup" element={<SignupPage />} />
                
                <Route path="/chat" element={
                    <ProtectedRoute><ChatPage /></ProtectedRoute>
                } />
                <Route path="/notifications" element={
                    <ProtectedRoute><NotificationsPage /></ProtectedRoute>
                } />
                <Route path="/friends" element={
                    <ProtectedRoute><FriendPage /></ProtectedRoute>
                } />
                
                <Route path="*" element={<div style={{ padding: 24 }}>404 Not Found</div>} />
            </Route>
        </Routes>
    )
}