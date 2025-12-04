import React, { useState } from 'react';
import './UserSearch.css'; 

function UserSearch( { onQueryChange } ) {
    // 검색어 상태 관리
    const [inputQuery, setInputQuery] = useState('');

    // 입력값 변경 핸들러
    const handleInputChange = (e) => {
        const query = e.target.value;
        setInputQuery(query);
        // 실시간 검색을 위해 상위 컴포넌트의 상태를 업데이트
        onQueryChange(query); 
    };

    // 검색 버튼 클릭 핸들러
    const handleButtonClick = () => {
        onQueryChange(inputQuery); 
    };

    return (
        <div className="user-search-container">
            {/* input과 button을 한 줄로 배치하기 위한 클래스 */}
            <div className="search-form-flex"> 
                <input
                    type="text"
                    value={inputQuery}
                    onChange={handleInputChange} 
                    placeholder="사용자 이름이나 아이디를 입력하세요 !"
                />
                <button
                type="button"
                onClick={handleButtonClick}
                className="btn-search">검색
                </button> 
            </div>
        </div>
    );
}

export default UserSearch;