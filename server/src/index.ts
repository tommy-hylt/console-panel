import express from 'express';
import { listHandler } from './routes/list';
import { captureHandler } from './routes/capture';

const app = express();

app.get('/list', listHandler);
app.get('/capture/:handle', captureHandler);

const port = Number(process.env.PORT || 8787);
app.listen(port, () => {
  console.log(`ConsolePanel server listening on http://127.0.0.1:${port}`);
});
