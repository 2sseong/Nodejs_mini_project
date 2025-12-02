import React from 'react';
import { Routes, Route, Navigate, Outlet } from 'react-router-dom';
import Topbar from './components/Topbar/Topbar.jsx';
import LoginPage from './pages/LoginPage.jsx';
import RoomPage from './pages/RoomPage.jsx';
import MyInfoPage from './pages/MyInfoPage.jsx';
import FriendPage from './pages/FriendPage.jsx';
import SignupPage from './pages/SignupPage.jsx';
import Titlebar from './components/Titlebar/Titlebar.jsx';
import NotificationWindowPage from './pages/NotificationWindowPage.jsx';
import { useAuth } from './hooks/AuthContext.jsx';
import PopupChatPage from './pages/PopupChatPage.jsx';
import FileDrawerPage from './pages/FileDrawerPage.jsx';
import './App.css';

// 보호된 라우트
const ProtectedRoute = ({ children }) => {
    const { userId, authLoaded } = useAuth();
    if (!authLoaded) return <div>Loading...</div>;
    if (!userId) return <Navigate to="/login" replace />;
    return children;
};

// 메인 레이아웃 (타이틀바 + 탑바 + 콘텐츠)
// [수정] 불필요한 리사이즈 로직을 모두 제거하여 코드가 매우 간결해졌습니다.
const MainLayout = () => {
    return (
        <div className="App">
            <Titlebar />
            <Topbar />
            <div className="content-area">
                <Outlet />
            </div>
        </div>
    );
};

export default function App() {
    return (
        <Routes>
            {/* ------------------------------------------------------- */}
            {/* 1. 독립적인 윈도우 라우트 (MainLayout의 영향을 받지 않음) */}
            {/* ------------------------------------------------------- */}

            {/* 알림 창 */}
            <Route path="/notification" element={<NotificationWindowPage />} />

            {/* 팝업 채팅 창 */}
            <Route path="/popup/:roomId" element={<PopupChatPage />} />

            {/* 파일 서랍 팝업 */}
            <Route path="/files/:roomId" element={<FileDrawerPage />} />


            {/* ------------------------------------------------------- */}
            {/* 2. 메인 앱 라우트 (MainLayout 적용: Topbar 등 포함)      */}
            {/* ------------------------------------------------------- */}
            <Route element={<MainLayout />}>
                <Route path="/" element={<Navigate to="/chat" replace />} />
                <Route path="/login" element={<LoginPage />} />
                <Route path="/signup" element={<SignupPage />} />

                <Route path="/chat" element={
                    <ProtectedRoute><RoomPage /></ProtectedRoute>
                } />
                <Route path="/MyInfo" element={
                    <ProtectedRoute><MyInfoPage /></ProtectedRoute>
                } />
                <Route path="/friends" element={
                    <ProtectedRoute><FriendPage /></ProtectedRoute>
                } />

                {/* 404 처리 */}
                <Route path="*" element={<div style={{ padding: 24 }}>404 Not Found</div>} />
            </Route>
        </Routes>
    )
}