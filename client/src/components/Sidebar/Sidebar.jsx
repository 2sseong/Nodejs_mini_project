import React from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom'
import './Sidebar.css'
import { useAuth } from '../../hooks/AuthContext';

export default function Sidebar() {
    const loc = useLocation()
    const nav = useNavigate()

    const { isAuthenticated, userNickname, logout } = useAuth();

    const handleLogout = () => {
        logout();
        console.log(`${userNickname} 님, 로그아웃되었습니다.`);
        nav('/login', { replace: true });
    };

    // 메인 네비게이션 항목 (순서: 사용자 → 채팅)
    const navItems = [
        { path: '/users', icon: 'bi-people', label: '사용자' },
        { path: '/chat', icon: 'bi-chat-dots', label: '채팅' },
    ];

    return (
        <aside className="sidebar-nav">
            {/* 로고 영역 */}
            <div className="sidebar-logo" onClick={() => nav('/chat')} role="button" tabIndex={0}>
                <i className="bi bi-chat-square-heart-fill"></i>
            </div>

            {/* 메인 네비게이션 메뉴 */}
            <nav className="sidebar-menu">
                {navItems.map((item) => (
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

            {/* 하단 영역 (내 정보 + 로그인/로그아웃) */}
            <div className="sidebar-footer">
                {/* 내 정보 */}
                <Link
                    className={`sidebar-item ${loc.pathname === '/MyInfo' ? 'active' : ''}`}
                    to="/MyInfo"
                    title="내 정보"
                >
                    <i className="bi bi-person-circle"></i>
                    <span className="sidebar-label">내 정보</span>
                </Link>

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
