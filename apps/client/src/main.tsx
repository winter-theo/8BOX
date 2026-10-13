import { contentSizes } from '@8box/shared';
import { ClerkProvider } from '@clerk/react';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { CLERK_PUBLISHABLE_KEY } from './env';
import { content } from './game/content';
import { initI18n } from './i18n';
import { App } from './ui/App';
import { AdminApp } from './ui/admin/AdminApp';
import { isAdminRoute } from './ui/admin/adminAuth';
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

// `/admin` is the admin tab, a normal scrolling page; anything else is the game.
const adminRoute = isAdminRoute();
if (adminRoute) {
  document.documentElement.classList.add('page-admin');
}
const page = adminRoute ? <AdminApp /> : <App />;

// Google sign-in when Clerk is set up; without a key, only the dev login exists.
createRoot(rootElement).render(
  <StrictMode>
    {CLERK_PUBLISHABLE_KEY ? (
      <ClerkProvider publishableKey={CLERK_PUBLISHABLE_KEY}>{page}</ClerkProvider>
    ) : (
      page
    )}
  </StrictMode>,
);
