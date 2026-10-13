import { CLERK_PUBLISHABLE_KEY } from '../env';
import { useSessionStore } from '../store/session';
import { ActionMenu } from './actions/ActionMenu';
import { ActionFeedbackLine, ActionProgress } from './actions/ActionStatus';
import { ClerkAdminLink, DevAdminLink } from './admin/AdminLink';
import { AccountScreen } from './auth/AccountScreen';
import { ClerkAutoConnect, SignOutButton } from './auth/ClerkLogin';
import { LoginScreen } from './auth/LoginScreen';
import { ConnectionBanner } from './ConnectionBanner';
import { ChatPanel } from './chat/ChatPanel';
import { CraftingWindow } from './crafting/CraftingWindow';
import { DevInfo } from './DevInfo';
import { DragGhost } from './inventory/DragGhost';
import { Hotbar } from './inventory/Hotbar';
import { InventoryWindow } from './inventory/InventoryWindow';
import { LanguageSelect } from './LanguageSelect';
import { MobileControls } from './mobile/MobileControls';
import { RotatePhone } from './mobile/RotatePhone';
import { PhaserGame } from './PhaserGame';
import { RejectedScreen } from './RejectedScreen';
import { SkinSelect } from './SkinSelect';
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
      {status === 'online' && <Hotbar touch={touch} />}
      {status === 'online' && <InventoryWindow touch={touch} />}
      {status === 'online' && <CraftingWindow touch={touch} />}
      {status === 'online' && <ChatPanel touch={touch} />}
      {status === 'online' && <ActionProgress />}
      {status === 'online' && <ActionFeedbackLine />}
      {status === 'online' && <ActionMenu touch={touch} />}
      <ConnectionBanner />
      <DevInfo />
      {status === 'idle' && <LoginScreen />}
      {status === 'account' && <AccountScreen />}
      {status === 'rejected' && <RejectedScreen />}
      <div className="top-right">
        {CLERK_PUBLISHABLE_KEY ? <ClerkAdminLink /> : import.meta.env.DEV && <DevAdminLink />}
        {CLERK_PUBLISHABLE_KEY && <SignOutButton />}
        {status === 'online' && <SkinSelect />}
        <LanguageSelect />
      </div>
      {CLERK_PUBLISHABLE_KEY && <ClerkAutoConnect />}
      <DragGhost />
      {touch && portrait && <RotatePhone />}
    </div>
  );
}
