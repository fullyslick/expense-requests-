import { listUsers } from '../services/users.service';
import { Router } from 'express';

const router = Router();

router.get('/', (_req, res) => {
  res.json(listUsers());
});

export default router;
