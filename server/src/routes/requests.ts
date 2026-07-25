import { Router } from 'express';
import { createDraft, getRequest, listRequests, updateDraft } from '../services/requests.service';
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

router.post('/', (req, res, next) => {
  try {
    res.json(toResponse(createDraft(req.currentUser, req.body)));
  } catch (err) {
    next(err);
  }
});

router.patch('/:id', (req, res, next) => {
  try {
    res.json(toResponse(updateDraft(req.currentUser, req.params.id, req.body)));
  } catch (err) {
    next(err);
  }
});

export default router;