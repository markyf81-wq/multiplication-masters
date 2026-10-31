# Multiplication Masters

A quick times-table memory game for ages 8–12. Plain HTML, CSS and JavaScript: no framework, package installation or build step. Designed for a short classroom session, and available for unlimited practice at home.

## For teachers: getting started

This game helps students memorise multiplication facts through short flashcard sessions and immediate practice of facts they missed. It is designed to fit into a few minutes of morning practice. Students can also use it at home as often as they like.

- **Start a game:** choose one times table and select **Start game**. A five-second countdown gives the student time to get ready. Students type answers and press Enter.
- **Use the teacher desk:** sign in with an approved teacher Google account. Open **Teacher desk** to add classes and students, search for a nickname, or filter by class. All approved teachers can view students across all classes.
- **Add students manually:** create a class, then enter a nickname, class and the student's school Google email. The email identifies the account the student must use to sign in.
- **Import a Google Classroom class:** choose **Import from Google Classroom**, connect the teacher's school Google account, choose an active class, review its student Google emails and nicknames, and confirm the import. Untick students you do not want to include. Use an existing app class name to add to it, or a new name to create a class.
- **Open a student’s results:** select **View progress** beside the student. View scores, first-try accuracy, response times, medals and individual game details. Open a game-history row to see each multiplication fact and its retry count.
- **Use a shared classroom device:** a teacher can choose **Open game** beside a teacher-created student profile. Check the nickname at the top before the student starts.
- **Play at home:** once enrolled in an app class, students sign in with the matching school Google account. The **My progress** and **My medals** pages show the same account's history and achievements at school and at home.
- **Read this guide again:** open **Teacher desk → Teacher guide · setup & technology**. The in-app guide uses this same README file, so the two copies stay in sync after a site update.

There is no daily play limit. The game rewards practice and confidence, without public leaderboards or comparisons between students.

## Accounts and student records

The storage message beneath the app header tells you which mode is in use.

- **Saved on this device:** nickname/class profiles and results are saved only in the current browser. They will not appear on another device. This mode is available before cloud setup is finished.
- **Cloud account:** a teacher first enrols the student's school Google email, manually or through Classroom import. The student then signs in through Google and is linked to that existing profile. Students cannot register themselves into a class. Google handles the sign-in; the game does not ask for or store a Google password.
- **Approved teacher:** a project administrator must grant teacher access. A student cannot make themselves a teacher by changing their nickname or class. Teachers can view all classes; a Google student account can read only its own records.

For a completed game, the app records the chosen table, start and finish times, answers, first-round correctness, timeouts, response times, retry attempts, points, and any medal-quiz outcome. A student profile holds a nickname, school Google email, class memberships, account identifier, summary totals and earned medals. Email addresses are used for enrolment matching and shown to approved teachers; they are not copied into each game-result document. The app does not read a student's Gmail inbox or Google Drive files.

Manual setup and Classroom imports use the same enrolment records. Matching the same Google email adds class membership to the existing student without replacing their nickname, games or medals. A student can belong to more than one class and keep one progress history. Teachers can repeat an import to add students who joined later; an import does not automatically remove absent students. No invitations are emailed. Nickname/class selection without Google remains local to a browser, rather than a way to open cloud records on any device.

Results are saved when a game is completed. Leaving an unfinished game does not add a completed result. If a cloud save fails, the app keeps a pending copy on that device and shows an upload message. Keep the browser's saved data until that upload has finished. Signing out ends the current session; it does not delete the device's stored practice history.

## Technology used

- **HTML:** defines the screens, forms and accessible controls.
- **CSS:** controls the responsive layout, colours, card flips, card-pile movement and countdown animation. The game follows the device’s reduced-motion preference.
- **JavaScript:** shuffles cards, checks answers, runs timers, calculates points and builds reports. It runs directly in the browser without a framework or a build step.
- **Browser local storage:** keeps device-only profiles, practice history and pending cloud saves. It is a browser feature, not a shared database.
- **Firebase Authentication:** provides Google account sign-in. It is separate from the project's teacher-approval list.
- **Cloud Firestore:** stores shared profiles, class names and completed games. Database security rules enforce access to these records.
- **Google Classroom API:** optionally reads the teacher's active class list and student rosters for a reviewed import. Extra Classroom permissions are requested only when the teacher selects import, not during ordinary student sign-in.
- **GitHub:** stores the application’s source code. Student records and private credentials do not belong in the repository.
- **GitHub Pages:** is the intended website host for the HTML, CSS and JavaScript. It does not hold the shared student database.

The intended setup uses Firebase's **free Spark plan**, without a credit card or linked billing account, and GitHub Pages from a public source repository. Free usage quotas apply. The technical setup sections below are for the person managing the project; teachers do not need to edit code to run a game or view reports.

## Troubleshooting for teachers

- **Google sign-in is unavailable:** cloud setup may not be finished. Use device-only practice for now, or ask the project administrator to check the Firebase connection.
- **A school Google account cannot sign in:** the school’s Google administrator may need to allow the application. The project administrator can also check the website’s authorised domain in Firebase.
- **Teacher desk is missing:** make sure the correct Google account is selected and ask the project administrator to approve it as a teacher. Sign out and back in after approval.
- **Results are missing at home:** check that the same Google account was used. Device-only nickname/class results stay in the original browser.
- **A save is pending:** reconnect to the internet and select **Retry cloud save** on the results screen, or sign back in later on the same browser.
- **A student does not appear in a search:** the roster loads 100 students at a time. Select **Load more students** to extend the search.
- **A student is told their account has not been added:** check the Google email on the teacher roster. Add that email manually or import the student's Classroom class, then have them try signing in again. A nickname match alone does not grant cloud access.
- **Classroom import is unavailable:** the project administrator needs to enable the Classroom API and configure the requested permissions. The school may also need to allow the application. Manual enrolment is available independently of Classroom access.

Project administrators can find the exact Firebase setup, permissions, hosting instructions and current verification status below. No real student details, account-owner contact information or private access credentials should be added to this public guide.

## Play locally

Serve this folder over HTTP with any static server. For example, if Python 3 is already available:

```sh
python3 -m http.server 8080 --bind 127.0.0.1
```

Open `http://localhost:8080`. JavaScript modules need HTTP; opening `index.html` directly as a file is not supported.

Without Firebase configuration, games, nickname/class profiles and reports are stored in this browser's local storage. The interface explicitly labels this mode. Storage is not shared across devices, browsers, private browsing sessions or different site addresses. Clearing browser storage removes these local records. No sample students or fabricated results are seeded.

## Game rules

1. Choose a table from 1–12 and click **Start game**. A **5–4–3–2–1 countdown** runs before the first card's timer begins.
2. The flashcard round contains each multiplier from 1–12 exactly once, shuffled. Each card has five seconds. Enter submits instantly; a wrong answer or timeout goes to **Not yet**. A first-round correct answer earns **5 points**.
3. If any cards were missed, revisit them without a timer. Type the displayed equation and answer, such as `6 x 4 = 24`. Spaces, case and either `x` or `×` are accepted. A wrong attempt flips the card to reveal the correct equation for one full second after the flip, then flips back. Retry until correct. The first retry earns **3 points**, the second **2**, the third or later **1**. Attempts count separately for each card. No medal quiz follows a retry round.
4. A perfect 12/12 first round unlocks a separate **Start medal quiz** button. The quiz contains 20 shuffled multiplication equations from the selected table (all 12 facts plus eight random repeats). It has a **single 60-second countdown bar**. Questions appear one at a time; Enter submits instantly. One wrong answer is allowed. A second wrong answer ends the quiz immediately. Finish all 20 within the minute with **19 or 20 correct** to earn the table's medal. Running out of time before finishing fails the quiz, even with 19 answers correct so far.
5. Collect all 12 medals to earn the trophy. Previously earned medals are retained after later unsuccessful games. Quiz answers do not add points; the game score is out of 60.

Games can be played as often as desired. There is no daily limit, daily recommendation, streak or long-session requirement. An unfinished game is discarded if the player leaves; completed games retain their original results, response times, timeouts, retry attempts and quiz outcome. First-round speed averages include five-second timeouts. Reports show recent scores, accuracy by table and individual card results.

Animation respects the device's reduced-motion setting. Game and quiz deadlines continue while the browser tab is in the background; there is no pause advantage.

## Connect Firebase on the free Spark plan

Use **Cloud Firestore Standard edition** and **Firebase Authentication**. This app does not use Cloud Functions, Cloud Storage, phone authentication, Analytics or any paid-only service. Stay on **Spark** and do not link a billing account or upgrade to Blaze. The published free quotas still apply; requests can be restricted at the quota limit.

1. Create a project in the [Firebase console](https://console.firebase.google.com/) on Spark. Google Analytics is unnecessary and can be disabled during creation.
2. Register a **Web app**. Copy its web configuration into `config.js`. The web API key and app/project identifiers are public configuration. Never put service-account files, admin SDK credentials, OAuth client secrets or private keys into this repository.
3. In **Authentication → Sign-in method**, enable **Google**. Complete the required support email settings in the console, without adding those details to source files.
4. Add your deployed website's hostname to **Authentication → Settings → Authorised domains**. Add `localhost` for local development if needed. School administrators may need to allow the application for managed education Google accounts.
5. Create a **Cloud Firestore Standard edition** database. Choose a suitable location before creating it. Start in production mode, replace its rules with the contents of `firestore.rules`, and publish them. No composite indexes are needed by the current queries.
6. Attempt Google sign-in through the game with the account that should be a teacher. It will not yet have app access, but its Google sign-in creates a Firebase Authentication entry. Find that account's UID in Firebase Authentication's user list. A teacher account does not need a student profile.
7. In Firestore, manually create a document in the `teachers` collection whose **document ID is that UID**. Add an `enabled` boolean field with value `true`. Sign out and back in to load teacher access. Repeat for each approved teacher. Students cannot grant themselves teacher privileges through the app.

Managed education accounts may be asked to select a parent organisation or folder when creating the project. If no parent is available, ask the school's Google Cloud administrator to check which organisation or folder the project should use and whether the account has project-creation permission there. Project creation requires the `resourcemanager.projects.create` permission, commonly provided by the Project Creator role. See [Google Cloud project creation](https://docs.cloud.google.com/resource-manager/docs/creating-managing-projects). Do not switch the project into a different account or organisation without the project owner's approval.

Approved teachers can view every student across all classes. Only approved teachers can create enrolments and student profiles. A verified Google student can read their own enrolment, claim its profile once using their Firebase UID, and access only that student's games while the enrolment is active. Rules enforce this in Firestore; the app does not rely on hidden UI buttons. An unregistered Google sign-in can create a Firebase Authentication entry, but does not grant access to app student records. Password-free nickname/class practice is **local to a browser** and cannot open cloud records by a guessable name and class.

The scores are calculated by the browser. The rules enforce account access, record shape and bounds; they do not independently recompute the game's correctness or timings.

Cloud saves use an atomic transaction and a stable game ID. Retrying an interrupted save does not double-count the game, summary or medal. A failed upload remains pending in local storage and can be retried from the results screen or after Google sign-in. Do not clear browser storage until pending results have uploaded. A browser that blocks storage can play, but cannot retain results offline.

Teacher rosters load 100 students at a time with a **Load more students** button. Search and class filters apply to loaded students; the interface states this. Cloud game history loads the latest 100 games per student, while the student's lifetime summary and medals remain on their profile. Each completed game makes one game write and one summary write; there are no live polling listeners.

References: [Firebase plans](https://firebase.google.com/docs/projects/billing/firebase-pricing-plans), [Firestore free quotas](https://firebase.google.com/docs/firestore/quotas), [Google sign-in](https://firebase.google.com/docs/auth/web/google-signin).

## Enable Google Classroom import

Manual enrolment needs Google sign-in and Firestore but does not need the Classroom API. To enable import as well:

1. In the same Google Cloud project, enable the **Google Classroom API** from the API library.
2. Configure that project's OAuth consent screen for its intended teacher audience. Add only these Classroom permissions: `classroom.courses.readonly`, `classroom.rosters.readonly`, and `classroom.profile.emails`. They read class lists, rosters and student email addresses; they do not permit changing classes, coursework or grades.
3. Complete Google's OAuth publishing or verification requirements for that audience. During development, configure permitted test users where required. Google Workspace administrators can control whether school accounts may grant access to this app. See [Classroom authorization](https://developers.google.com/workspace/classroom/guides/auth) and [Classroom data access](https://support.google.com/edu/classroom/answer/6253304).
4. Sign in to Multiplication Masters using an approved teacher account that actually teaches the Classroom class. The Firebase project owner's account and the classroom teacher's account need not be the same. Only active classes taught by that signed-in teacher are listed.
5. Select **Import from Google Classroom**. A separate Google permission prompt asks to read the class list, rosters and student emails. Review the chosen roster before selecting **Import selected students**. Students with unavailable email addresses cannot be imported; the preview identifies them.

The Google access token stays in JavaScript memory for the import and is cleared when the import dialog closes or the teacher signs out. It is not stored in local storage, Firestore or source files. No OAuth client secret or service-account key is used in the browser. Importing reads Classroom and writes the confirmed enrolments to this app; it does not alter the original Classroom course or enrolment list.

Imports save each student atomically, using the Google email as the enrolment key. A partial import shows progress and can be retried without duplicate student accounts. Previously recorded progress stays attached to the same student. Imported course identifiers are stored on the app class so a later import can suggest the same class name. Imports are teacher initiated; there is no unattended Classroom sync, deletion or polling.

## Publish to GitHub Pages

The source is ready for a public repository named `multiplication-masters`. No repository, commit, push or publication is performed by these files.

Once source publication is authorised, enable **Settings → Pages → Deploy from a branch**, select the approved branch and the repository root, and save. This is a buildless static site. `.nojekyll` prevents unnecessary Jekyll processing, and relative URLs support the repository's Pages subdirectory. GitHub Pages serves the code; it does not store student results.

Add the resulting Pages hostname to Firebase's authorised domains. Do not put student records, exported reports, personal account details, private links or credentials into Git. Keep local data exports outside the published source. No GitHub Actions workflow or package installation is required.

## Source map

- `index.html`: app shell and accessible dialogs.
- `styles.css`: responsive layout, card flips, pile movement and countdown animation.
- `src/game.js`: shuffle, answer matching, scoring and game records.
- `src/app.js`: screens, timers, interaction and reports.
- `src/store.js`: browser storage and optional cloud coordination.
- `src/firebase.js`: lazily loaded Firebase Authentication and Firestore adapter.
- `src/guide.js`: displays the same README safely inside the teacher guide, without executing embedded HTML.
- `src/classroom.js`: read-only Classroom roster loading with an in-memory access token.
- `config.js`: public Firebase web app configuration; it contains no administrator credentials or account-owner email.
- `firestore.rules`: cloud access rules, published separately in Firebase.

## Verification status

The public Firebase web configuration is connected. Google sign-in is enabled, and the default Firestore Standard database has been created in `australia-southeast2` (Melbourne) on Spark. The access rules in `firestore.rules` have been published, and the Google Classroom API is enabled. Its three required OAuth scopes and usage justification are saved. Google marks the roster email scope as sensitive and unverified; the current external OAuth configuration shows a 100-user cap for unapproved sensitive permissions. No real student records have been imported. Teacher approval, the deployed website's authorised domain, and Classroom OAuth verification or an agreed development-access workflow still need to be completed.

Source has been reviewed during implementation. No automated tests, browser checks of the game, build, typecheck or lint have been run. The Firebase console confirmed service setup and rule publication; that does not verify the app's behaviour. Live Google sign-in, database access enforcement, enrolment linking, cloud persistence and Classroom import still need a targeted verification pass before classroom rollout.
