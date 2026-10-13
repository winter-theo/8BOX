import { SECOND_MS } from './units';

export const CHAT = {
  /** Proximity chat reaches players within this distance, in tiles. */
  proximityRadiusTiles: 16,
  /** Longest chat message, in characters. */
  maxMessageLength: 200,
  /** Longest line typed in the chat box, a command and a name included, in characters. */
  maxLineLength: 240,
  /** Max messages a player can send per window, in messages. */
  rateLimitMessages: 5,
  /** Length of the rate limit window, in ms. */
  rateLimitWindowMs: 10 * SECOND_MS,
  /** Messages kept per player as the context of their reports (the last ones they saw), in messages. */
  reportContextMessages: 20,
  /** Time a speech bubble stays above a head, in ms. */
  bubbleDurationMs: 5 * SECOND_MS,
  /** Longest text in a bubble; a longer message is cut and ends with "…", in characters. */
  bubbleMaxLength: 60,
  /** Lines kept in the chat panel, the oldest dropped first, in lines. */
  historySize: 100,
  /** Shortest mute an admin can give, in minutes. */
  muteMinMinutes: 1,
  /** Longest mute an admin can give (30 days), in minutes. */
  muteMaxMinutes: 30 * 24 * 60,
  /** Mute durations offered by the admin tab, in minutes. */
  mutePresetsMinutes: [5, 15, 60, 24 * 60],
  /** What replaces each filtered word. */
  filterMask: '***',
  /**
   * Words hidden in the chat (insults, slurs), in French and in English. Compared without case or
   * accents, digits read as letters ("c0n" is "con"), a letter repeated at will ("fuuuck" is "fuck").
   * A word matches as a whole, plural "s" or "x" included; one ending with "*" also matches the longer
   * words it starts ("fuck*": "fucking"). Hyphenated words count as one ("pique-nique" is not "nique").
   */
  filteredWords: {
    fr: [
      'con',
      'conne',
      'connard*',
      'connasse*',
      'salope',
      'salaud',
      'salopard*',
      'pute',
      'fils-de-pute',
      'putain*',
      'encule*',
      'enfoire*',
      'batard*',
      'bouffon*',
      'abruti*',
      'cretin*',
      'debile*',
      'merde*',
      'chier',
      'nique*',
      'ntm',
      'fdp',
      'tg',
      'pd',
      'pede',
      'tapette*',
      'negre*',
      'bougnoul*',
      'youpin*',
      'gouine*',
      'trisomique*',
      'mongol',
      'mongole',
    ],
    en: [
      'fuck*',
      'fck',
      'motherfuck*',
      'shit*',
      'bitch*',
      'bastard*',
      'asshole*',
      'dick',
      'cock',
      'cunt*',
      'pussy',
      'whore*',
      'slut*',
      'retarded',
      'nigger*',
      'nigga*',
      'fag',
      'faggot*',
      'kys',
    ],
  },
} as const;
