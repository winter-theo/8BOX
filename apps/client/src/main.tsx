import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { SERVER_URL } from './env';
import { startConnection } from './game/connection';
import { App } from './ui/App';
import './ui/app.css';

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error('Missing #root element');
}

startConnection(SERVER_URL);

createRoot(rootElement).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
