import { useSessionStore } from '../store/session';
import { ConnectionBanner } from './ConnectionBanner';
import { DevInfo } from './DevInfo';
import { DevLogin } from './DevLogin';
import { LanguageSelect } from './LanguageSelect';
import { PhaserGame } from './PhaserGame';
import { RejectedScreen } from './RejectedScreen';

export function App() {
  const status = useSessionStore((state) => state.status);

  return (
    <>
      <PhaserGame />
      <ConnectionBanner />
      <DevInfo />
      {status === 'idle' && <DevLogin />}
      {status === 'rejected' && <RejectedScreen />}
      <LanguageSelect />
    </>
  );
}
