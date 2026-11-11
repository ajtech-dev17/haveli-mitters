import test from 'node:test';
import assert from 'node:assert/strict';
import { sessionIdentityChanged } from '../assets/js/session-refresh.js';
const session = id => ({user:{id}});

test('restoring a saved login does not start a page-reload loop in either SDK event order', () => {
  for (const events of [['SIGNED_IN','INITIAL_SESSION'], ['INITIAL_SESSION','SIGNED_IN']]) {
    for (let pageLoad=0;pageLoad<5;pageLoad++) {
      const changed=sessionIdentityChanged();
      for (const event of events) assert.equal(changed(event, session('owner')),false);
      for (let focus=0;focus<20;focus++) assert.equal(changed('SIGNED_IN',session('owner')),false);
      assert.equal(changed('TOKEN_REFRESHED',session('owner')),false);
      assert.equal(changed('USER_UPDATED',session('owner')),false);
    }
  }
});
test('sign-in, account switches and sign-out invalidate the old viewer identity', () => {
  const changed=sessionIdentityChanged();
  assert.equal(changed('INITIAL_SESSION',null),false);
  assert.equal(changed('SIGNED_IN',session('player-a')),true);
  assert.equal(changed('SIGNED_IN',session('player-a')),false);
  assert.equal(changed('SIGNED_IN',session('player-b')),true);
  assert.equal(changed('SIGNED_OUT',null),true);
  assert.equal(changed('SIGNED_OUT',null),false);
});
test('expired-session startup and unrelated events do not trigger reloads', () => {
  const changed=sessionIdentityChanged();
  assert.equal(changed('PASSWORD_RECOVERY',session('owner')),false);
  assert.equal(changed('SIGNED_OUT',null),false);
  assert.equal(changed('INITIAL_SESSION',null),false);
  assert.equal(changed('SIGNED_IN',session('owner')),true);
});
