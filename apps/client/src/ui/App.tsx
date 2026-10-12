import { useSessionStore } from '../store/session';
import { ConnectionBanner } from './ConnectionBanner';
import { DevInfo } from './DevInfo';
import { DevLogin } from './DevLogin';
import { LanguageSelect } from './LanguageSelect';
import { MobileControls } from './mobile/MobileControls';
import { PhaserGame } from './PhaserGame';
import { RejectedScreen } from './RejectedScreen';
import { useTouchMode } from './useTouchMode';

export function App() {
  const status = useSessionStore((state) => state.status);
  const touch = useTouchMode();

  return (
    <div className={touch ? 'app app--touch' : 'app'}>
      <PhaserGame />
      {touch && status === 'online' && <MobileControls />}
      <ConnectionBanner />
      <DevInfo />
      {status === 'idle' && <DevLogin />}
      {status === 'rejected' && <RejectedScreen />}
      <LanguageSelect />
    </div>
  );
}
