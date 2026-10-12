import { baseContent, loadContent } from '@8box/shared';

/** Game content, validated at startup with the same loader as the server. */
export const content = loadContent(baseContent);
