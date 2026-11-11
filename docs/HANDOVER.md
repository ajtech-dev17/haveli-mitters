# Client handover and future maintenance

## Three separate ownerships

| Layer                     | Owner/admin controls                                   | Developer responsibility                                        |
| ------------------------- | ------------------------------------------------------ | --------------------------------------------------------------- |
| Portal account            | Team content, player/match data, settings, invitations | No permanent hidden access                                      |
| Supabase project          | Database/Auth/Storage/SMTP and recovery access         | Schema migrations and technical troubleshooting when authorized |
| GitHub / hosting / domain | Source ownership and deployments                       | New code, new pages, bug fixes and releases                     |

**Portal ownership transfer does not transfer Supabase organization, repository, hosting or domain ownership.** Handover must cover all applicable accounts separately.

## Recommended client transfer

1. Agree the client's owner email and second team-admin email. Do not share your own login/password.
2. Before inviting the client, verify Auth confirmation/recovery redirects and SMTP delivery using the actual production domain.
3. Current portal owner opens **Team access → Invite second admin** and enters the client's exact email.
4. Copy the generated private invitation URL and send it directly to that client. The app does not automatically send that invitation. It is email-bound, single-use and expires after 48 hours.
5. Client opens the link, creates their own account/password and confirms their email, then accepts the invite while signed in with that same email.
6. Client tests login, player editing, draft/publish and password recovery.
7. Owner opens **Transfer ownership**, selects the client, leaves **Leave after handover** checked, and confirms.
8. Database atomically makes the client owner and removes the previous owner's portal admin permission. Old account sign-in alone no longer grants admin access.
9. The new owner can invite a second team member. Database permits at most two active admin memberships and one owner.

If two admin slots are already used, owner must remove the appropriate non-owner before another invitation can be accepted. The owner cannot remove themselves before a transfer. Generating a new invite for the same email invalidates the earlier invite; expired invites cannot be redeemed.

## Infrastructure handover

- Prefer client-owned Supabase, repository, hosting and domain accounts from the start.
- If initially developer-owned, follow each provider's transfer/collaborator process and verify client recovery access.
- Give the client the repository, release ZIP, setup guide, data backup, media originals and provider ownership inventory.
- Keep all actual credentials in the client's password manager, not in this source package or WhatsApp screenshots.
- Test recovery before removing developer ownership from provider accounts.
- Portal developer branding gives **no** special login or database privilege.

## Future changes: clear division

Captain/admin can update content, match scores, player photos, galleries, social/audio/video content, office/current location and existing switches without asking for code edits.

A new type of page, changed statistics formulas, new service integration, layout redesign or database structure is developer work. User-facing toggles cannot create arbitrary new application features.

Agree with the client how support works: contact person, included fixes, paid feature changes if any, realistic response time, hosting/domain costs if any, backup owner and maintenance duration. No perpetual support or zero-downtime promise is implied by this code.

## Safe release workflow

1. Capture the issue and expected behavior with the captain.
2. Export content backup and preserve current release/tag and media originals.
3. Create a Git branch; develop against a separate test Supabase project with synthetic data.
4. Run stats/schema checks and a browser check for affected workflows.
5. For schema changes, add a numbered migration with a rollback plan. Do not repeatedly modify historical deployment SQL as the production upgrade strategy.
6. Deploy a preview, get the captain's review, then merge/deploy the agreed release.
7. Verify the production change, record release notes and retain the previous static release.
8. For a static-code rollback, redeploy the previous commit. Database migrations need their own restore/rollback; reverting JavaScript does not revert data.

Developer may retain **explicitly agreed** source-repository access for support. They do not need permanent portal admin access. If content access is needed later, the owner can grant an available admin slot temporarily and remove it afterwards.

## Backup restore

Content export is useful but is not a full Supabase disaster-recovery snapshot. Preserve bucket files separately, and use provider-supported database backups/exports appropriate to the actual plan.

For the portal JSON export:

```sh
node scripts/backup-to-sql.mjs haveli-backup.json restore.sql
```

Developer must review the generated SQL, take a current backup, and test the restore against staging before running it in the Supabase SQL Editor. It runs in a transaction, merges IDs, overwrites matching records and replaces score rows for backed-up matches. Other new records remain. Jersey uniqueness conflicts abort the transaction and require a deliberate reconciliation.

v3 export includes live state, lineups and event history. Restore clears scorer leases and portable event actor references; claim scoring again after restore. It does not restore authentication, player links, invitations, admin memberships, Storage files or SMTP. A media URL in JSON is only a pointer to the original file.
