// SignupForm 컴포넌트를 불러와 렌더링하고, 페이지 레이아웃(App.js)에 마운트되는 최상위 컨테이너
// src/pages/SignupPage.jsx

import React from 'react';
import SignupForm from '../components/auth/SignupForm';
import '../styles/SignupPage.css';

function SignupPage() {
    return (
        <div className="page-layout">
            <header className="page-header">
                <h1>새 계정 만들기</h1>
            </header>
            
            <main className="page-content">
                <section className="form-section">
                    <SignupForm /> 
                </section>
                
                <p className="login-link">
                    이미 계정이 있으신가요? <a href="/login">로그인</a>
                </p>
            </main>
        </div>
    );
}

export default SignupPage;
