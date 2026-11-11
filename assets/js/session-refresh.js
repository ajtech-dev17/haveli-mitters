// Session restoration and tab focus can emit SIGNED_IN for an existing user.
// Refresh private/public data only when the actual account identity changes.
export function sessionIdentityChanged() {
  let initialized = false;
  let previous = null;
  return (event, session) => {
    if (!['INITIAL_SESSION', 'SIGNED_IN', 'SIGNED_OUT', 'TOKEN_REFRESHED', 'USER_UPDATED'].includes(event)) return false;
    const current = event === 'SIGNED_OUT' ? null : session?.user?.id ?? null;
    if (!initialized) {
      initialized = true;
      previous = current;
      return false;
    }
    const changed = current !== previous;
    previous = current;
    return changed;
  };
}
