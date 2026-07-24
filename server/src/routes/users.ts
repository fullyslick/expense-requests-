import { Router } from 'express';
import { listUsers } from '../store';

const router = Router();

router.get('/', (_req, res) => {
  res.json(listUsers());
});

export default router;