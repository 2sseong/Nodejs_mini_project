import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { getRoomFilesApi } from '../api/chatApi';
import '../styles/FileDrawerPage.css'; // 아래 CSS 파일 참고

export default function FileDrawerPage() {
    const { roomId } = useParams();
    const [files, setFiles] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchFiles = async () => {
            try {
                const res = await getRoomFilesApi(roomId);
                if (res.data.success) {
                    setFiles(res.data.data);
                }
            } catch (err) {
                console.error('Failed to load files:', err);
                alert('파일 목록을 불러오지 못했습니다.');
            } finally {
                setLoading(false);
            }
        };
        fetchFiles();
    }, [roomId]);

    const handleDownload = (fileUrl, fileName) => {
        // 다운로드 또는 새 창으로 열기
        const link = document.createElement('a');
        link.href = fileUrl;
        link.download = fileName; // 동일 출처일 경우 동작
        link.target = '_blank';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    if (loading) return <div className="drawer-loading">로딩 중...</div>;

    return (
        <div className="file-drawer-container">
            <header className="drawer-header">
                <h2>채팅방 서랍</h2>
                <span className="file-count">총 {files.length}개</span>
            </header>
            <div className="drawer-content">
                {files.length === 0 ? (
                    <div className="no-files">주고받은 파일이 없습니다.</div>
                ) : (
                    <ul className="file-list">
                        {files.map((file) => (
                            <li key={file.MSG_ID} className="file-item" onClick={() => handleDownload(file.FILE_URL, file.FILE_NAME)}>
                                <div className="file-icon">📁</div>
                                <div className="file-info">
                                    <div className="file-name" title={file.FILE_NAME}>{file.FILE_NAME}</div>
                                    <div className="file-date">{new Date(file.SENT_AT).toLocaleString()}</div>
                                </div>
                                <button className="download-btn">⬇</button>
                            </li>
                        ))}
                    </ul>
                )}
            </div>
        </div>
    );
}