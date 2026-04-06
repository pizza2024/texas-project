/**
 * Shared JWT configuration helpers.
 * Validates that required environment variables are set.
 */

export function getJwtSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error(
      'FATAL: JWT_SECRET environment variable is not set. ' +
        'Set it in your .env file or environment configuration.',
    );
  }
  if (secret.length < 32) {
    throw new Error(
      `FATAL: JWT_SECRET is too short (${secret.length} chars). ` +
        'Minimum 32 characters required for security.',
    );
  }
  return secret;
}

export function getHdWalletMnemonic(): string {
  const mnemonic = process.env.HD_WALLET_MNEMONIC;
  if (!mnemonic) {
    throw new Error(
      'FATAL: HD_WALLET_MNEMONIC environment variable is not set. ' +
        'Cannot initialize wallet service without a mnemonic phrase.',
    );
  }
  return mnemonic;
}

export function getAllowedOrigins(): string | string[] | false {
  const env = process.env.WS_ALLOWED_ORIGINS;
  if (!env) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error(
        'FATAL: WS_ALLOWED_ORIGINS environment variable is not set. ' +
          'Production environments must explicitly configure allowed CORS origins.',
      );
    }
    // Development: allow all
    return '*';
  }
  return env.split(',').map((o) => o.trim());
}
