// db/oracle.js (ES Module)

// 1. require 대신 import 사용
import oracledb from 'oracledb';
import dotenv from 'dotenv';

dotenv.config();

// 연결 풀 객체
let pool;

// DB 접속 정보
const dbConfig = {
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    connectString: `${process.env.DB_HOST}:${process.env.DB_PORT}/${process.env.DB_SID}`
};

/**
 * @description Oracle DB 연결 풀을 초기화합니다.
 */
// 연결 풀 초기화 함수
export async function initialize() { // 2. export 키워드를 앞에 붙여 내보냅니다.
    try {
        // oracledb 설정
        // oracledb.outFormat = oracledb.OUT_FORMAT_OBJECT; // 필요시 추가

        pool = await oracledb.createPool(dbConfig);
        console.log('Oracle DB Connection Pool established successfully.');
    } catch (err) {
        console.error('Error creating Oracle DB Connection Pool:', err);
        throw err;
    }
}

/**
 * @description 연결 풀에서 커넥션을 얻습니다.
 * @returns {Promise<oracledb.Connection>}
 */
// 연결 풀에서 커넥션을 얻음
export function getConnection() { // 2. export 키워드를 앞에 붙여 내보냅니다.
    if (!pool) {
        throw new Error("DB Pool is not initialized. Call initialize() first.");
    }
    return pool.getConnection();
}

export { oracledb };