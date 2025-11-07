import { Router } from 'express';
import * as ctrl from './invite.controller.js';

const r = Router();
r.get('/search', ctrl.search);

export default r;