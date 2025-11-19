// src/api/authApi.js

const API_URL = 'http://localhost:1337/api/auth'; 

// 응답 메세지를 안전하게 파싱함
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

/**
 * 새로운 사용자를 등록하는 API 함수 (회원가입)
 * @param {object} signupData - { email, password, nickname }
 * @returns {object} 응답 데이터 (success, message, userId 등)
 */
export async function signup(signupData) {
    const url = `${API_URL}/signup`; 

    const response = await fetch(url, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(signupData),
    });
    
    // 응답 JSON 파싱
    const data = await response.json();

    // 응답 상태와 데이터를 함께 반환
    return {
        ok: response.ok, // HTTP 상태 코드가 200번대인지 여부 (true/false)
        data: data,
    };
}


// 로그인
export async function login(loginData) {
    const url = `${API_URL}/login`;
    
    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify(loginData),
        });

        // 에러 처리: fetch는 ok=false로 응답하지만, throw로 통일
        if (!response.ok) {
            const msg = await safeMessage(response);
            // 오류 발생 시, API 함수가 바로 Error 객체를 던짐
            throw new Error(msg || `로그인 실패 (${response.status})`);
        }
        
        // 성공 응답 JSON 파싱
        const data = await response.json();
        
        // 성공 시 데이터 반환
        return {
            ok: response.ok, // 항상 true
            data: data,
        };

    } catch (error) {
        // 네트워크 오류나 위에서 던진 Error 객체 처리
        // Controller/Page에서 동일하게 catch 블록으로 처리할 수 있도록 에러를 다시 던짐
        throw error; 
    }
}