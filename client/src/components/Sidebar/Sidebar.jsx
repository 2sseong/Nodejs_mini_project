import React, { useState, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom'
import './Sidebar.css'
import { useAuth } from '../../hooks/AuthContext';
import { getNotificationSetting, setNotificationSetting } from '../../api/usersApi';

export default function Sidebar() {
    const loc = useLocation()
    const nav = useNavigate()

    const { isAuthenticated, userNickname, logout, userId } = useAuth();

    // 알림 상태 (DB에서 불러오기)
    const [isNotificationEnabled, setIsNotificationEnabled] = useState(true);
    const [isLoading, setIsLoading] = useState(false);

    // 로그인 시 서버에서 알림 설정 불러오기
    useEffect(() => {
        const loadNotificationSetting = async () => {
            if (isAuthenticated && userId) {
                try {
                    const enabled = await getNotificationSetting();
                    setIsNotificationEnabled(enabled);
                    // Electron에 알림 상태 전달
                    if (window.electronAPI?.setNotificationEnabled) {
                        window.electronAPI.setNotificationEnabled(enabled);
                    }
                } catch (error) {
                    console.error('알림 설정 로드 실패:', error);
                }
            }
        };
        loadNotificationSetting();
    }, [isAuthenticated, userId]);

    const handleLogout = () => {
        logout();
        console.log(`${userNickname} 님, 로그아웃되었습니다.`);
        nav('/login', { replace: true });
    };

    const handleToggleNotification = async () => {
        if (isLoading) return;

        const newValue = !isNotificationEnabled;
        setIsLoading(true);

        try {
            await setNotificationSetting(newValue);
            setIsNotificationEnabled(newValue);

            // Electron에 알림 상태 전달
            if (window.electronAPI?.setNotificationEnabled) {
                window.electronAPI.setNotificationEnabled(newValue);
            }
        } catch (error) {
            console.error('알림 설정 변경 실패:', error);
        } finally {
            setIsLoading(false);
        }
    };

    // 상단 메인 네비게이션 항목
    const topNavItems = [
        { path: '/users', icon: 'bi-people', label: '사용자' },
        { path: '/chat', icon: 'bi-chat-dots', label: '채팅' },
    ];

    // 하단 네비게이션 항목 (알림 토글은 별도 처리)
    const bottomNavItems = [
        { path: '/MyInfo', icon: 'bi-person-circle', label: '내 정보' },
    ];

    return (
        <aside className="sidebar-nav">
            {/* 로고 영역 */}
            <div className="sidebar-logo" onClick={() => nav('/chat')} role="button" tabIndex={0}>
                <i className="bi bi-chat-square-heart-fill"></i>
            </div>

            {/* 상단 메인 네비게이션 메뉴 */}
            <nav className="sidebar-menu">
                {topNavItems.map((item) => (
                    <Link
                        key={item.path}
                        className={`sidebar-item ${loc.pathname === item.path ? 'active' : ''}`}
                        to={item.path}
                        title={item.label}
                    >
                        <i className={`bi ${item.icon}`}></i>
                        <span className="sidebar-label">{item.label}</span>
                    </Link>
                ))}
            </nav>

            {/* 하단 영역 */}
            <div className="sidebar-footer">
                {/* 알림 켜기/끄기 토글 */}
                <button
                    className={`sidebar-item notification-toggle ${isNotificationEnabled ? 'enabled' : 'disabled'}`}
                    onClick={handleToggleNotification}
                    title={isNotificationEnabled ? '알림 끄기' : '알림 켜기'}
                >
                    <i className={`bi ${isNotificationEnabled ? 'bi-bell-fill' : 'bi-bell-slash'}`}></i>
                    <span className="sidebar-label">{isNotificationEnabled ? '알림 끔' : '알림 켬'}</span>
                </button>

                {/* 하단 네비게이션 항목 (내 정보 등) */}
                {bottomNavItems.map((item) => (
                    <Link
                        key={item.path}
                        className={`sidebar-item ${loc.pathname === item.path ? 'active' : ''}`}
                        to={item.path}
                        title={item.label}
                    >
                        <i className={`bi ${item.icon}`}></i>
                        <span className="sidebar-label">{item.label}</span>
                    </Link>
                ))}

                {/* 로그인/로그아웃 */}
                {isAuthenticated ? (
                    <button
                        className="sidebar-item logout-btn"
                        onClick={handleLogout}
                        title="로그아웃"
                    >
                        <i className="bi bi-box-arrow-right"></i>
                        <span className="sidebar-label">로그아웃</span>
                    </button>
                ) : (
                    <Link
                        className={`sidebar-item ${loc.pathname === '/login' ? 'active' : ''}`}
                        to="/login"
                        title="로그인"
                    >
                        <i className="bi bi-box-arrow-in-right"></i>
                        <span className="sidebar-label">로그인</span>
                    </Link>
                )}
            </div>
        </aside>
    )
}
