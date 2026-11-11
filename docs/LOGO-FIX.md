# Published logo first-paint fix — 12 November 2026

The 12 HTML entry points used a fixed bundled image for the initial loader and favicon. That image could appear before Supabase settings returned the uploaded logo.

Loading now uses a neutral gold ring and neutral favicon until settings resolve. The published logo then supplies the rendered branding and favicon. Admin Publish updates visible header/sidebar/auth/hero logos and the favicon through the shared branding synchronizer. Drafts do not publish branding. On the first settings-fetch failure, the app does not substitute the old bundled image; it displays its existing connection error state. A failed later poll preserves the last successfully loaded branding.

Apply this update by merging the ZIP contents into the existing Git repository and committing the changed HTML, assets, tests and documentation. Preserve your existing .git directory. No SQL or account reset is required. After GitHub Actions deployment, hard-refresh once so old HTML is replaced.

Tests verify all 12 HTML entry points contain no old logo image/icon URL, dynamic favicon and displayed logo updates, and existing session reload-loop regression behavior. A slow first visit intentionally shows the neutral loading indicator, because the latest published logo cannot be known before the settings response arrives. Browser-owned tab/history icon caching can still require a refresh of an already-open tab.
