# Cookie consent

The public banner offers essential cookies, analytics, and advertising. It names the services enabled for that publication:

- Topiqu article statistics are available on every publication. Views and shares require analytics consent, including on the server. Anonymous statistics use the separate HttpOnly `analytics_session` cookie for 30 days. Votes and feedback use `anon_session` only after the visitor interacts; they do not create a browser fingerprint.
- GA4 requires a non-BASIC plan, `allowGtag`, and a valid `G-…` ID. The Google tag loads manually after analytics consent, with cookies restricted to the current host. Google Signals and ad personalization are disabled. SPA history measurement depends on Enhanced Measurement in the GA4 property.
- BASIC uses platform AdSense. Other plans use the publication's Google Ad Manager network if configured. Both providers load only after advertising consent and explicitly request non-personalized ads. Non-personalized ads can still require cookies and consent.

Consent version 3 records the publication ID, GA4 ID, and advertising provider/network. Adding or changing a service requires a fresh choice; stale and older decisions do not activate optional services. The decision cookie lasts 180 days. Existing version 2 choices will be requested again after deployment.

Withdrawing analytics consent disables GA4, deletes accessible first-party GA cookies, clears optional view storage, and calls `DELETE /api/consent/analytics` to remove the HttpOnly statistics cookie. Withdrawing advertising consent reloads the page to stop already-loaded advertising runtimes. Cookie settings are available in the footer and the existing settings launcher.

Personalized ads are deliberately unavailable in this integration. Enabling them requires an actual Google-certified CMP/TCF integration and corresponding consent controls; setting `ad_personalization` to granted in this banner is insufficient. Google account-side settings and delivered ad inventory must also be verified when enabling advertising on a production domain.

References: [GA4 cookie configuration](https://developers.google.com/analytics/devguides/collection/ga4/reference/config), [GA4 SPA measurement](https://developers.google.com/analytics/devguides/collection/ga4/single-page-applications), [AdSense NPA settings](https://support.google.com/adsense/answer/9042142?hl=en), [GPT privacy settings](https://developers.google.com/publisher-tag/samples/configure-privacy), [Google CMP requirements](https://support.google.com/adsense/answer/13554116?hl=en).
