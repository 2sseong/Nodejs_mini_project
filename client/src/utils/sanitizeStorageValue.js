// src/utils/sanitizeStorageValue.js
export default function sanitizeStorageValue(v) {
    if (v === null) return null;
    const trimmed = String(v).trim().replace(/^"+|"+$/g, '');
    if (!trimmed || trimmed === 'null' || trimmed === 'undefined') return null;
    return trimmed;
}