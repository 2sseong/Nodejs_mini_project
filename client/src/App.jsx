import React from 'react';
import { Routes, Route, Navigate, Outlet } from 'react-router-dom';
import Sidebar from './components/Sidebar/Sidebar.jsx';
import LoginPage from './pages/LoginPage.jsx';
import RoomPage from './pages/RoomPage.jsx';
import MyInfoPage from './pages/MyInfoPage.jsx';
import UserPage from './pages/UserPage.jsx';
import SignupPage from './pages/SignupPage.jsx';
import ForgotPasswordPage from './pages/ForgotPasswordPage.jsx';
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

// 메인 레이아웃 (타이틀바 + 사이드바 + 콘텐츠)
const MainLayout = () => {
    return (
        <div className="App">
            <Titlebar />
            <div className="app-body">
                <Sidebar />
                <main className="content-area">
                    <Outlet />
                </main>
            </div>
        </div>
    );
};

export default function App() {
    return (
        <Routes>
            {/* 독립적인 윈도우 라우트 */}
            <Route path="/notification" element={<NotificationWindowPage />} />
            <Route path="/popup/:roomId" element={<PopupChatPage />} />
            <Route path="/files/:roomId" element={<FileDrawerPage />} />

            {/* 메인 앱 라우트 */}
            <Route element={<MainLayout />}>
                <Route path="/" element={<Navigate to="/chat" replace />} />
                <Route path="/login" element={<LoginPage />} />
                <Route path="/signup" element={<SignupPage />} />
                <Route path="/forgot-password" element={<ForgotPasswordPage />} />

                <Route path="/chat" element={
                    <ProtectedRoute><RoomPage /></ProtectedRoute>
                } />
                <Route path="/MyInfo" element={
                    <ProtectedRoute><MyInfoPage /></ProtectedRoute>
                } />
                <Route path="/users" element={
                    <ProtectedRoute><UserPage /></ProtectedRoute>
                } />

                {/* 404 처리 */}
                <Route path="*" element={<div style={{ padding: 24 }}>404 Not Found</div>} />
            </Route>
        </Routes>
    )
}