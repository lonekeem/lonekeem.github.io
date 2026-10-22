// Runs once after `firebase deploy --only functions` (the default codebase).
// The functions emulator does not run this. A failure exits 1 so the deploy is noticed.
const admin = require('firebase-admin');

if (process.env.FUNCTIONS_EMULATOR === 'true' || process.env.FIREBASE_AUTH_EMULATOR_HOST) {
  console.log('Skipping member recount inside the emulator.');
  process.exit(0);
}

admin.initializeApp({
  projectId: process.env.GCLOUD_PROJECT || process.env.GOOGLE_CLOUD_PROJECT || 'lone-keem-studios'
});

const { runRecount } = require('./member-stats');
runRecount({ source: 'deploy' }).then((res) => {
  console.log('Member recount', res.total, 'accounts,', res.active, 'active,', res.left, 'left');
  process.exit(0);
}).catch((e) => {
  console.error('Member recount failed', e);
  process.exit(1);
});
