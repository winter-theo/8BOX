import { PROTOCOL_VERSION } from '@8box/shared';
import { useConnectionStore } from '../store/connection';

// Temporary labels: step 01 replaces them with i18n keys.
const LABELS = { online: 'Connecté', offline: 'Hors ligne' } as const;

export function ConnectionBanner() {
  const status = useConnectionStore((state) => state.status);

  return (
    <output className={`connection-banner connection-banner--${status}`}>
      <span className="connection-banner__dot" aria-hidden="true" />
      {LABELS[status]}
      <small>protocole {PROTOCOL_VERSION}</small>
    </output>
  );
}
