import React, { useState, useRef, useImperativeHandle, forwardRef } from 'react';
import './UserSearch.css';

const UserSearch = forwardRef(({ onQueryChange }, ref) => {
    const [inputQuery, setInputQuery] = useState('');
    const inputRef = useRef(null);

    // 부모 컴포넌트에서 focus 메서드 호출 가능하게 함
    useImperativeHandle(ref, () => ({
        focus: () => {
            inputRef.current?.focus();
        }
    }));

    const handleInputChange = (e) => {
        const query = e.target.value;
        setInputQuery(query);
        onQueryChange(query);
    };

    const handleButtonClick = () => {
        onQueryChange(inputQuery);
    };

    return (
        <div className="user-search-container">
            <div className="search-form-flex">
                <input
                    ref={inputRef}
                    type="text"
                    value={inputQuery}
                    onChange={handleInputChange}
                    placeholder="이름 또는 아이디로 검색"
                />
                <button
                    type="button"
                    onClick={handleButtonClick}
                    className="btn-search"
                >
                    <i className="bi bi-search"></i>
                </button>
            </div>
        </div>
    );
});

export default UserSearch;