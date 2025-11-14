import { Routes, Route, Navigate } from 'react-router-dom'
import Topbar from './components/Topbar/Topbar.jsx'
import LoginPage from './pages/LoginPage.jsx'
import ChatPage from './pages/ChatPage.jsx'
import NotificationsPage from './pages/NotificationsPage.jsx'
import FriendPage from './pages/FriendPage.jsx';
import Titlebar from './components/Titlebar/Titlebar.jsx'
import './App.css';

export default function App() {
    return (
        <>
        <div className="App">
            <Titlebar />
            <Topbar />
            <div className="content-area">
                <Routes>
                    <Route path="/" element={<Navigate to="/chat" replace />} />
                    <Route path="/login" element={<LoginPage />} />
                    <Route path="/chat" element={<ChatPage />} />
                    <Route path="/notifications" element={<NotificationsPage />} />
                    <Route path="/friends" element={<FriendPage />} />
                    <Route path="*" element={<div style={{ padding: 24 }}>404 Not Found</div>} />
                </Routes>
            </div>
        </div>
        </>
    )
}