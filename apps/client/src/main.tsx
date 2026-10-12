import { contentSizes } from '@8box/shared';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { content } from './game/content';
import { initI18n } from './i18n';
import { App } from './ui/App';
import './ui/app.css';

initI18n();

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error('Missing #root element');
}

// iOS Safari zooms the page on a pinch despite `touch-action`: the pinch belongs to the game camera.
document.addEventListener('gesturestart', (event) => event.preventDefault());

if (import.meta.env.DEV) {
  console.info('[8box] content loaded', contentSizes(content));
}

createRoot(rootElement).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
