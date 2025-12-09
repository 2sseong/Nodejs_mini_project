import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { forgotPassword } from '../api/authApi';
import mitalkLogo from '../assets/mitalk.png';
import '../styles/ForgotPasswordPage.css';

export default function ForgotPasswordPage() {
    const navigate = useNavigate();
    const [email, setEmail] = useState('');
    const [loading, setLoading] = useState(false);
    const [message, setMessage] = useState({ type: '', text: '' });

    const handleSubmit = async (e) => {
        e.preventDefault();

        if (!email) {
            setMessage({ type: 'error', text: '이메일을 입력해주세요.' });
            return;
        }

        setLoading(true);
        setMessage({ type: '', text: '' });

        try {
            const result = await forgotPassword(email);

            if (result.success) {
                setMessage({ type: 'success', text: result.message });
                // 5초 후 로그인 페이지로 이동
                setTimeout(() => navigate('/'), 5000);
            } else {
                setMessage({ type: 'error', text: result.message });
            }
        } catch (error) {
            setMessage({ type: 'error', text: '서버 오류가 발생했습니다.' });
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="forgot-password-page">
            <div className="forgot-password-container">
                <div className="forgot-password-header">
                    <img src={mitalkLogo} alt="엠아이토크" className="forgot-logo" />
                    <h2>비밀번호 찾기</h2>
                    <p className="forgot-desc">
                        가입한 이메일 주소를 입력하시면<br />
                        임시 비밀번호를 발송해 드립니다.
                    </p>
                </div>

                <form onSubmit={handleSubmit} className="forgot-password-form">
                    <div className="form-group">
                        <label htmlFor="email">이메일</label>
                        <input
                            type="email"
                            id="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            placeholder="example@company.com"
                            disabled={loading}
                            autoFocus
                        />
                    </div>

                    {message.text && (
                        <div className={`message ${message.type}`}>
                            {message.text}
                        </div>
                    )}

                    <button type="submit" className="btn-submit" disabled={loading}>
                        {loading ? '발송 중...' : '임시 비밀번호 받기'}
                    </button>

                    <button
                        type="button"
                        className="btn-back"
                        onClick={() => navigate('/')}
                        disabled={loading}
                    >
                        로그인으로 돌아가기
                    </button>
                </form>
            </div>
        </div>
    );
}
