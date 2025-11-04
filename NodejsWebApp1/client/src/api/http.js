export const apiBase = import.meta.env.VITE_API_BASE || '/api'

export async function get(path, opts = {}) {
    const res = await fetch(`${apiBase}${path}`, { credentials: 'include', ...opts })
    if (!res.ok) throw new Error(`${res.status} ${res.statusText}`)
    return res.json()
}

export async function post(path, body, opts = {}) {
    const res = await fetch(`${apiBase}${path}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(opts.headers || {}) },
        credentials: 'include',
        body: JSON.stringify(body),
        ...opts,
    })
    if (!res.ok) throw new Error(`${res.status} ${res.statusText}`)
    return res.json()
}