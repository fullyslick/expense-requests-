import { Router } from 'express';
import { getRequest, listRequests } from '../services/requests.service';
import { toResponse } from '../services/serialize';

const router = Router();

router.get('/', (_req, res) => {
  res.json(listRequests().map(toResponse));
});

router.get('/:id', (req, res, next) => {
  try {
    res.json(toResponse(getRequest(req.params.id)));
  } catch (err) {
    next(err);
  }
});

export default router;