import { searchUsersByPrefix } from './search.repository.js';

export async function searchUsers({ q }) {
    if (!q || q.trim().length < 2) return [];
    return await searchUsersByPrefix(q.trim());
}

export default { searchUsers };