// Run only in an administrator's terminal, never in the browser app.
// Requires firebase-admin and an authorised Google Cloud Shell session.
const { initializeApp, applicationDefault } = require('firebase-admin/app');
const { getAuth } = require('firebase-admin/auth');
const { getFirestore } = require('firebase-admin/firestore');
const readline = require('node:readline');
const { Writable } = require('node:stream');

const projectId = process.argv.find(arg => arg.startsWith('--project='))?.slice(10);
const apply = process.argv.includes('--apply');
if (!projectId) throw new Error('Supply --project=YOUR_FIREBASE_PROJECT_ID. Add --apply to provision passwords.');
if (process.env.FIREBASE_AUTH_EMULATOR_HOST || process.env.FIRESTORE_EMULATOR_HOST) throw new Error('Remove emulator environment settings before provisioning real accounts.');

initializeApp({ projectId, credential: applicationDefault() });
const auth = getAuth();
const db = getFirestore();
const normalise = value => String(value || '').trim().toLowerCase();
const problem = code => Object.assign(new Error('Student account setup needs administrator review.'), { code });

function prompt(label, hidden = false) {
  if (!process.stdin.isTTY) throw new Error('Run interactively so the password is not placed in a command, file or log.');
  let muted = false;
  const output = new Writable({ write(chunk, encoding, callback) {
    if (!muted) process.stdout.write(chunk, encoding);
    callback();
  } });
  const terminal = readline.createInterface({ input: process.stdin, output, terminal: true });
  return new Promise(resolve => {
    terminal.question(label, answer => {
      muted = false;
      terminal.close();
      if (hidden) process.stdout.write('\n');
      resolve(answer);
    });
    muted = hidden;
  });
}

async function main() {
  const [profiles, approvals] = await Promise.all([
    db.collection('students').get(), db.collection('teachers').get(),
  ]);
  // Exclude every teacher approval, including disabled approvals.
  const teacherEmails = new Set(approvals.docs.map(doc => normalise(doc.id)));
  const candidates = [];
  const counts = { inactive: 0, teachers: 0, conflicts: 0, existing: 0, new: 0, provisioned: 0, failed: 0 };
  for (const document of profiles.docs) {
    const profile = document.data();
    const email = normalise(profile.email);
    if (profile.active === false || profile.deleting) { counts.inactive++; continue; }
    if (teacherEmails.has(email)) { counts.teachers++; continue; }
    const enrolment = await db.collection('enrolments').doc(email).get();
    if (!enrolment.exists || !enrolment.data().active || enrolment.data().studentId !== document.id) { counts.conflicts++; continue; }
    let user;
    try { user = await auth.getUserByEmail(email); }
    catch (error) { if (error.code !== 'auth/user-not-found') throw error; }
    if (user?.disabled || (profile.ownerUid && profile.ownerUid !== user?.uid)) { counts.conflicts++; continue; }
    candidates.push({ reference: document.ref, email, user });
    counts[user ? 'existing' : 'new']++;
  }
  console.log(`Project: ${projectId}`);
  console.log(`Eligible students: ${candidates.length} (${counts.existing} existing Auth accounts, ${counts.new} new Auth accounts).`);
  console.log(`Skipped: ${counts.inactive} inactive/deleting, ${counts.teachers} teacher accounts, ${counts.conflicts} account/enrolment conflicts.`);
  if (!apply || !candidates.length) {
    console.log(apply ? 'No eligible accounts to change.' : 'Preview only. No records changed. Run with --apply to continue.');
    return;
  }
  console.log('This sets the same app password on all eligible student accounts. Google account passwords are unchanged.');
  console.log('Existing Auth identities, class memberships, game records and medals are preserved.');
  let password = await prompt('Student app password (hidden): ', true);
  let confirmation = await prompt('Enter it again (hidden): ', true);
  if (password.length < 6 || password !== confirmation) throw new Error('Passwords must match and contain at least six characters. Nothing changed.');
  confirmation = '';
  if (await prompt(`Type SET to provision ${candidates.length} student accounts: `) !== 'SET') {
    password = '';
    console.log('Cancelled. Nothing changed.');
    return;
  }
  for (const [index, candidate] of candidates.entries()) {
    try {
      let user = candidate.user;
      if (!user) {
        try { user = await auth.createUser({ email: candidate.email, password }); }
        catch (error) {
          if (error.code !== 'auth/email-already-exists') throw error;
          user = await auth.getUserByEmail(candidate.email);
        }
      }
      if (user.disabled || normalise(user.email) !== candidate.email) throw problem('setup/auth-conflict');
      // Recheck live records and bind only an unclaimed profile. Never replace an existing UID.
      await db.runTransaction(async transaction => {
        const [profile, enrolment, teacher] = await Promise.all([
          transaction.get(candidate.reference),
          transaction.get(db.collection('enrolments').doc(candidate.email)),
          transaction.get(db.collection('teachers').doc(candidate.email)),
        ]);
        if (teacher.exists) throw problem('setup/teacher-account');
        if (!profile.exists || normalise(profile.data().email) !== candidate.email
          || profile.data().active === false || profile.data().deleting
          || !enrolment.exists || !enrolment.data().active || enrolment.data().studentId !== candidate.reference.id
          || (profile.data().ownerUid && profile.data().ownerUid !== user.uid)) throw problem('setup/profile-conflict');
        if (!profile.data().ownerUid) transaction.update(candidate.reference, { ownerUid: user.uid });
      });
      await auth.updateUser(user.uid, { password });
      const current = await auth.getUser(user.uid);
      await auth.setCustomUserClaims(user.uid, { ...current.customClaims, studentPasswordLogin: true });
      counts.provisioned++;
      console.log(`Student ${index + 1}/${candidates.length}: provisioned.`);
    } catch (error) {
      counts.failed++;
      // Do not print names, emails, passwords, tokens or SDK request details.
      const code = /^[a-z-]+\/[a-z-]+$/.test(error.code || '') ? error.code : 'setup/failed';
      console.log(`Student ${index + 1}/${candidates.length}: ${code}. Rerun after reviewing this account in Firebase.`);
    }
  }
  password = '';
  console.log(`Finished: ${counts.provisioned} provisioned, ${counts.failed} failed. No game records or medals changed.`);
  if (counts.failed || counts.conflicts) process.exitCode = 1;
}

main().catch(error => {
  // Firebase errors can include private request details: print only a bounded error code.
  const code = /^[a-z-]+\/[a-z-]+$/.test(error.code || '') ? error.code : 'setup/failed';
  console.error(`Setup stopped (${code}). Check the project, administrator access and password requirements, then rerun.`);
  process.exitCode = 1;
});
