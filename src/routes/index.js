import express from 'express';
import { getDashboard } from '../controllers/webController.js';

const router = express.Router();

router.get('/', getDashboard);

export default router;
