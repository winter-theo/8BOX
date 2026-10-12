import { createClerkClient, verifyToken } from '@clerk/backend';
import type { ClerkIdentity } from './Accounts';

export interface ClerkOptions {
  secretKey: string;
  /** PEM public key: verifies tokens without a network call (optional). */
  jwtKey?: string | undefined;
  /** Origins allowed to have issued the token (the game client). */
  authorizedParties: readonly string[];
}

/** Session tokens checked by Clerk; emails read from the Clerk API. */
export function clerkIdentity({
  secretKey,
  jwtKey,
  authorizedParties,
}: ClerkOptions): ClerkIdentity {
  const client = createClerkClient({ secretKey });
  return {
    async verify(token) {
      try {
        const payload = await verifyToken(token, {
          secretKey,
          authorizedParties: [...authorizedParties],
          ...(jwtKey !== undefined && { jwtKey }),
        });
        return payload.sub;
      } catch {
        return undefined; // Invalid, expired, or issued for another site.
      }
    },
    async email(userId) {
      const user = await client.users.getUser(userId);
      const primary = user.emailAddresses.find((email) => email.id === user.primaryEmailAddressId);
      return (primary ?? user.emailAddresses[0])?.emailAddress;
    },
  };
}
