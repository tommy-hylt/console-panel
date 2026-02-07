import express from 'express';
import { listHandler } from './routes/list';
import { captureHandler } from './routes/capture';
import { foregroundHandler } from './routes/foreground';
import { textHandler } from './routes/text';
import { keyHandler } from './routes/key';
import { killHandler } from './routes/kill';
import { newHandler } from './routes/new';

const app = express();

// Parse JSON bodies
app.use(express.json());

// GET endpoints
app.get('/list', listHandler);
app.get('/capture/:handle', captureHandler);

// POST endpoints
app.post('/foreground', foregroundHandler);
app.post('/text', textHandler);
app.post('/key', keyHandler);
app.post('/kill', killHandler);
app.post('/new', newHandler);

const port = Number(process.env.PORT || 8787);
app.listen(port, () => {
  console.log(`ConsolePanel server listening on http://127.0.0.1:${port}`);
});
