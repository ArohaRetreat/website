# Website verification

```sh
npm ci
npm ci --prefix functions
npm test
npm run build
sh scripts/check.sh
node --test functions/tests/telemetry.mjs
```

API/rules integration uses isolated Firebase emulators and synthetic identities only. Java 21 and Firebase CLI 15.34.1 are required:

```sh
node -e "require('node:fs').writeFileSync('functions/.env.local','SUPER_ADMIN_EMAILS=owner@example.test\n')"
firebase emulators:exec --project demo-aroha --only auth,firestore,functions,storage 'node --test functions/tests/integration.mjs'
```

Remove the local synthetic owner file after the emulator run, before any real deployment. The file is ignored and Functions deployment excludes `.env*`. Existing production owner configuration/Secret Manager bindings must be managed separately; they were not copied into this repository.

The import retains the meaningful website/domain/motion/gallery/monitoring tests. Additional repository-boundary tests cover complete media import, pinned dependency integrity and Hosting composition failure for missing/stale/tampered exports. Foundation tests validate template governance and service registration. These checks do not certify actual OAuth, production writes, physical devices, Safari, FPS, visual acceptance or tenant RUM linkage.
