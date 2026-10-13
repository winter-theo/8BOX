import {
  ADMIN,
  type AdminAction,
  type AdminAuditEntry,
  type AdminPlayer,
  banBodySchema,
} from '@8box/shared';
import { type FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { SERVER_URL } from '../../env';
import { AdminApi, type AdminFailure, type AuthHeader, failureOf } from '../../game/adminApi';

interface Lists {
  players: AdminPlayer[];
  audit: AdminAuditEntry[];
  updatedAt: Date;
}

/** Actions offered for a player, by status (admins get none). */
function actionsOf(player: AdminPlayer): AdminAction[] {
  if (player.role === 'admin') {
    return [];
  }
  switch (player.status) {
    case 'pending':
      return ['approve', 'deny'];
    case 'approved':
      return player.online ? ['kick', 'ban'] : ['ban'];
    case 'denied':
      return ['approve', 'ban'];
    case 'banned':
      return ['unban'];
  }
}

function useDateFormat() {
  const { i18n } = useTranslation();
  return useMemo(() => {
    const format = new Intl.DateTimeFormat(i18n.resolvedLanguage, {
      dateStyle: 'short',
      timeStyle: 'short',
    });
    return (iso: string) => format.format(new Date(iso));
  }, [i18n.resolvedLanguage]);
}

/** The ban reason form, shown in place of the actions of the player being banned. */
function BanForm({ onBan, onCancel }: { onBan: (reason: string) => void; onCancel: () => void }) {
  const { t } = useTranslation();
  const [reason, setReason] = useState('');
  const valid = banBodySchema.safeParse({ reason }).success;

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (valid) {
      onBan(reason.trim());
    }
  };

  return (
    <form className="admin-ban" onSubmit={submit}>
      <input
        aria-label={t('ui.admin.banReason')}
        placeholder={t('ui.admin.banReason')}
        value={reason}
        maxLength={ADMIN.banReasonMaxLength}
        onChange={(event) => setReason(event.target.value)}
      />
      <button type="submit" className="admin-button admin-button--danger" disabled={!valid}>
        {t('ui.admin.confirmBan')}
      </button>
      <button type="button" className="admin-button" onClick={onCancel}>
        {t('ui.admin.cancel')}
      </button>
    </form>
  );
}

/**
 * The admin tab: pending requests, players and the audit log, reloaded every 30 s and after each
 * action. It shows what the server answers, nothing more.
 */
export function AdminPage({ authHeader }: { authHeader: AuthHeader }) {
  const { t } = useTranslation();
  const formatDate = useDateFormat();
  const api = useMemo(() => new AdminApi(SERVER_URL, authHeader), [authHeader]);
  const [lists, setLists] = useState<Lists | null>(null);
  const [loadFailure, setLoadFailure] = useState<AdminFailure | null>(null);
  const [actionFailure, setActionFailure] = useState<AdminFailure | null>(null);
  const [busy, setBusy] = useState(false);
  /** The player whose ban reason is being typed. */
  const [banning, setBanning] = useState<number | null>(null);

  const refresh = useCallback(async () => {
    try {
      const [{ players }, { entries }] = await Promise.all([api.players(), api.audit()]);
      setLists({ players, audit: entries, updatedAt: new Date() });
      setLoadFailure(null);
    } catch (error) {
      setLoadFailure(failureOf(error));
    }
  }, [api]);

  useEffect(() => {
    void refresh();
    const timer = setInterval(() => void refresh(), ADMIN.refreshIntervalMs);
    return () => clearInterval(timer);
  }, [refresh]);

  const run = async (request: () => Promise<unknown>) => {
    setBusy(true);
    setActionFailure(null);
    try {
      await request();
    } catch (error) {
      setActionFailure(failureOf(error));
    }
    setBanning(null);
    await refresh();
    setBusy(false);
  };

  const act = (player: AdminPlayer, action: AdminAction) => {
    if (action === 'ban') {
      setBanning(player.id);
    } else if (action !== 'mute') {
      void run(() => api.act(player.id, action));
    }
  };

  if (loadFailure === 'forbidden' || loadFailure === 'unauthorized') {
    return <p className="admin-notice">{t(`ui.admin.error.${loadFailure}`)}</p>;
  }
  if (!lists) {
    return (
      <p className="admin-notice">
        {loadFailure ? t(`ui.admin.error.${loadFailure}`) : t('ui.admin.loading')}
      </p>
    );
  }

  const pending = lists.players.filter((player) => player.status === 'pending');
  const others = lists.players.filter((player) => player.status !== 'pending');
  const nameOf = (player: AdminPlayer) => player.name ?? t('ui.admin.noName');

  const actionCell = (player: AdminPlayer) => (
    <td data-label={t('ui.admin.column.actions')}>
      {banning === player.id ? (
        <BanForm
          onBan={(reason) => void run(() => api.ban(player.id, { reason }))}
          onCancel={() => setBanning(null)}
        />
      ) : (
        actionsOf(player).length > 0 && (
          <div className="admin-actions">
            {actionsOf(player).map((action) => (
              <button
                key={action}
                type="button"
                className={
                  action === 'approve'
                    ? 'admin-button admin-button--primary'
                    : action === 'ban' || action === 'deny'
                      ? 'admin-button admin-button--danger'
                      : 'admin-button'
                }
                disabled={busy}
                onClick={() => act(player, action)}
              >
                {t(`ui.admin.action.${action}`)}
              </button>
            ))}
          </div>
        )
      )}
    </td>
  );

  return (
    <>
      <div className="admin-toolbar">
        <small>
          {t('ui.admin.updatedAt', {
            time: lists.updatedAt.toLocaleTimeString(undefined, { timeStyle: 'short' }),
          })}
        </small>
        <button type="button" className="admin-button" disabled={busy} onClick={() => run(refresh)}>
          {t('ui.admin.refresh')}
        </button>
      </div>
      {(actionFailure ?? loadFailure) && (
        <p className="admin-error" role="alert">
          {t(`ui.admin.error.${actionFailure ?? loadFailure}`)}
        </p>
      )}

      <section className="admin-section">
        <h2>
          {t('ui.admin.pending.title')}
          {pending.length > 0 && <span className="badge">{pending.length}</span>}
        </h2>
        {pending.length === 0 ? (
          <p className="admin-empty">{t('ui.admin.pending.empty')}</p>
        ) : (
          <table className="admin-table">
            <thead>
              <tr>
                <th>{t('ui.admin.column.name')}</th>
                <th>{t('ui.admin.column.email')}</th>
                <th>{t('ui.admin.column.requestedAt')}</th>
                <th>{t('ui.admin.column.actions')}</th>
              </tr>
            </thead>
            <tbody>
              {pending.map((player) => (
                <tr key={player.id}>
                  <td data-label={t('ui.admin.column.name')}>
                    {nameOf(player)}
                    {player.online && <span className="admin-dot" title={t('ui.admin.online')} />}
                  </td>
                  <td data-label={t('ui.admin.column.email')}>{player.email ?? '—'}</td>
                  <td data-label={t('ui.admin.column.requestedAt')}>
                    {formatDate(player.createdAt)}
                  </td>
                  {actionCell(player)}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <section className="admin-section">
        <h2>{t('ui.admin.players.title')}</h2>
        {others.length === 0 ? (
          <p className="admin-empty">{t('ui.admin.players.empty')}</p>
        ) : (
          <table className="admin-table">
            <thead>
              <tr>
                <th>{t('ui.admin.column.name')}</th>
                <th>{t('ui.admin.column.status')}</th>
                <th>{t('ui.admin.column.online')}</th>
                <th>{t('ui.admin.column.lastSeen')}</th>
                <th>{t('ui.admin.column.actions')}</th>
              </tr>
            </thead>
            <tbody>
              {others.map((player) => (
                <tr key={player.id}>
                  <td data-label={t('ui.admin.column.name')}>
                    {nameOf(player)}
                    {player.role === 'admin' && (
                      <span className="admin-tag">{t('ui.admin.adminRole')}</span>
                    )}
                  </td>
                  <td data-label={t('ui.admin.column.status')}>
                    <span className={`admin-status admin-status--${player.status}`}>
                      {t(`ui.admin.status.${player.status}`)}
                    </span>
                    {player.banReason && <small className="admin-reason">{player.banReason}</small>}
                  </td>
                  <td data-label={t('ui.admin.column.online')}>
                    {player.online ? (
                      <>
                        <span className="admin-dot" /> {t('ui.admin.online')}
                      </>
                    ) : (
                      t('ui.admin.offline')
                    )}
                  </td>
                  <td data-label={t('ui.admin.column.lastSeen')}>
                    {player.lastSeenAt ? formatDate(player.lastSeenAt) : t('ui.admin.never')}
                  </td>
                  {actionCell(player)}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <section className="admin-section">
        <h2>{t('ui.admin.audit.title')}</h2>
        {lists.audit.length === 0 ? (
          <p className="admin-empty">{t('ui.admin.audit.empty')}</p>
        ) : (
          <table className="admin-table">
            <thead>
              <tr>
                <th>{t('ui.admin.column.date')}</th>
                <th>{t('ui.admin.column.admin')}</th>
                <th>{t('ui.admin.column.action')}</th>
                <th>{t('ui.admin.column.target')}</th>
                <th>{t('ui.admin.column.reason')}</th>
              </tr>
            </thead>
            <tbody>
              {lists.audit.map((entry) => (
                <tr key={entry.id}>
                  <td data-label={t('ui.admin.column.date')}>{formatDate(entry.at)}</td>
                  <td data-label={t('ui.admin.column.admin')}>
                    {entry.adminName ?? `#${entry.adminId}`}
                  </td>
                  <td data-label={t('ui.admin.column.action')}>
                    {t(`ui.admin.audited.${entry.action}`)}
                  </td>
                  <td data-label={t('ui.admin.column.target')}>
                    {entry.targetName ?? `#${entry.targetId}`}
                  </td>
                  <td data-label={t('ui.admin.column.reason')}>{entry.reason ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </>
  );
}
