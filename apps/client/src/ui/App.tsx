import { useSessionStore } from '../store/session';
import { ConnectionBanner } from './ConnectionBanner';
import { DevInfo } from './DevInfo';
import { DevLogin } from './DevLogin';
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
      <LongPressBubble />
      <ConnectionBanner />
      <DevInfo />
      {status === 'idle' && <DevLogin />}
      {status === 'rejected' && <RejectedScreen />}
      <LanguageSelect />
      {touch && portrait && <RotatePhone />}
    </div>
  );
}
