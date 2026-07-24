import express from 'express';
import './store';

const app = express();

app.get('/', (_req, res) => {
  res.send('hello world');
});

const PORT = 4000;

if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`server listening on port ${PORT}`);
  });
}

export default app;
