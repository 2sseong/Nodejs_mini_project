// db/oracle.js (ESM 방식, 최종 최적화)

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

// 1. 서버 시작 시 커넥션 풀 초기화 (O(N) - N은 poolMin)
export async function initialize() {
    try {
        pool = await oracledb.createPool(dbConfig);
        console.log('Oracle DB Connection Pool established successfully.');
    } catch (err) {
        console.error('Error creating Oracle DB Connection Pool:', err);
        throw err;
    }
}

// ==========================================================
// getConnection 복구 (수동 트랜잭션 관리를 위해 필수)
// ==========================================================
/**
 * 2. 커넥션 풀에서 커넥션 객체를 가져옵니다.
 * 이 커넥션으로 execute()를 호출할 때는 반드시 autoCommit: false를 설정해야 하며,
 * 작업 완료 후 connection.commit() 또는 connection.rollback() 후 connection.close()를 수동으로 호출해야 합니다.
 */
export function getConnection() {
    if (!pool) {
        throw new Error("DB Pool is not initialized. Call initialize() first.");
    }
    return pool.getConnection(); // O(1)
}


/*
 * 3. 쿼리 실행 (SELECT, Auto-commit INSERT/UPDATE)
 */
export async function executeQuery(sql, binds = [], options = {}) {
    let connection;
    try {
        connection = await pool.getConnection(); // O(1)
        // AutoCommit은 기본 옵션을 따릅니다 (SELECT는 무시, DML은 true).
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

/*
 * 4. 트랜잭션 실행 (단일 COMMIT/ROLLBACK 수동 관리)
 */
export async function executeTransaction(sql, binds = [], options = {}) {
    let connection;
    try {
        connection = await pool.getConnection(); // O(1)
        const execOptions = { ...options, autoCommit: false };
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

// 5. Oracledb 객체 자체를 내보내어 고급 옵션(oracledb.OUT_FORMAT_OBJECT, oracledb.NUMBER 등) 사용을 지원
export { oracledb };