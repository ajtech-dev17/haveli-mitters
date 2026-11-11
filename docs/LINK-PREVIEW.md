# Link preview

Public HTML pages now include static Open Graph and Twitter metadata and absolute image/canonical URLs for the GitHub Pages deployment. Admin, account and player login pages are excluded.

The preview uses assets/images/team-logo.png. Admin logo uploads change website branding, not this static social preview. To change the preview image, replace that file and redeploy, or change the static og:image and twitter:image tags to a public image URL. Do not use private player pictures or private statistics in previews.

Messaging services cache previews and decide how to render them. Deployment does not update messages already sent. Check a freshly pasted link after deployment. No SQL changes are needed.
