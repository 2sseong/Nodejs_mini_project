import React from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom'
import './Topbar.css'
import { useAuth } from '../../hooks/AuthContext';

export default function Topbar() {
    const loc = useLocation()
    const nav = useNavigate()

    // 1. useAuth 훅에서 인증 상태와 로그아웃 함수를 가져옴
    const { isAuthenticated, userNickname, logout } = useAuth();

    // 2. 로그아웃 기능 구현 핸들러
    const handleLogout = () => {
        logout(); // 전역 상태 초기화 및 로컬 스토리지 정리
        console.log(`${userNickname} 님, 로그아웃되었습니다.`);
        nav('/login', { replace: true }); // 로그아웃 후 홈/랜딩 페이지로 이동
    };

    return (
        <header className="topbar">
            <div className="left" onClick={() => nav('/chat')} role="button" tabIndex={0}>
                <span className="logo">엠아이토크</span>
                {/* 닉네임 표시 */}
                {isAuthenticated && userNickname && (
                    <span className="nickname-display">
                        &nbsp; &nbsp; <span style={{ fontWeight: 'bold' }}>{userNickname}</span>님
                    </span>
                )}
            </div>

            <nav className="right">
                {isAuthenticated ? (
                    /* 1. 로그인 -> 로그아웃 버튼 (클릭 시 handleLogout 실행) */
                    <button className="btn logout-btn" onClick={handleLogout}>로그아웃</button>
                ) : (
                    /* 로그아웃 -> 로그인 버튼 */
                    <Link className={`btn ${loc.pathname === '/login' ? 'active' : ''}`} to="/login">로그인</Link>
                )}
                {/* 3. 로그인 상태일 때 회원가입 버튼 숨기기 */}
                {/* {!isAuthenticated && (
                    <Link className={`btn ${loc.pathname === '/signup' ? 'active' : ''}`} to="/signup">회원가입</Link>
                )} */}
                <Link className={`btn ${loc.pathname === '/chat' ? 'active' : ''}`} to="/chat">채팅</Link>
                <Link className={`btn ${loc.pathname === '/users' ? 'active' : ''}`} to="/users">사용자</Link>
                <Link className={`btn ${loc.pathname === '/MyInfo' ? 'active' : ''}`} to="/MyInfo">내 정보</Link>
            </nav>
        </header>
    )
}