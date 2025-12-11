import React, { useState, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom'
import './Sidebar.css'
import { useAuth } from '../../hooks/AuthContext';

export default function Sidebar() {
    const loc = useLocation()
    const nav = useNavigate()

    const { isAuthenticated, userNickname, logout } = useAuth();

    // 알림 상태 (localStorage에서 불러오기)
    const [isNotificationEnabled, setIsNotificationEnabled] = useState(() => {
        const saved = localStorage.getItem('notificationEnabled');
        return saved !== null ? JSON.parse(saved) : true;
    });

    // 알림 상태 변경 시 localStorage에 저장 및 main process에 알림
    useEffect(() => {
        localStorage.setItem('notificationEnabled', JSON.stringify(isNotificationEnabled));
        if (window.electronAPI?.setNotificationEnabled) {
            window.electronAPI.setNotificationEnabled(isNotificationEnabled);
        }
    }, [isNotificationEnabled]);

    const handleLogout = () => {
        logout();
        console.log(`${userNickname} 님, 로그아웃되었습니다.`);
        nav('/login', { replace: true });
    };

    const handleToggleNotification = () => {
        setIsNotificationEnabled(prev => !prev);
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
