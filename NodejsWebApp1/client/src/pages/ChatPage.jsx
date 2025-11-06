import { useEffect, useMemo, useRef, useState } from 'react'
import { io } from 'socket.io-client'

// 개발 중엔 Vite 프록시를 쓰거나 직접 포트를 지정하세요...
const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || '/'

export default function ChatPage() {
    const [connected, setConnected] = useState(false)
    const [messages, setMessages] = useState([])
    const [text, setText] = useState('')
    const bottomRef = useRef(null)

    // 소켓 인스턴스 (컴포넌트 생명주기 동안 유지)
    const socket = useMemo(() => io(SOCKET_URL, {
        withCredentials: true,
    }), [])



    useEffect(() => {
        socket.on('connect', () => setConnected(true))
        socket.on('disconnect', () => setConnected(false))

        // 서버에서 'chat:message' 이벤트로 메시지 브로드캐스트한다고 가정
        socket.on('chat:message', (msg) => {
            setMessages(prev => [...prev, msg])
        })

        return () => {
            socket.off('connect')
            socket.off('disconnect')
            socket.off('chat:message')
            socket.close()
        }
    }, [socket])

    useEffect(() => {
        bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
    }, [messages])

    const send = () => {
        const trimmed = text.trim()
        if (!trimmed) return
        const msg = { user: 'me', text: trimmed, ts: Date.now() }
        socket.emit('chat:message', msg)    // 서버로 전송
        setMessages(prev => [...prev, msg]) // 낙관적 업데이트
        setText('')
    }

    return (
        <div style={{ padding: 24, display: 'flex', flexDirection: 'column', height: 'calc(100vh - 56px)' }}>
            <h2>실시간 채팅 {connected ? 'true' : 'false'}</h2>

            <div style={{
                flex: 1, overflowY: 'auto', border: '1px solid #e5e7eb',
                borderRadius: 8, padding: 12, marginBottom: 12, background: '#fff'
            }}>
                {messages.map((m, i) => (
                    <div key={i} style={{
                        display: 'flex', marginBottom: 8,
                        justifyContent: m.user === 'me' ? 'flex-end' : 'flex-start'
                    }}>
                        <div style={{
                            maxWidth: '70%', padding: '8px 12px', borderRadius: 12,
                            background: m.user === 'me' ? '#e0f2fe' : '#f3f4f6'
                        }}>
                            <div style={{ fontSize: 12, opacity: 0.7 }}>{m.user}</div>
                            <div>{m.text}</div>
                        </div>
                    </div>
                ))}
                <div ref={bottomRef} />
            </div>

            <div style={{ display: 'flex', gap: 8 }}>
                <input
                    value={text}
                    onChange={e => setText(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && send()}
                    placeholder="메시지를 입력하세요"
                    style={{ flex: 1, padding: '10px 12px', borderRadius: 8, border: '1px solid #d1d5db' }}
                />
                <button onClick={send} style={{ padding: '10px 16px', borderRadius: 8 }}>보내기</button>
            </div>
        </div>
    )
}