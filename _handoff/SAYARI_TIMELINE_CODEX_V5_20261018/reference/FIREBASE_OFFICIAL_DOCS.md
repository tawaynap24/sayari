# Firebase official reference URLs for implementation validation

As checked on 18 October 2026, use official documentation at these URLs and recheck at execution time because SDK/services/plan rules can change:

1. Email/password auth (must enable provider; no forced email verification initially): https://firebase.google.com/docs/auth/web/password-auth
2. Firebase Auth web setup: https://firebase.google.com/docs/auth/web/start
3. Firestore transactions and retries/atomicity: https://firebase.google.com/docs/firestore/manage-data/transactions
4. Firestore Security Rules and note server Admin SDK bypasses rules: https://firebase.google.com/docs/firestore/security/rules-conditions
5. Storage Security Rules MIME/size validation: https://firebase.google.com/docs/storage/security
6. Storage Rules can read default Firestore doc for authorization (billable rule reads): https://firebase.google.com/docs/storage/security/rules-conditions
7. Storage web setup / possible Blaze plan for new bucket: https://firebase.google.com/docs/storage/web/start
8. Functions v2 scheduled jobs (`onSchedule`) and Cloud Scheduler billing requirements: https://firebase.google.com/docs/functions/schedule-functions
9. Firebase Hosting SPA rewrite `**` -> `/index.html`: https://firebase.google.com/docs/hosting/full-config
10. Callable functions request auth/App Check type: https://firebase.google.com/docs/reference/functions/2nd-gen/node/firebase-functions.https.callablerequest
11. Callable function App Check options: https://firebase.google.com/docs/reference/functions/2nd-gen/node/firebase-functions.https.callableoptions

Important:
- Documentation is not evidence that the Firebase project connected to Sayari has Auth/Firestore/Storage/Functions already enabled.
- Scheduled functions & Cloud Storage may require Blaze plan and active billing; do not change billing or production resources from Codex without explicit user approval.
- Test locally with Emulator; do not deploy automatically. If developer environment cannot install CLI or connect to the service, list blocked steps and local test results separately.
