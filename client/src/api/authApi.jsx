// src/api/authApi.js

const API_URL = 'http://localhost:1337/api/auth'; // <--- Base URL을 상수로 정의

/**
 * 새로운 사용자를 등록하는 API 함수
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