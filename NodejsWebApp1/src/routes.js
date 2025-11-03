// 간단 CRUD의 기반이 되는 샘플 라우트
import { Router } from 'express';
const router = Router();

// 목록
router.get('/items', (req, res) => {
    const data = [
        { id: 1, name: 'Apple', price: 1.5 },
        { id: 2, name: 'Banana', price: 0.99 }
    ];
    res.json(data);
});

// 생성
router.post('/items', (req, res) => {
    const { name, price } = req.body || {};
    if (!name) return res.status(400).json({ error: 'NAME_REQUIRED' });
    // DB 연동 시 INSERT 로직 자리
    res.status(201).json({ id: 3, name, price: price ?? 0 });
});

router.get('/health', (req, res) => {
    res.status(200).json({ message: 'API is running!' });
});

export default router;