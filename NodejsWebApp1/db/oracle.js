// db/oracle.js (ESM 방식, 최적화된 쿼리 실행기 포함)

import oracledb from 'oracledb';
import 'dotenv/config'; // .env 파일 로드


// 쿼리 결과를 JavaScript 객체 배열로 자동 변환 (O(1) 설정)
oracledb.outFormat = oracledb.OUT_FORMAT_OBJECT;
oracledb.fetchAsString = [oracledb.CLOB];

let pool; // 커넥션 풀을 저장할 변수

// DB 접속 정보 (환경 변수에서 로드)
const dbConfig = {
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    connectString: process.env.DB_CONNECT_STRING || `${process.env.DB_HOST}:${process.env.DB_PORT}/${process.env.DB_SID}`,
    poolMin: 5,  // 최소 유휴 커넥션 (성능 최적화)
    poolMax: 15, // 최대 커넥션 수
    poolIncrement: 1
};

/**
 * 1. 서버 시작 시 커넥션 풀 초기화 (O(N) - N은 poolMin)
 */
export async function initialize() {
    try {
        pool = await oracledb.createPool(dbConfig);
        console.log('Oracle DB Connection Pool established successfully.');
    } catch (err) {
        console.error('Error creating Oracle DB Connection Pool:', err);
        throw err;
    }
}

/**
 * 2. 쿼리 실행 (SELECT, Auto-commit INSERT/UPDATE)
 * 시간 복잡도: O(1) (풀에서 연결 획득) + O(log N) (DB 인덱스 조회)
 */
export async function executeQuery(sql, binds = [], options = {}) {
    let connection;
    try {
        connection = await pool.getConnection(); // O(1)
        const result = await connection.execute(sql, binds, options);
        return result;
    } catch (err) {
        console.error("DB Query Error:", sql, err);
        throw err;
    } finally {
        if (connection) {
            await connection.close(); // O(1) - 풀에 반환
        }
    }
}

/**
 * 3. 트랜잭션 실행 (COMMIT/ROLLBACK 수동 관리)
 * (메시지 저장은 단일 INSERT이므로 이 함수를 사용하는 것이 가장 안전함)
 *  변경: options 인자를 추가하여 RETURNING INTO 등의 고급 옵션을 지원
 */
export async function executeTransaction(sql, binds = [], options = {}) { // options 인자 추가
    let connection;
    try {
        connection = await pool.getConnection(); // O(1)

        // autoCommit: false를 기본으로 설정하되, 외부 옵션을 병합
        const execOptions = { ...options, autoCommit: false };

        // 💡 execute 실행 시 options를 함께 전달
        const result = await connection.execute(sql, binds, execOptions);

        await connection.commit(); // O(1)
        return result;
    } catch (err) {
        if (connection) {
            await connection.rollback(); // O(1)
        }
        console.error("DB Transaction Error:", sql, err);
        throw err;
    } finally {
        if (connection) {
            await connection.close(); // O(1)
        }
    }
}

export { oracledb };