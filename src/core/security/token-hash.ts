import { createHash } from 'node:crypto'

// Refresh tokens are high-entropy (unguessable), so a fast hash is enough — no need for
// bcrypt's deliberate slowness, which exists to slow down guessing low-entropy passwords.
export const hashToken = (token: string): string => createHash('sha256').update(token).digest('hex')
