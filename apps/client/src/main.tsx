import { contentSizes } from '@8box/shared';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { SERVER_URL } from './env';
import { startConnection } from './game/connection';
import { content } from './game/content';
import { App } from './ui/App';
import './ui/app.css';

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error('Missing #root element');
}

if (import.meta.env.DEV) {
  console.info('[8box] content loaded', contentSizes(content));
}

startConnection(SERVER_URL);

createRoot(rootElement).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
