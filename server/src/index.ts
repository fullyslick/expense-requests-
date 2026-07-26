import cors from 'cors';
import express from 'express';
import './store';
import { auth } from './middleware/auth';
import { errorHandler } from './middleware/errorHandler';
import requestsRouter from './routes/requests';
import usersRouter from './routes/users';
import { API_PREFIX, SERVER_PORT } from 'shared/constants';

const app = express();

app.use(cors());
app.use(express.json());

app.get('/', (_req, res) => {
  res.send('hello world');
});

app.use(API_PREFIX, auth);
app.use(`${API_PREFIX}/users`, usersRouter);
app.use(`${API_PREFIX}/requests`, requestsRouter);

app.use(errorHandler);

if (require.main === module) {
  app.listen(SERVER_PORT, () => {
    console.log(`server listening on port ${SERVER_PORT}`);
  });
}

export default app;