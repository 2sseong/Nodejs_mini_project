import userService from './invite.service.js';

export async function search(req, res, next) {
    try {
        const users = await userService.searchUsers({ q: req.query.query });
        res.json({ success: true, users });
    } catch (e) { next(e); }
}