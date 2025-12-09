// 폼 입력 상태 관리, 유효성 검사, 백엔드 API호출

// src/components/auth/SignupForm.jsx

import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import DaumPostcode from 'react-daum-postcode';
import './SignupForm.css';
import { signup, getDepartments, getPositions } from '../../api/authApi.jsx';

function SignupForm() {
    // UI 피드백을 위한 상태
    const [loading, setLoading] = useState(false);
    const navigate = useNavigate();

    // 목록 데이터 상태
    const [deptList, setDeptList] = useState([]);
    const [posList, setPosList] = useState([]);

    // 입력 폼 상태
    const [formData, setFormData] = useState({
        email: '',
        password: '',
        confirmPassword: '',
        nickname: '',
        deptId: '',
        posId: '',
        phone: '',
        address: '',
        addressDetail: ''
    });

    // 주소 검색 모달 상태
    const [isAddressOpen, setIsAddressOpen] = useState(false);

    // 모달 상태
    const [modal, setModal] = useState({
        show: false,
        type: '',
        message: ''
    });

    // 컴포넌트 마운트 시 부서/직급 목록 가져오기
    useEffect(() => {
        const fetchOptions = async () => {
            try {
                //서버 API 호출을 통해 부서 목록과 직급 목록을 가져옴.
                const depts = await getDepartments();
                const positions = await getPositions();
                // 가져온 데이터를 상태에 저장
                setDeptList(depts);
                setPosList(positions);

                // 목록의 첫 번째 값을 기본값으로 설정
                if (depts.length > 0) setFormData(prev => ({ ...prev, deptId: depts[0].deptId }));
                if (positions.length > 0) setFormData(prev => ({ ...prev, posId: positions[0].posId }));
            } catch (error) {
                console.error("부서/직급 정보를 불러오는데 실패했습니다.", error);
                showModal('error', '부서/직급 정보를 불러오는데 실패했습니다.');
            }
        };
        fetchOptions();
    }, []);

    // 모달 표시 함수
    const showModal = (type, message) => {
        setModal({ show: true, type, message });
    };

    // 모달 닫기 함수
    const closeModal = () => {
        setModal({ show: false, type: '', message: '' });
    };

    // 폼 입력값을 상태(state)에 반영
    const handleChange = (e) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
    };

    // 다음 주소 검색 완료 핸들러
    const handleAddressComplete = (data) => {
        setFormData(prev => ({ ...prev, address: data.address }));
        setIsAddressOpen(false);
    };

    // 폼 제출 시 API 호출
    const handleSubmit = async (e) => {
        e.preventDefault();

        // formData에서 값 추출
        const { email, password, confirmPassword, nickname, deptId, posId, phone, address } = formData;

        // 유효성 검사
        if (!email || !password || !confirmPassword || !nickname || !deptId || !posId || !phone || !address) {
            showModal('error', '모든 필드를 입력해야 합니다.');
            return;
        }

        if (password !== confirmPassword) {
            showModal('error', '비밀번호와 비밀번호 확인이 일치하지 않습니다.');
            return;
        }

        setLoading(true);

        try {
            // 전화번호 포맷팅 (01012345678 -> 010-1234-5678)
            const formatPhone = (rawPhone) => {
                const digits = rawPhone.replace(/\D/g, '');
                if (digits.length === 11) {
                    return `${digits.slice(0, 3)}-${digits.slice(3, 7)}-${digits.slice(7)}`;
                } else if (digits.length === 10) {
                    return `${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6)}`;
                }
                return digits;
            };

            const { ok, data } = await signup({
                email,
                password,
                nickname,
                deptId: Number(deptId),
                posId: Number(posId),
                phone: formatPhone(formData.phone),
                address: formData.address,
                addressDetail: formData.addressDetail || null
            });

            if (ok) {
                // 성공 메시지 표시
                showModal('success', data.message || '회원가입이 완료되었습니다.\n10초 후 로그인 화면으로 이동합니다.');

                // 입력 필드 초기화
                setFormData({
                    email: '',
                    password: '',
                    confirmPassword: '',
                    nickname: '',
                    deptId: deptList.length > 0 ? deptList[0].deptId : '',
                    posId: posList.length > 0 ? posList[0].posId : '',
                    phone: '',
                    address: '',
                    addressDetail: ''
                });

                // 10초 후 로그인 페이지로 이동
                setTimeout(() => {
                    navigate('/login');
                }, 5000);
            } else {
                // 백엔드에서 받은 오류 메시지를 사용
                showModal('error', data.message || '가입 실패');
            }
        } catch (err) {
            console.error('API 호출 중 실제 오류:', err);
            // 네트워크 오류 등 예외 처리
            showModal('error', '서버 연결 오류가 발생했습니다.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="signup-form">
            <h3>회원 정보 입력</h3>

            <form onSubmit={handleSubmit}>
                {/* 1. 이메일 입력 필드 */}
                <div className="form-group">
                    <label htmlFor="email">이메일</label>
                    <input
                        type="email"
                        id="email"
                        name="email"
                        value={formData.email}
                        onChange={handleChange}
                        required
                        disabled={loading}
                    />
                </div>

                {/* 2. 닉네임 입력 필드 */}
                <div className="form-group">
                    <label htmlFor="nickname">이름</label>
                    <input
                        type="text"
                        id="nickname"
                        name="nickname"
                        value={formData.nickname}
                        onChange={handleChange}
                        required
                        disabled={loading}
                    />
                </div>

                {/* 3. 부서 선택(드롭다운) */}
                <div className="form-group">
                    <label htmlFor="deptId">부서</label>
                    <select
                        id="deptId"
                        name="deptId"
                        value={formData.deptId}
                        onChange={handleChange}
                        required
                        disabled={loading}
                    >
                        <option value="" disabled>부서를 선택해주세요</option>
                        {deptList.map((dept) => (
                            <option key={dept.deptId} value={dept.deptId.toString()}>
                                {dept.deptName}
                            </option>
                        ))}
                    </select>
                </div>

                {/* 4. 직급 선택 드롭다운 */}
                <div className="form-group">
                    <label htmlFor="posId">직급</label>
                    <select
                        id="posId"
                        name="posId"
                        value={formData.posId}
                        onChange={handleChange}
                        required
                        disabled={loading}
                    >
                        <option value="" disabled>직급을 선택해주세요</option>
                        {posList.map((pos) => (
                            <option key={pos.posId} value={pos.posId.toString()}>
                                {pos.posName}
                            </option>
                        ))}
                    </select>
                </div>

                {/* 5. 전화번호 입력 필드 */}
                <div className="form-group">
                    <label htmlFor="phone">전화번호 <span className="required">*</span></label>
                    <input
                        type="tel"
                        id="phone"
                        name="phone"
                        value={formData.phone}
                        onChange={handleChange}
                        placeholder="01012345678 (- 없이 입력)"
                        disabled={loading}
                        required
                    />
                </div>

                {/* 6. 주소 입력 필드 */}
                <div className="form-group">
                    <label>주소 <span className="required">*</span></label>
                    <div className="address-input-row">
                        <input
                            type="text"
                            name="address"
                            value={formData.address}
                            readOnly
                            placeholder="주소 검색을 클릭하세요"
                            disabled={loading}
                            required
                        />
                        <button
                            type="button"
                            className="address-search-btn"
                            onClick={() => setIsAddressOpen(true)}
                            disabled={loading}
                        >
                            검색
                        </button>
                    </div>
                </div>

                {/* 상세주소 */}
                <div className="form-group">
                    <label htmlFor="addressDetail">상세주소</label>
                    <input
                        type="text"
                        id="addressDetail"
                        name="addressDetail"
                        value={formData.addressDetail}
                        onChange={handleChange}
                        placeholder="상세주소를 입력하세요"
                        disabled={loading}
                    />
                </div>

                {/* 7. 비밀번호 입력 필드 */}
                <div className="form-group">
                    <label htmlFor="password">비밀번호</label>
                    <input
                        type="password"
                        id="password"
                        name="password"
                        value={formData.password}
                        onChange={handleChange}
                        required
                        disabled={loading}
                    />
                </div>

                {/* 6. 비밀번호 확인 입력 필드 */}
                <div className="form-group">
                    <label htmlFor="confirmPassword">비밀번호 확인</label>
                    <input
                        type="password"
                        id="confirmPassword"
                        name="confirmPassword"
                        value={formData.confirmPassword}
                        onChange={handleChange}
                        required
                        disabled={loading}
                    />
                </div>

                {/* 제출 버튼 */}
                <button type="submit" disabled={loading} className="submit-btn">
                    {loading ? '가입 중...' : '회원가입'}
                </button>
            </form>

            {/* 알림 모달 */}
            {modal.show && (
                <div className="modal-overlay" onClick={closeModal}>
                    <div className={`modal-content ${modal.type}`} onClick={(e) => e.stopPropagation()}>
                        <div className="modal-icon">
                            {modal.type === 'success' ? '✓' : '✕'}
                        </div>
                        <p className="modal-message">{modal.message}</p>
                    </div>
                </div>
            )}

            {/* 주소 검색 모달 */}
            {isAddressOpen && (
                <div className="modal-overlay" onClick={() => setIsAddressOpen(false)}>
                    <div className="address-modal-content" onClick={(e) => e.stopPropagation()}>
                        <div className="address-modal-header">
                            <h4>주소 검색</h4>
                            <button onClick={() => setIsAddressOpen(false)}>✕</button>
                        </div>
                        <DaumPostcode onComplete={handleAddressComplete} />
                    </div>
                </div>
            )}
        </div>
    );
}

export default SignupForm;