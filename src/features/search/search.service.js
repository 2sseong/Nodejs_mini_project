import { searchUsersByPrefix, findAllUsers } from './search.repository.js';

export async function searchUsers({ q }) {
    const trimmedQ = q ? q.trim() : null; // q가 있을 경우에만 trim

if (!trimmedQ || trimmedQ.length === 0) {
    // 1. 검색어가 없는 경우 (전체 목록 요청)
    return await findAllUsers();
    }
    
    // 2. 검색어가 있지만 너무 짧은 경우 (기존 로직 유지)
    if (trimmedQ.length < 2) { 
        return [];
    }

    // 3. 검색어가 유효한 경우 (검색 기능 수행)
    return await searchUsersByPrefix(trimmedQ);
}

export default { searchUsers };

//     if (!q || q.trim().length < 2) return [];
//     return await searchUsersByPrefix(q.trim());
// }

// export default { searchUsers };