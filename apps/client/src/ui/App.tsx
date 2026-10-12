import { ConnectionBanner } from './ConnectionBanner';
import { LanguageSelect } from './LanguageSelect';
import { PhaserGame } from './PhaserGame';

export function App() {
  return (
    <>
      <PhaserGame />
      <ConnectionBanner />
      <LanguageSelect />
    </>
  );
}
