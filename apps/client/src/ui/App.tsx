import { CLERK_PUBLISHABLE_KEY } from '../env';
import { useSessionStore } from '../store/session';
import { ClerkAdminLink, DevAdminLink } from './admin/AdminLink';
import { AccountScreen } from './auth/AccountScreen';
import { ClerkAutoConnect, SignOutButton } from './auth/ClerkLogin';
import { LoginScreen } from './auth/LoginScreen';
import { ConnectionBanner } from './ConnectionBanner';
import { ChatPanel } from './chat/ChatPanel';
import { DevInfo } from './DevInfo';
import { LanguageSelect } from './LanguageSelect';
import { LongPressBubble } from './mobile/LongPressBubble';
import { MobileControls } from './mobile/MobileControls';
import { RotatePhone } from './mobile/RotatePhone';
import { PhaserGame } from './PhaserGame';
import { RejectedScreen } from './RejectedScreen';
import { useMediaQuery } from './useMediaQuery';
import { useTouchMode } from './useTouchMode';

export function App() {
  const status = useSessionStore((state) => state.status);
  const touch = useTouchMode();
  const portrait = useMediaQuery('(orientation: portrait)');

  return (
    <div className={touch ? 'app app--touch' : 'app'}>
      <PhaserGame />
      {touch && status === 'online' && <MobileControls />}
      {status === 'online' && <ChatPanel touch={touch} />}
      <LongPressBubble />
      <ConnectionBanner />
      <DevInfo />
      {status === 'idle' && <LoginScreen />}
      {status === 'account' && <AccountScreen />}
      {status === 'rejected' && <RejectedScreen />}
      <div className="top-right">
        {CLERK_PUBLISHABLE_KEY ? <ClerkAdminLink /> : import.meta.env.DEV && <DevAdminLink />}
        {CLERK_PUBLISHABLE_KEY && <SignOutButton />}
        <LanguageSelect />
      </div>
      {CLERK_PUBLISHABLE_KEY && <ClerkAutoConnect />}
      {touch && portrait && <RotatePhone />}
    </div>
  );
}
