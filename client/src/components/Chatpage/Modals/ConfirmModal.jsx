// src/components/Chatpage/Modals/ConfirmModal.jsx
import React from 'react';
import './Modals.css';

export default function ConfirmModal({ 
    isOpen, 
    onClose, 
    onConfirm, 
    title, 
    message, 
    isLoading,
    confirmText = '확인',
    cancelText = '취소', // cancelText가 null이면 렌더링 안 함
    isDanger = false
}) {
    if (!isOpen) return null;

    const handleBackdropClick = () => {
        if (!isLoading) onClose();
    };

    const stopPropagation = (e) => e.stopPropagation();

    return (
        <div className="modal-backdrop" onClick={handleBackdropClick} style={{ zIndex: 1100 }}> {/* zIndex 높여서 InviteUserModal 위에 뜨게 함 */}
            <div className="modal-content" onClick={stopPropagation} style={{ maxWidth: '400px' }}>
                <h3>{title}</h3>
                <p style={{ margin: '10px 0', color: '#555', lineHeight: '1.5', whiteSpace: 'pre-wrap' }}>
                    {message}
                </p>

                <div className="modal-actions">
                    {/* cancelText가 있을 때만 렌더링 */}
                    {cancelText && (
                        <button onClick={onClose} disabled={isLoading}>
                            {cancelText}
                        </button>
                    )}
                    <button 
                        onClick={onConfirm} 
                        disabled={isLoading}
                        style={{ 
                            backgroundColor: isDanger ? '#dc3545' : '#007bff',
                            color: 'white',
                             // 취소 버튼 없으면 너비를 꽉 채우거나 오른쪽 정렬 유지
                             marginLeft: cancelText ? '0' : 'auto' 
                        }}
                    >
                        {isLoading ? '처리 중...' : confirmText}
                    </button>
                </div>
            </div>
        </div>
    );
}