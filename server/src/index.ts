import express from 'express';
import cors from 'cors';
import path from 'path';
import { listHandler } from './routes/list';
import { captureHandler } from './routes/capture';
import { foregroundHandler } from './routes/foreground';
import { textHandler } from './routes/text';
import { keyHandler } from './routes/key';
import { killHandler } from './routes/kill';
import { newHandler } from './routes/new';

const app = express();

// Enable CORS for all origins and methods
app.use(cors({
  origin: '*',
  methods: '*',
  allowedHeaders: '*'
}));

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

// Serve web app from web/dist
const webDist = path.join(__dirname, '..', '..', 'web', 'dist');
app.use(express.static(webDist));
app.get('*splat', (_req, res) => {
  res.sendFile(path.join(webDist, 'index.html'));
});

const port = Number(process.env.PORT || 8787);
app.listen(port, () => {
  console.log(`ConsolePanel server listening on http://127.0.0.1:${port}`);
});
