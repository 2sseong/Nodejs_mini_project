import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import '../styles/LoginPage.css'
import { login } from '../api/authApi'

export default function LoginPage() {
    const nav = useNavigate()
    const [form, setForm] = useState({ email: '', password: '' })
    const [showPw, setShowPw] = useState(false)
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState('')
    

    const onChange = (e) => {
        const { name, value } = e.target
        setForm((prev) => ({ ...prev, [name]: value }))
    }

    const validate = () => {
        if (!form.email.trim()) return '이메일을 입력해 주세요.'
        if (!/^\S+@\S+\.\S+$/.test(form.email)) return '이메일 형식이 올바르지 않습니다.'
        if (!form.password) return '비밀번호를 입력해 주세요.'
        if (form.password.length < 4) return '비밀번호는 4자 이상이어야 합니다.'
        return ''
    }

    const onSubmit = async (e) => {
        e.preventDefault()
        const v = validate()
        if (v) return setError(v)

        setError('')
        setLoading(true)
        try {
            // login 함수를 호출하고 응답을 받음
            const { data } = await login(form) 
            // 4xx/5xx 에러는 이미 login 함수 내부에서 throw 되었으므로, 
            // 여기에 도달했다면 성공 응답(ok=true)

        if (data.token && data.user) {
                    localStorage.setItem('authToken', data.token)
                    localStorage.setItem('userId', data.user.userId)
                    localStorage.setItem('userNickname', data.user.nickname)
                } else {
                    // 서버 응답은 성공했지만, 토큰이 없는 이상한 상황 처리
                    throw new Error("서버 응답에서 유효한 인증 토큰을 받지 못했습니다.")
                }

                nav('/chat', { replace: true })
            } catch (err) {
                setError(err.message || '알 수 없는 오류가 발생했습니다.')
            } finally {
                setLoading(false)
            }
        }

    return (
        <div className="login-wrap">
            <form className="login-card" onSubmit={onSubmit} noValidate>
                <h2 className="login-title">로그인</h2>

                <label className="field">
                    <span>이메일</span>
                    <input
                        type="email"
                        name="email"
                        placeholder="you@example.com"
                        value={form.email}
                        onChange={onChange}
                        autoComplete="username"
                    />
                </label>

                <label className="field">
                    <span>비밀번호</span>
                    <div className="pw-box">
                        <input
                            type={showPw ? 'text' : 'password'}
                            name="password"
                            placeholder="비밀번호"
                            value={form.password}
                            onChange={onChange}
                            autoComplete="current-password"
                        />
                        <button
                            type="button"
                            className="pw-toggle"
                            onClick={() => setShowPw((v) => !v)}
                            aria-label="비밀번호 보기 전환"
                        >
                            {showPw ? '숨김' : '보기'}
                        </button>
                    </div>
                </label>

                {error && <div className="error">{error}</div>}

                <button className="submit" type="submit" disabled={loading}>
                    {loading ? '로그인 중…' : '로그인'}
                </button>

                <div className="help-row">
                    <a href="#" onClick={(e) => e.preventDefault()}>비밀번호 찾기</a>
                    <a href="#" onClick={(e) => e.preventDefault()}>회원가입</a>
                </div>
            </form>
        </div>
    )
}

