import { useEffect, useState } from 'react'
import { get } from './api/http'

export default function App() {
    const [msg, setMsg] = useState('loading...')

    useEffect(() => {
        // 백엔드에서 /api/health 같은 헬스체크 라우트 하나만 있어도 됩니다.
        get('/health').then((d) => setMsg(d.message || JSON.stringify(d))).catch(e => setMsg(String(e)))
    }, [])

    return (
        <main style={{ padding: 24 }}>
            <h1>React + Node.js + Oracle Starter</h1>
            <p>Backend says: {msg}</p>
        </main>
    )
}