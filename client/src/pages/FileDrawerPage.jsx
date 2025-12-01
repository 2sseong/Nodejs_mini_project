import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { getRoomFilesApi } from '../api/chatApi';
import Titlebar from '../components/Titlebar/Titlebar.jsx'; // [추가]
import '../styles/FileDrawerPage.css';

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
        const link = document.createElement('a');
        link.href = fileUrl;
        link.download = fileName;
        link.target = '_blank';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    return (
        <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', backgroundColor: '#fff' }}>
            {/* [추가] 커스텀 타이틀바 */}
            <Titlebar title="채팅방 서랍" />

            {/* 메인 컨텐츠 영역 */}
            <div className="file-drawer-container" style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
                <header className="drawer-header">
                    <h2>파일 목록</h2>
                    <span className="file-count">총 {files.length}개</span>
                </header>
                
                <div className="drawer-content" style={{ flex: 1, overflowY: 'auto' }}>
                    {loading ? (
                        <div className="drawer-loading">로딩 중...</div>
                    ) : files.length === 0 ? (
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
        </div>
    );
}