import { useRef } from 'react';

export default function ProfileImageSection({ profileSrc, onFileChange }) {
    const fileInputRef = useRef(null);

    const handleProfileClick = () => {
        fileInputRef.current.click();
    };

    return (
        <div className="profile-section">
            <div className="profile-img-wrapper">
                <img src={profileSrc} alt="Profile" className="profile-img" />
            </div>
            {/* 파일 입력창은 숨김 처리 */}
            <input 
                type="file" 
                ref={fileInputRef} 
                style={{ display: 'none' }} 
                accept="image/*"
                onChange={onFileChange}
            />
            <button className="btn-upload" onClick={handleProfileClick}>
                사진 변경
            </button>
        </div>
    );
}