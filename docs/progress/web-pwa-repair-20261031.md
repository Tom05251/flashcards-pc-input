# Web/PWA repair — local acceptance in progress

Branch: `codex/android-v14-roundtrip-20261030`. Baseline: `e4587584474eb4a98578815a50aadc6c4f3d2e67`.

The completed Android S4/T12 and signed versionCode14 AAB are retained. This change repairs the PC input PWA; it does not add Android study, billing, advertising, or TTS features.

- All 39 locales have 228 independently reviewed, explicit translations, including full help and 15 tutorial steps. The current UI consumes 201 keys; the install manifest adds one distinct description key. English fallback, malformed variables, argument number/type mismatches, and translation debris are zero in the reviewed effective catalog. Meaning review and structural verification are complete; the 39-language browser matrix remains a separate acceptance gate.
- Templates contain no personal entries. Clearly labelled CSV/JSON exports retain actual-data export. CSV text remains literal; spreadsheet formula interpretation is explained.
- Open parses into memory and shows a cancellable Merge/Replace preview. Existing IndexedDB records, media, IDs, and preferences are unchanged before confirmation. Workspace, media and revision commit in one transaction. Revision comparison and a final preview precondition reject stale plans, including changes during an IndexedDB wait.
- One save queue preserves order; only the latest successful commit can show saved. Dirty editor text, pending changes, failure and cross-tab conflicts are explicit. Committed changes notify other tabs, even when a later save fails. UI preference failures cannot crash the protected workspace loader.
- Updates require a safe reload and preserve dirty tabs when another tab activates an update. All 39 install manifests share the existing app identity and are precached. Functional wrapping, scrolling, media controls and RTL resizing are repaired without an aesthetic redesign.

`npm run verify` passed on the current candidate. Real browser evidence covers preview/cancel invariance, atomic quota rollback, stale-tab rejection, changes after confirmation while the transaction waits, retry/reload, storage denial, correct unload warnings, RTL resize, commit notification failures, and omitted folder-extension retention. The earlier valid security/codec evidence is retained and linked by dependency hashes.

Evidence is preserved at:
`C:\Users\minor\AndroidStudioProjects\FlashcardsAndroidStarter\.gradle-session\web-pwa-39-20261031T141213Z`.
Per-key source/existing/proposed hashes and decisions are in `en-meaning-baseline-v1.json`, `ja/ja-v1.json`, and `locales/*.json`; structural usage is in `structure-final.json`. Browser acceptance, real offline/update/install checks and signed-v14 round-trip results are recorded separately. These gates are still running; this checkpoint is not publication acceptance.

Ordinary commits/pushes to this work branch are authorized. Main/gh-pages merges, force push, public deployment and Play upload remain prohibited until explicit owner approval.
