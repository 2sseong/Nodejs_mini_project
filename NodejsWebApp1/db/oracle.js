const oracledb = require('oracledb');
const dotenv = require('dotenv');

dotenv.config();

// 연결 풀 객체
let pool;

// DB 접속 정보
const dbConfig = {
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    connectString: `${process.env.DB_HOST}:${process.env.DB_PORT}/${process.env.DB_SID}`

// 연결 풀 초기화 함수
async function initialize() {
    try {
        // oracledb 설정

        pool = await oracledb.createPool(dbConfig);
        console.log('Oracle DB Connection Pool established successfully.');
    } catch (err) {
        console.error('Error creating Oracle DB Connection Pool:', err);
        throw err;
    }
}

// 연결 풀에서 커넥션을 얻음
function getConnection() {
    return pool.getConnection();
}

// 모듈로 내보내기
module.exports = {
    initialize,
    getConnection
};