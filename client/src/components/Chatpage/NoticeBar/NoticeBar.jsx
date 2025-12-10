import { useState } from 'react';
import './NoticeBar.css';

export default function NoticeBar({ notice, onClear, onClose, isOwner }) {
    const [isExpanded, setIsExpanded] = useState(false);

    if (!notice) return null;

    const toggleExpand = () => setIsExpanded(!isExpanded);

    return (
        <div className={`notice-bar ${isExpanded ? 'expanded' : ''}`}>
            <div className="notice-icon">📢</div>
            <div className="notice-content" onClick={toggleExpand}>
                <span className={`notice-text ${isExpanded ? '' : 'truncated'}`}>
                    {notice.CONTENT || notice.content}
                </span>
            </div>
            <div className="notice-actions">
                {isOwner && (
                    <button className="notice-clear-btn" onClick={onClear} title="공지 해제">
                        ✕
                    </button>
                )}
                <button className="notice-close-btn" onClick={onClose} title="공지 닫기">
                    <i className="bi bi-chevron-up"></i>
                </button>
            </div>
        </div>
    );
}
