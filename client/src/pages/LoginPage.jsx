import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import '../styles/LoginPage.css'

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
            // 백엔드가 HttpOnly 쿠키를 내려주는 방식이라면 credentials 포함
            const res = await fetch(`/api/login`, {

                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify(form),
            })

            if (!res.ok) {
                const msg = await safeMessage(res)
                throw new Error(msg || `로그인 실패 (${res.status})`)
            }

            // 응답 데이터 파싱 및 JWT 토큰 저장
            const data = await res.json()

            if (data.token && data.user) {
                // JWT 토큰 저장
                localStorage.setItem('authToken', data.token)

                // 사용자 식별 정보 저장
                localStorage.setItem('userId', data.user.userId)
                localStorage.setItem('userNickname', data.user.nickname)
            } else {
                // 토큰이 없으면 로그인 실패로 간주
                throw new Error("서버 응답에서 유효한 인증 토큰을 받지 못했습니다.")
            }

            // 토큰을 프론트에 저장하는 방식이라면 여기에 처리 추가.
            // const data = await res.json()

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

async function safeMessage(res) {
    try {
        const t = await res.text()
        if (!t) return ''
        const json = JSON.parse(t)
        return json.message || json.error || ''
    } catch {
        return ''
    }
}