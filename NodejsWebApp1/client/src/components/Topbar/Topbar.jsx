import { Link, useLocation, useNavigate } from 'react-router-dom'
import './Topbar.css'

export default function Topbar() {
    const loc = useLocation()
    const nav = useNavigate()

    return (
        <header className="topbar">
            <div className="left" onClick={() => nav('/chat')} role="button" tabIndex={0}>
                <span className="logo">엠아이토크</span>
            </div>

            <nav className="right">
                <Link className={`btn ${loc.pathname === '/login' ? 'active' : ''}`} to="/login">로그인</Link>
                <Link className={`btn ${loc.pathname === '/chat' ? 'active' : ''}`} to="/chat">채팅</Link>
                <Link className={`btn ${loc.pathname === '/friends' ? 'active' : ''}`} to="/friends">친구</Link>
                <Link className={`btn ${loc.pathname === '/notifications' ? 'active' : ''}`} to="/notifications">알림</Link>
            </nav>
        </header>
    )
}