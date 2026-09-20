export const AUTH_MESSAGES = {
  SIGN_IN: 'Signed in successfully',
  SIGN_OUT: 'Signed out successfully',
  REFRESH: 'Refreshed successfully',
  ME: 'Fetched user successfully',
  CHANGE_PASSWORD: 'Password changed successfully',
  FORGOT_PASSWORD: 'Password reset link sent successfully',
  RESET_PASSWORD: 'Password reset successfully',
  REVOKE_SESSION: 'Session revoked successfully',
  REVOKE_OTHER_SESSIONS: 'Other sessions revoked successfully',
}

export const AUTH_ERRORS = {
  INVALID_CREDENTIALS: 'Invalid email or password',
  INVALID_CURRENT_PASSWORD: 'Current password is incorrect',
  ACCOUNT_DISABLED: 'This account has been disabled',
  NEW_PASSWORD_SAME_AS_CURRENT: 'New password is the same as the current one',
  PASSWORD_DO_NOT_MATCH: 'Passwords do not match',
  RESET_TOKEN_EXPIRED: 'Password reset token has expired',
  SESSION_NOT_FOUND: 'Session not found',
}
