import cors from 'cors';
import express from 'express';
import './store';
import { auth } from './middleware/auth';
import { errorHandler } from './middleware/errorHandler';
import usersRouter from './routes/users';

const app = express();

app.use(cors());
app.use(express.json());

app.get('/', (_req, res) => {
  res.send('hello world');
});

app.use('/api', auth);
app.use('/api/users', usersRouter);

app.use(errorHandler);

const PORT = 4000;

if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`server listening on port ${PORT}`);
  });
}

export default app;