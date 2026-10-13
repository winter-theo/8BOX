import type { ChatLineMessage, ChatNoticeMessage, ReportContextLine } from '@8box/shared';
import type { GameModule, ServerContext } from '../../core/module';
import { TokenBucket } from '../../net/rateLimit';
import type { Session } from '../../net/session';
import { cleanChatText, parseChatLine } from './commands';
import { createChatFilter } from './filter';

/** What the chat remembers of a player during the server run. */
interface ChatPlayer {
  /** Lines this player may still send (`CHAT.rateLimit…`). */
  limit: TokenBucket;
  /** Who `/r` answers: the last player who sent them a private line. */
  replyTo: string | undefined;
  /** The last lines this player saw, the oldest first: the context of their reports. */
  seen: ChatLineMessage[];
}

/**
 * Proximity and private chat: lines are cleaned, limited in rate and length, filtered, then sent to
 * the players nearby (same layer, within `CHAT.proximityRadiusTiles`) or to one player at any distance.
 * Muted players cannot talk. `/signaler` records a report with the last lines the reporter saw.
 */
class Chat {
  private readonly players = new Map<number, ChatPlayer>();
  private readonly filter: (text: string) => string;

  constructor(private readonly ctx: ServerContext) {
    const { filteredWords, filterMask } = ctx.config.chat;
    this.filter = createChatFilter([...filteredWords.fr, ...filteredWords.en], filterMask);
  }

  receive(session: Session, rawText: string, to: string | undefined): void {
    const playerId = session.account?.playerId;
    if (playerId === undefined || !session.player) {
      return;
    }
    const text = cleanChatText(rawText);
    if (text === '') {
      return;
    }
    if (!this.playerOf(playerId).limit.take(this.ctx.net.now())) {
      this.notify(session, { notice: 'tooFast' });
      return;
    }
    const line = to === undefined ? parseChatLine(text) : { kind: 'msg' as const, to, text };
    switch (line.kind) {
      case 'say':
        if (this.canSay(session, line.text)) {
          this.sayNearby(session, line.text);
        }
        return;
      case 'msg':
        if (this.canSay(session, line.text)) {
          this.sayTo(session, line.to, line.text);
        }
        return;
      case 'reply': {
        const replyTo = this.playerOf(playerId).replyTo;
        if (replyTo === undefined) {
          this.notify(session, { notice: 'noReplyTarget' });
        } else if (this.canSay(session, line.text)) {
          this.sayTo(session, replyTo, line.text);
        }
        return;
      }
      case 'report':
        this.report(session, playerId, line.name, line.reason);
        return;
      case 'usage':
        this.notify(session, { notice: line.notice });
        return;
      case 'unknown':
        this.notify(session, { notice: 'unknownCommand' });
        return;
    }
  }

  /**
   * Records a report against a player (in the game or not), with the last lines the reporter saw.
   * Muted players can report too. Written outside the tick; the reporter is told once it is saved.
   */
  private report(session: Session, reporterId: number, name: string, reason: string): void {
    if (name.toLowerCase() === session.name?.toLowerCase()) {
      this.notify(session, { notice: 'self' });
      return;
    }
    const context = this.playerOf(reporterId).seen.map(
      ({ ts, channel, from, to, text }): ReportContextLine => ({
        ts,
        channel,
        from,
        ...(to !== undefined && { to }),
        text,
      }),
    );
    this.ctx.reports.create({ reporterId, targetName: name, reason, context }).then(
      (created) => {
        if (!created) {
          this.notify(session, { notice: 'unknownPlayer', name });
          return;
        }
        this.ctx.log.info(
          { reporter: session.name, target: created.targetName },
          'player reported',
        );
        this.notify(session, { notice: 'reported', name: created.targetName });
      },
      (error: unknown) => {
        this.ctx.log.error({ err: error, reporter: session.name }, 'report failed');
        this.notify(session, { notice: 'reportFailed' });
      },
    );
  }

  /** Whether the player may send this message; tells them why not. */
  private canSay(session: Session, text: string): boolean {
    const mutedUntil = session.account?.mutedUntil;
    if (mutedUntil && mutedUntil.getTime() > Date.now()) {
      this.notify(session, { notice: 'muted', until: mutedUntil.getTime() });
      return false;
    }
    if (text.length > this.ctx.config.chat.maxMessageLength) {
      this.notify(session, { notice: 'tooLong' });
      return false;
    }
    return true;
  }

  /** To every player on the same layer within the proximity radius, the speaker included. */
  private sayNearby(speaker: Session, text: string): void {
    const { ctx } = this;
    const entity = speaker.player?.entity;
    const from = entity === undefined ? undefined : ctx.entities.get(entity, 'position');
    if (entity === undefined || !from || speaker.name === undefined) {
      return;
    }
    const line: ChatLineMessage = {
      t: 'chat',
      channel: 'proximity',
      from: speaker.name,
      entity,
      text: this.filter(text),
      ts: Date.now(),
    };
    const radius = ctx.config.chat.proximityRadiusTiles;
    for (const listener of this.playingSessions()) {
      const at = listener.player && ctx.entities.get(listener.player.entity, 'position');
      if (at && at.layer === from.layer && Math.hypot(at.x - from.x, at.y - from.y) <= radius) {
        this.deliver(listener, line);
      }
    }
  }

  /** To one player in the game, wherever they are; the sender gets a copy. */
  private sayTo(sender: Session, name: string, text: string): void {
    const target = this.playingSessions().find(
      (session) => session.name?.toLowerCase() === name.toLowerCase(),
    );
    if (!target?.name || target.account === undefined) {
      this.notify(sender, { notice: 'unknownPlayer', name });
      return;
    }
    if (target === sender || sender.name === undefined) {
      this.notify(sender, { notice: 'self' });
      return;
    }
    const line: ChatLineMessage = {
      t: 'chat',
      channel: 'private',
      from: sender.name,
      to: target.name,
      text: this.filter(text),
      ts: Date.now(),
    };
    this.deliver(target, line);
    this.deliver(sender, line);
    this.playerOf(target.account.playerId).replyTo = sender.name;
  }

  /** Sends a line and remembers it as seen by this player. */
  private deliver(session: Session, line: ChatLineMessage): void {
    this.ctx.net.send(session, line);
    const playerId = session.account?.playerId;
    if (playerId === undefined) {
      return;
    }
    const seen = this.playerOf(playerId).seen;
    seen.push(line);
    if (seen.length > this.ctx.config.chat.reportContextMessages) {
      seen.shift();
    }
  }

  private notify(session: Session, notice: Omit<ChatNoticeMessage, 't'>): void {
    this.ctx.net.send(session, { t: 'chatNotice', ...notice });
  }

  private playingSessions(): Session[] {
    return this.ctx.net.allSessions().filter((session) => session.state === 'playing');
  }

  private playerOf(playerId: number): ChatPlayer {
    let player = this.players.get(playerId);
    if (!player) {
      const { rateLimitMessages, rateLimitWindowMs } = this.ctx.config.chat;
      player = {
        limit: new TokenBucket(rateLimitMessages, rateLimitWindowMs, this.ctx.net.now()),
        replyTo: undefined,
        seen: [],
      };
      this.players.set(playerId, player);
    }
    return player;
  }
}

export const chatModule: GameModule = {
  id: 'chat',
  dependsOn: ['players'],
  init(ctx) {
    const chat = new Chat(ctx);
    ctx.net.onMessage('chat', (session, message) =>
      chat.receive(session, message.text, message.to),
    );
  },
};
