// 회원가입 페이지 - 로그인 페이지와 일관된 디자인
// src/pages/SignupPage.jsx

import React from 'react';
import { Link } from 'react-router-dom';
import SignupForm from '../components/auth/SignupForm';
import '../styles/SignupPage.css';

function SignupPage() {
    return (
        <div className="signup-wrap">
            <div className="signup-card">
                {/* 로고 영역 */}
                <div className="signup-logo">
                    <i className="bi bi-chat-square-heart-fill"></i>
                    <h2 className="signup-title">회원가입</h2>
                </div>

                {/* 회원가입 폼 */}
                <SignupForm />

                {/* 로그인 링크 */}
                <div className="login-link">
                    이미 계정이 있으신가요? <Link to="/login">로그인</Link>
                </div>
            </div>
        </div>
    );
}

export default SignupPage;
