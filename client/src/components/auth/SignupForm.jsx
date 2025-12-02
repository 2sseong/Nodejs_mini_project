// 폼 입력 상태 관리, 유효성 검사, 백엔드 API호출

// src/components/auth/SignupForm.jsx

import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import './SignupForm.css';
import { signup } from '../../api/authApi.jsx';

function SignupForm() {
    // 폼 입력 필드 상태 관리 (이전과 동일)
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [nickname, setNickname] = useState('');
    const [department, setDepartment] = useState('');
    const [position, setPosition] = useState('');

    // UI 피드백을 위한 상태 (이전과 동일)
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [message, setMessage] = useState(null);
    const navigate = useNavigate();

    // 부서 선택지
    const departments = [
        '경영지원팀',
        'OLP1팀',
        'OLP2팀',
        'OLP3팀',
        'OLP4팀',
        'SI팀'
    ];

    // const history = useHistory();

    const handleSubmit = async (e) => {

        e.preventDefault();
        setError(null);
        setMessage(null);

        if (!email || !password || !confirmPassword || !nickname || !department || !position) {
            setError('모든 필드를 입력해야 합니다.');
            return;
        }

        if (password !== confirmPassword) {
            setError('비밀번호와 비밀번호 확인이 일치하지 않습니다.');
            return;
        }

        setLoading(true);

        try {
            const { ok, data } = await signup({ email, password, nickname, department, position }); // <-- 함수 호출

            if (ok) {
                // 1. 성공 메시지 표시
                setMessage(data.message || '가입 완료');
                setError(null); // 에러메세지 초기화

                // 2. 입력 필드 초기화 (선택 사항, 깔끔하게 보이기 위해)
                setEmail('');
                setPassword('');
                setConfirmPassword('');
                setNickname('');
                setDepartment('');
                setPosition('');

                // 3. 로그인 페이지로 이동
                setTimeout(() => {
                    navigate('/login'); // 로그인 페이지로 이동
                }, 5000); // 5초 후 이동하여 사용자에게 성공 메시지를 보여줄 시간을 줌
            } else {
                // 백엔드에서 받은 오류 메시지를 사용
                setError(data.message || '가입 실패');
            }
        } catch (err) {
            console.error('API 호출 중 실제 오류:', err);
            // 네트워크 오류 등 예외 처리
            setError('서버 연결 오류');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="signup-form"> {/* (2) 클래스명을 사용하여 스타일 적용 */}
            <h3>회원 정보 입력</h3>

            {error && <p className="error-message">{error}</p>}
            {message && <p className="success-message">{message}</p>}


            <form onSubmit={handleSubmit}>
                {/* 1. 이메일 입력 필드 */}
                <div className="form-group">
                    <label htmlFor="email">이메일</label>
                    <input type="email" id="email" value={email} onChange={(e) => setEmail(e.target.value)} required disabled={loading} />
                </div>

                {/* 2. 닉네임 입력 필드 */}
                <div className="form-group">
                    <label htmlFor="nickname">이름</label>
                    <input type="text" id="nickname" value={nickname} onChange={(e) => setNickname(e.target.value)} required disabled={loading} />
                </div>

                {/* 3. 부서 선택 */}
                <div className="form-group">
                    <label htmlFor="department">부서</label>
                    <select id="department" value={department} onChange={(e) => setDepartment(e.target.value)} required disabled={loading}>
                        <option value="">부서를 선택해주세요</option>
                        {departments.map((department) => (
                            <option key={department} value={department}>
                                {department}
                            </option>
                        ))}
                    </select>
                </div>

                {/* 4. 직급 선택 */}
                <div className="form-group">
                    <label htmlFor="position">직급</label>
                    <input
                        type="text"
                        id="position"
                        value={position} onChange={(e) => setPosition(e.target.value)}
                        placeholder="직급을 입력해주세요"
                        required disabled={loading} />
                </div>

                {/* 5. 비밀번호 입력 필드 */}
                <div className="form-group">
                    <label htmlFor="password">비밀번호</label>
                    <input type="password" id="password" value={password} onChange={(e) => setPassword(e.target.value)} required disabled={loading} />
                </div>

                {/* 6. 비밀번호 확인 입력 필드 */}
                <div className="form-group">
                    <label htmlFor="confirmPassword">비밀번호 확인</label>
                    <input type="password" id="confirmPassword" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} required disabled={loading} />
                </div>


                {/* 제출 버튼 */}
                <button type="submit" disabled={loading} className="submit-btn">
                    {loading ? '가입 중...' : '회원가입'}
                </button>
            </form>
        </div>
    );
}

export default SignupForm;