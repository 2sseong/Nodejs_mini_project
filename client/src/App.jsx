import React, { useRef, useEffect } from 'react';
import { Routes, Route, Navigate, Outlet } from 'react-router-dom';
import Topbar from './components/Topbar/Topbar.jsx';
import LoginPage from './pages/LoginPage.jsx';
import RoomPage from './pages/RoomPage.jsx';
import NotificationsPage from './pages/NotificationsPage.jsx';
import FriendPage from './pages/FriendPage.jsx';
import SignupPage from './pages/SignupPage.jsx';
import Titlebar from './components/Titlebar/Titlebar.jsx';
import NotificationWindowPage from './pages/NotificationWindowPage.jsx'; 
import { useAuth } from './hooks/AuthContext.jsx';
import PopupChatPage from './pages/PopupChatPage.jsx'; // [필수] import 확인
import './App.css';

// 보호된 라우트
const ProtectedRoute = ({ children }) => {
    const { userId, authLoaded } = useAuth();
    if (!authLoaded) return <div>Loading...</div>;
    if (!userId) return <Navigate to="/login" replace />;
    return children;
};



// 메인 레이아웃 (타이틀바 + 탑바 + 콘텐츠)
const MainLayout = () => {
    const isResizingRef = useRef(false);
    const resizeDirection = useRef(null); // 'right', 'bottom', 'corner'
    const startPos = useRef({ x: 0, y: 0 });
    const startBounds = useRef({ x: 0, y: 0, width: 0, height: 0 });

    // 드래그 시작 (MouseDown)
    const handleMouseDown = async (e, direction) => {
        console.log('[App.jsx] handleMouseDown called. Direction:', direction);

        if (!window.electronAPI) {
            console.error('[App.jsx] window.electronAPI not found!');
            return;
        }

        e.preventDefault(); // 기본 동작 방지
        isResizingRef.current = true;
        resizeDirection.current = direction;
        // e.screenX, e.screenY는 모니터 전체 기준 좌표입니다.
        startPos.current = { x: e.screenX, y: e.screenY };

        // [핵심 수정] 이벤트 리스너 등록을 먼저 합니다.
        // getWindowBounds가 실패하더라도 드래그 이벤트는 감지해야 합니다.
        console.log('[App.jsx] Adding mousemove/mouseup listeners');
        window.addEventListener('mousemove', handleMouseMove);
        window.addEventListener('mouseup', handleMouseUp);

        try {
            // 현재 창의 위치와 크기를 가져옵니다.
            console.log('[App.jsx] Calling getWindowBounds...');
            const bounds = await window.electronAPI.getWindowBounds();
            console.log('[App.jsx] getWindowBounds result:', bounds);
            
            if (bounds) {
                startBounds.current = bounds;
            }
        } catch (error) {
            // 에러가 나도 로그만 찍고 넘어갑니다.
            // startBounds는 기본값 {x:0, y:0, width:0, height:0}을 사용하게 됩니다.
            console.error('Failed to get window bounds:', error);
        }
    };

    // 드래그 중 (MouseMove)
    const handleMouseMove = (e) => {
        if (!isResizingRef.current || !window.electronAPI) return;
        
        requestAnimationFrame(() => {
            const deltaX = e.screenX - startPos.current.x;
            const deltaY = e.screenY - startPos.current.y;
            const newBounds = { ...startBounds.current };
            const dir = resizeDirection.current;

            // 최소 크기 설정
            const minWidth = 400;
            const minHeight = 300;

            // 모든 방향에 대한 계산 로직 추가
            
            // 동쪽 (오른쪽) 변경
            if (dir.includes('right')) {
                newBounds.width = Math.max(minWidth, startBounds.current.width + deltaX);
            }
            // 서쪽 (왼쪽) 변경 - 너비와 X좌표가 동시에 변해야 함
            if (dir.includes('left')) {
                const newWidth = Math.max(minWidth, startBounds.current.width - deltaX);
                newBounds.x = startBounds.current.x + (startBounds.current.width - newWidth);
                newBounds.width = newWidth;
            }
            // 남쪽 (아래쪽) 변경
            if (dir.includes('bottom')) {
                newBounds.height = Math.max(minHeight, startBounds.current.height + deltaY);
            }
            // 북쪽 (위쪽) 변경 - 높이와 Y좌표가 동시에 변해야 함
            if (dir.includes('top')) {
                const newHeight = Math.max(minHeight, startBounds.current.height - deltaY);
                newBounds.y = startBounds.current.y + (startBounds.current.height - newHeight);
                newBounds.height = newHeight;
            }

            window.electronAPI.resizeWindow(newBounds);
        });
    };

    // 드래그 종료 (MouseUp)
    const handleMouseUp = () => {
        isResizingRef.current = false;
        resizeDirection.current = null;
        window.removeEventListener('mousemove', handleMouseMove);
        window.removeEventListener('mouseup', handleMouseUp);
    };
    
    // 컴포넌트 언마운트 시 이벤트 리스너 정리 (안전장치)
    useEffect(() => {
        return () => {
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('mouseup', handleMouseUp);
        };
    }, []);


    return (
        // 래퍼 div 스타일 유지
        <div style={{ position: 'absolute', width: '100%', height: '100%', top: 0, left: 0, overflow: 'hidden', WebkitAppRegion: 'no-drag' }}>
            <div className="App">
                <Titlebar />
                <Topbar />
                <div className="content-area">
                    <Outlet />
                </div>
            </div>
            
            {/* 리사이즈 핸들러들 */}
            <div className="resize-handle resize-handle-top" onMouseDown={(e) => handleMouseDown(e, 'top')} />
            <div className="resize-handle resize-handle-bottom" onMouseDown={(e) => handleMouseDown(e, 'bottom')} />
            <div className="resize-handle resize-handle-left" onMouseDown={(e) => handleMouseDown(e, 'left')} />
            <div className="resize-handle resize-handle-right" onMouseDown={(e) => handleMouseDown(e, 'right')} />
            
            <div className="resize-handle resize-handle-top-left" onMouseDown={(e) => handleMouseDown(e, 'top-left')} />
            <div className="resize-handle resize-handle-top-right" onMouseDown={(e) => handleMouseDown(e, 'top-right')} />
            <div className="resize-handle resize-handle-bottom-left" onMouseDown={(e) => handleMouseDown(e, 'bottom-left')} />
            <div className="resize-handle resize-handle-bottom-right" onMouseDown={(e) => handleMouseDown(e, 'bottom-right')} />
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

            {/* [핵심 수정] 팝업 채팅 창 라우트 추가 */}
            {/* Topbar 없이 채팅 화면만 꽉 채우기 위해 Layout 바깥에 둡니다. */}
            <Route path="/popup/:roomId" element={<PopupChatPage />} />


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
                <Route path="/notifications" element={
                    <ProtectedRoute><NotificationsPage /></ProtectedRoute>
                } />
                <Route path="/friends" element={
                    <ProtectedRoute><FriendPage /></ProtectedRoute>
                } />
                
                {/* 위 경로에 해당하지 않는 모든 요청은 여기서 처리 (404) */}
                <Route path="*" element={<div style={{ padding: 24 }}>404 Not Found</div>} />
            </Route>
        </Routes>
    )
}