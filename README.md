# Multiplication Masters

A quick times-table memory game for ages 8–12. Plain HTML, CSS and JavaScript: no framework, package installation or build step. Designed for a short classroom session, and available for unlimited practice at home.

## For teachers: getting started

This game helps students memorise multiplication facts through short flashcard sessions and immediate practice of facts they missed. It is designed to fit into a few minutes of morning practice. Students can also use it at home as often as they like.

- **Start a game:** choose one times table and select **Start game**. A five-second countdown gives the student time to get ready. Students type answers and press Enter.
- **See earned medals:** the student's main screen shows **My medals** prominently above the times tables, with their earned medals and a count out of 12. Uncollected tables have numbered spaces. Open **View medals** for the full collection and trophy.
- **Use the teacher desk:** sign in with an approved teacher Google account. Teacher accounts open the **Students** area to add classes and students, search for a name, or filter by class. Their navigation shows **Students** and **Results** instead of the student game tabs. All approved teachers can view students across all classes.
- **Add another teacher:** in **Students → Teachers**, enter their Google email, select **Add a teacher**, and confirm the access shown. After access is saved, an invitation opens in your email app with the recipient, subject and game link filled in. Check that the From account is yours, then press **Send**. **Invite by email** beside an enabled teacher opens the same message again. This applies only to teachers; student setup never opens an invitation. The app does not send mail automatically or request access to a mailbox. They can sign in with that Google account immediately, even if they have never opened the game before. Teachers can disable or restore another teacher's access from the same section. You cannot change your own access.
- **Add students manually:** create a class, then enter a nickname, class and the student's school Google email. The email identifies the account the student must use to sign in.
- **Edit a student:** choose **Edit** beside their name to change their name or class. Choose **Unassigned** to clear their class memberships. Changing the class moves the student into that class; changing only their name preserves existing memberships. Their Google email, access status, results and medals stay the same.
- **Manage classes:** the **Classes** section lists each class and its assigned teacher. Choose **Assign teacher**, select an enabled teacher or **Unassigned**, then save. Assignment identifies the class teacher; all approved teachers retain access to every class.
- **Delete a class:** choose **Delete class** and confirm. All students currently in that class become **Unassigned**, including removal of any other class memberships. Their accounts, results and medals remain. Interrupted deletion is marked **Deletion incomplete**; refresh the teacher desk and choose **Finish deletion**. Students cannot be added to a class while it is being deleted.
- **Delete a teacher:** choose **Delete teacher** beside another teacher and confirm. Their app teacher record is removed, while their classes and students remain. Class teacher assignments are cleared. You cannot delete your own teacher account. Interrupted removal can be resumed with **Finish deletion**.
- **Bulk import students:** create a class, then select **Bulk import**. Choose the class from the dropdown and paste two spreadsheet columns: student name, then student Google email. Select **Review students**, fix any highlighted rows, then confirm the import. A header row is optional.
- **Disable or enable a student:** choose **Disable** or **Enable** beside their name and confirm. Disabling blocks the student across all classes while retaining their results and medals. Adding the same email manually or through bulk import keeps the disabled status.
- **Permanently delete a student:** choose **Delete**, review the student name, email and scope, then select **Delete permanently**. This deletes their profile, all class memberships, enrolment, complete game history and medals. It cannot be undone. Keep the dialog open; if interrupted, the student remains disabled and **Finish deletion** resumes the removal.
- **Compare results:** open **Results**, choose dates and select **Show results**. Then filter by class, students or times table; options, graphs and tables update together. The Got it line graph uses a different colour for each times table, with one point per game. A correct/missed answer chart, student summaries and recent games use the same filters. Select a student name for their detailed history.
- **Open a student’s results:** select **View progress** beside the student. View first-round counts, first-try accuracy, response times, medals and individual game details. Open a game-history row to see each multiplication fact and its retry count.
- **Use a shared classroom device:** students must sign in with their own enrolled Google account. Sign out before the next student uses it. Teacher accounts can view results and manage classes, but cannot play as students.
- **Play at home:** once enrolled in an app class, students sign in with the matching school Google account. The **My progress** and **My medals** pages show the same account's history and achievements at school and at home.
- **Read this guide again:** open **Students → Teacher guide · setup & technology**. The in-app guide uses this same README file, so the two copies stay in sync after a site update.

There is no daily play limit. The game rewards practice and confidence, without public leaderboards or comparisons between students.

## Accounts and student records

Students must sign in with an enrolled Google account to play. There are no guest, nickname-only or automatic practice accounts.

- **Cloud account:** a teacher first enrols the student's school Google email, manually or by pasting spreadsheet rows. The student then signs in through Google and is linked to that existing profile. Students cannot register themselves into a class. Google handles the sign-in; the game does not ask for or store a Google password.
- **Approved teacher:** a project administrator sets up the first teacher. Approved teachers can then add colleagues by Google email from the teacher desk. Every approved teacher can view all classes, manage students and grant other teachers access. A student cannot make themselves a teacher by changing their nickname, class or browser settings. A Google student account can read only its own records.

Immediately after the 12th first-round answer or timeout, the app saves the chosen table, game start date/time, first-round finish date/time, **Got it** count, **Not yet** count, answers, timeouts and response times. These two counts always add up to 12 and never include retry attempts. Finishing the retries or quiz updates the same game record with its final finish time, retry attempts and quiz outcome; the first-round snapshot stays unchanged. A student profile holds a nickname, school Google email, class memberships, account identifier, access status, summary totals and earned medals. A temporary deletion marker is retained only while a permanent deletion is in progress. Email addresses are used for enrolment matching and shown to approved teachers; they are not copied into each game-result document. The app does not read a student's Gmail inbox or Google Drive files.

Manual setup and spreadsheet imports use the same enrolment records. Matching the same Google email adds class membership to the existing student without replacing their nickname, games or medals. A student can belong to more than one class and keep one progress history. Unassigned students have an empty class name and membership list; their enrolled Google login and saved results still work. The student and report class filters include **Unassigned**. Deleting a class explicitly moves all its members to Unassigned; assigning them again is a separate teacher action. Teachers can repeat an import to add students who joined later; an import does not automatically remove absent students. No student invitations are emailed. Disabled students keep their disabled status when re-added or imported; use **Enable** explicitly to restore access. A student whose deletion has started cannot be re-enabled or re-imported until deletion finishes.

First-round results and completed games are saved to the student's Firestore record. Student profiles, results and pending saves are not persisted in browser storage. If the first-round save cannot be confirmed, the next stage waits on the interlude screen with an error and **Retry save**. A failed final save has its own retry button on the results screen. Keep the page open and retry; closing or reloading it loses any unconfirmed result held in memory. Leaving before all 12 flashcards are answered records no first round. Leaving after a confirmed first-round save keeps that dated snapshot, labelled **First round saved**, without counting the game as completed.

Teacher approvals are stored privately in Firestore using a normalised Google email. Each approval records whether access is enabled and when and by which account it was granted or changed. Only approved teachers can list or manage these approvals; another signed-in account can look up only its own approval. Disabling a teacher blocks subsequent database requests and the next teacher sign-in, but does not erase data already displayed on screen. It does not delete the teacher's Google account, classes or student results. The app and database rules prohibit changing your own approval to reduce accidental lockouts. The Firebase project administrator can recover access through the console if necessary.

## Technology used

- **HTML:** defines the screens, forms and accessible controls.
- **CSS:** controls the bright colour palette, responsive layout, card flips, card-pile movement and countdown animation. The game follows the device’s reduced-motion preference.
- **JavaScript:** shuffles cards, checks answers, runs timers, records first-round performance and builds reports. It runs directly in the browser without a framework or a build step.
- **Page memory:** holds the current game and loaded records only while the page is open. It is not a persistent backup; saved student records come from Firestore. Google authentication is managed separately by Firebase Authentication.
- **Firebase Authentication:** provides Google account sign-in. It is separate from the project's teacher-approval list.
- **Cloud Firestore:** stores shared profiles, class names and completed games. Database security rules enforce access to these records.
- **Artwork and fonts:** cartoon cards, the logo and 12 food-shaped medal illustrations are SVG artwork included with the app. Fredoka headings and Nunito body text are bundled locally with their SIL Open Font License files in `assets/fonts/`; the app does not contact a font service.
- **GitHub:** stores the application’s source code. Student records and private credentials do not belong in the repository.
- **GitHub Pages:** is the intended website host for the HTML, CSS and JavaScript. It does not hold the shared student database.

The intended setup uses Firebase's **free Spark plan**, without a credit card or linked billing account, and GitHub Pages from a public source repository. Free usage quotas apply. The technical setup sections below are for the person managing the project; teachers do not need to edit code to run a game or view reports.

## Troubleshooting for teachers

- **Google sign-in is unavailable:** ask the project administrator to check Firebase and the network connection. Signing in is required to play.
- **A school Google account cannot sign in:** the school’s Google administrator may need to allow the application. The project administrator can also check the website’s authorised domain in Firebase.
- **Teacher desk is missing:** make sure the correct Google account is selected and ask an approved teacher to add that exact Google email in **Students → Teachers**. Sign out and back in after approval. The project administrator sets up the first teacher or recovers access through Firebase.
- **Results are missing at home:** check that the same enrolled Google account was used and that the game save was confirmed.
- **A save is not confirmed:** keep the results page open, reconnect and select **Retry cloud save**. Closing or reloading the page loses an unconfirmed result.
- **A student does not appear in a search:** the roster loads 100 students at a time. Select **Load more students** to extend the search.
- **A student is told their account has not been added:** check the Google email on the teacher roster. Add that email manually or through **Bulk import**, then have them try signing in again. A nickname match alone does not grant cloud access.
- **Spreadsheet rows cannot be imported:** copy two columns with the student name first and Google email second. Check the row numbers and errors in the preview. Names must be 1–32 characters. Create a class first if the class dropdown is empty. Repeated emails within the pasted rows are skipped.
- **An import stops partway:** keep the import dialog open and select **Retry import** to continue. If you closed it, paste the same rows again; existing accounts and results will not be duplicated.

Project administrators can find the exact Firebase setup, permissions, hosting instructions and current verification status below. No real student details, account-owner contact information or private access credentials should be added to this public guide.

## Play locally

Serve this folder over HTTP with any static server. For example, if Python 3 is already available:

```sh
python3 -m http.server 8080 --bind 127.0.0.1
```

Open `http://localhost:8080`. JavaScript modules need HTTP; opening `index.html` directly as a file is not supported.

Local development still requires Firebase configuration and an enrolled student Google account. There is no guest-play or browser-storage fallback, and no sample students or fabricated results are seeded.

## Game rules

1. Choose a table from 1–12 and click **Start game**. A **5–4–3–2–1 countdown** runs before the first card's timer begins.
2. The flashcard round contains each multiplier from 1–12 exactly once, shuffled. Each card has five seconds. Enter submits instantly. A wrong answer or timeout flips the card to show the complete equation and correct answer for **three seconds after the flip finishes**, then moves it to **Not yet**. A first-round correct answer goes to **Got it**.
3. If any cards were missed, revisit them without a timer. Type the displayed equation and answer, such as `6 x 4 = 24`. Spaces, case and either `x` or `×` are accepted. A wrong attempt flips the card to reveal the correct equation for one full second after the flip, then flips back. Retry until correct. Correct retry cards disappear; they do not enter the first-round **Got it** pile. That pile is hidden during retries. Attempts count separately for each card. No medal quiz follows a retry round.
4. A perfect 12/12 first round unlocks a separate **Start medal quiz** button. The quiz contains 20 shuffled multiplication equations from the selected table (all 12 facts plus eight random repeats). It has a **single 60-second countdown bar**. Questions appear one at a time; Enter submits instantly. One wrong answer is allowed. A second wrong answer ends the quiz immediately. Finish all 20 within the minute with **19 or 20 correct** to earn the table's medal. Running out of time before finishing fails the quiz, even with 19 answers correct so far.
5. Collect all 12 medals to earn the trophy. Previously earned medals are retained after later unsuccessful games. There is no points system.

Games can be played as often as desired. There is no daily limit, daily recommendation, streak or long-session requirement. A confirmed first-round snapshot is retained even if the player leaves before finishing retries or the quiz; completed games retain their original results, response times, timeouts, retry attempts and quiz outcome. First-round speed averages include five-second timeouts. Reports show first-round Got it and Not yet counts, accuracy by table and individual card results.

Animation respects the device's reduced-motion setting. Game and quiz deadlines continue while the browser tab is in the background; there is no pause advantage.

## Medal collection and visual design

Each table keeps its original medal identifier, so existing achievements are preserved after the visual update. Its collectible has a cartoon food character inside a gold medal frame, connected ribbon tails, a colour and a pun: **Shrimply amazing**, **Orange you smart**, **Grape job**, **You're a-peeling**, **Berry brilliant**, **You're a fun-gi**, **Donut stop learning**, **Taco 'bout smart**, **Pear-fect answers**, **Looking pine!**, **Easy pea-sy**, and **You're one in a melon**. Selecting a table previews its medal. Once earned, the table card shows the full medal and a bold completion tick. Collecting all 12 still earns the trophy.

The interface uses large, dark text, rounded headings, colourful table tiles, a smiling flashcard logo with a gold star and subtle sticker animations. Fruit characters have highlights, clear outlines and expressive faces; medal centres have an opaque cream fill, including uncollected medals. Card questions stay clear and readable, with the existing flipping behaviour. Reduced-motion settings disable decorative movement. The original font copyright notices and licences are preserved in `assets/fonts/fredoka/OFL.txt` and `assets/fonts/nunito/OFL.txt`. Font sources: [Fredoka](https://github.com/google/fonts/tree/main/ofl/fredoka) and [Nunito](https://github.com/google/fonts/tree/main/ofl/nunito).

## Connect Firebase on the free Spark plan

Use **Cloud Firestore Standard edition** and **Firebase Authentication**. This app does not use Cloud Functions, Cloud Storage, phone authentication, Analytics or any paid-only service. Stay on **Spark** and do not link a billing account or upgrade to Blaze. The published free quotas still apply; requests can be restricted at the quota limit.

1. Create a project in the [Firebase console](https://console.firebase.google.com/) on Spark. Google Analytics is unnecessary and can be disabled during creation.
2. Register a **Web app**. Copy its web configuration into `config.js`. The web API key and app/project identifiers are public configuration. Never put service-account files, admin SDK credentials, OAuth client secrets or private keys into this repository.
3. In **Authentication → Sign-in method**, enable **Google**. Complete the required support email settings in the console, without adding those details to source files.
4. Add your deployed website's hostname to **Authentication → Settings → Authorised domains**. Add `localhost` for local development if needed. School administrators may need to allow the application for managed education Google accounts.
5. Create a **Cloud Firestore Standard edition** database. Choose a suitable location before creating it. Start in production mode, replace its rules with the contents of `firestore.rules`, and publish them. No composite indexes are needed by the current queries.
6. Bootstrap the first teacher in Firestore: create a document in the `teachers` collection whose **document ID is their exact Google email, lowercased**. Set `email` to that same address and `enabled` to boolean `true`. Add `createdAt` and `updatedAt` as matching ISO date/time strings, and `invitedByUid` and `updatedByUid` as the string `project-admin` for this console-created approval. Keep the real email in Firebase, never in source code or this guide. Set `publicAppUrl` in `config.js` to the published game address so emailed invitations use that address even when testing locally. No first sign-in or Firebase Authentication UID lookup is needed.
7. That teacher can now sign in through Google and open **Students → Teachers** to add other teachers. Each colleague must use the exact approved Google email. Teachers do not need student profiles, Firebase console access, passwords or access codes. Only an existing approved teacher can add or change another teacher's approval; students and unapproved accounts cannot grant access. Changes require an explicit confirmation in the app.

Class documents contain a name and an optional assigned `teacherEmail`. A temporary `deleting` marker blocks new enrolments while class deletion runs. Teacher approval documents can also carry that marker during deletion; the teacher is disabled before their class assignments are cleared and their approval is removed. Removing an app teacher record does not delete a Google account or the separate Firebase Authentication registration.

Teacher approval documents now use Google email addresses as their IDs. If upgrading an older installation that used Firebase UIDs, a project administrator must create the email-based approvals in the console before relying on the updated rules and app. An old UID-based approval does not grant access under the new rules.

Managed education accounts may be asked to select a parent organisation or folder when creating the project. If no parent is available, ask the school's Google Cloud administrator to check which organisation or folder the project should use and whether the account has project-creation permission there. Project creation requires the `resourcemanager.projects.create` permission, commonly provided by the Project Creator role. See [Google Cloud project creation](https://docs.cloud.google.com/resource-manager/docs/creating-managing-projects). Do not switch the project into a different account or organisation without the project owner's approval.

Approved teachers can view every student across all classes. Only approved teachers can create enrolments and student profiles. A verified Google student can read their own enrolment, claim its profile once using their Firebase UID, and access only that student's games while the enrolment is active. Rules enforce this in Firestore; the app does not rely on hidden UI buttons. An unregistered Google sign-in can create a Firebase Authentication entry, but does not grant access to app student records. Only signed-in enrolled students can play and create game records; teachers cannot play on a student’s behalf. Nicknames and class names do not grant account access.

The browser checks answers and records timings. The rules enforce account access, record shape and bounds; they do not independently recompute correctness or timings. For compatibility with the already deployed database schema, the data adapter retains unused legacy `score` and `bestScore` fields. They are never displayed or used for rewards, reports or game logic. Existing historical records are preserved; no database migration or rule change is required for removing the points feature.

Database saves use atomic transactions and a stable game ID. The first-round snapshot is saved before the retries or medal quiz can start. Database rules permit that checkpoint to be completed once while preserving its original counts and timestamps; completed game records cannot be edited. Retrying an interrupted save does not double-count the game, summary or medal. A failed save can be retried from the results screen while it remains open. There is no persistent offline queue or device-only history. Reports load saved games from Firestore, and sign-out clears the app’s in-memory record cache.

The home screen displays the signed-in student's earned medals from their Firestore profile, refreshed after a confirmed completed-game save. The app no longer requests or caches a total-points aggregate.

Teacher rosters load 100 students at a time with a **Load more students** button. Search and class filters apply to loaded students; the interface states this. Cloud game history loads 25 games at a time using a cursor. **Load older games** fetches the next page without rereading the previous pages; lifetime summaries and medals remain on each profile. Each game makes one write after the first round. Completing it updates that same game document and writes the lifetime summary once. A stable game ID and transactions prevent a retry from duplicating either the game or its summary. Lifetime completed-game totals and medals change only on full completion. A signed-in student has one realtime listener for their own enrolment; while connected, disabling or deleting that enrolment ends access in the open app and clears its loaded records. The database blocks subsequent record access and saves even if the browser has not received that notification. There is no polling of game histories.

### Database traffic

Roster pages, class lists, teacher lists and identical game-page queries share a bounded, two-minute in-memory cache. Simultaneous identical requests reuse one promise. This cache is cleared on sign-out or account changes; it never persists student data on the device. Successful writes invalidate the affected data. **Refresh** on the teacher desk, **Refresh** in student history and **Refresh results** request current data explicitly. Changes made by another teacher may take up to two minutes to appear through normal navigation unless refreshed.

Game pages contain at most 25 records per request, compared with the previous 100. Student history and reports load older pages only when requested. Reports fetch game history only after **Show results**; changing the class, students or times table then filters the loaded data without another request. Supporting those dependent options still requires a dated page for every loaded roster student; it does not query students whose roster pages have not been loaded. Narrow dates and load extra roster/history pages only when needed. Existing game documents contain card details, so each fetched game still transfers those details; the web client cannot project only selected fields from these documents.

Save and enrolment transactions return their updated profile directly rather than reading it again after commit. Re-importing an unchanged student does not write the same class membership again. Duplicate class creation and unchanged access settings avoid unnecessary writes. There is one necessary write after the first round and two on completion, with idempotent retry protection. No game-history polling, points aggregates or additional realtime listeners were added. The student's access-revocation listener stays active while signed in. Firestore security-rule lookups, transaction retries and listener reconnects can add reads beyond the app's direct queries; these optimisations reduce usage without guaranteeing a quota allowance. See [Firestore query best practices](https://firebase.google.com/docs/firestore/best-practices) and [Firestore read billing](https://firebase.google.com/docs/firestore/pricing).

References: [Firebase plans](https://firebase.google.com/docs/projects/billing/firebase-pricing-plans), [Firestore free quotas](https://firebase.google.com/docs/firestore/quotas), [Google sign-in](https://firebase.google.com/docs/auth/web/google-signin).

## Student access and deletion

All approved teachers can disable, enable or delete students across all classes. Disabling atomically sets the profile and enrolment inactive; the student cannot sign in to the game or read or save results. Their Google account remains unchanged. Existing profiles without an explicit access flag are treated as active. Re-enabling restores access to the same results and medals.

Permanent deletion first disables access and marks the profile as being deleted. This prevents new games, re-enabling and imports from adding records while deletion runs. The app deletes **all** game documents in batches of 100, including records older than the reporting limit, then atomically removes the profile and enrolment. The final profile removal is not reported as successful until the database confirms it. If a request fails, keep the dialog open and retry, or use **Finish deletion** from the roster. Partial deletion is irreversible and cannot be cancelled into an active account.

The in-app deletion removes the student's Firestore game data. The browser cannot administer other users' Firebase Authentication accounts: a minimal Google sign-in registration may remain there. A project administrator must remove that separate entry from **Firebase Authentication → Users** if it also needs to be erased. No administrator credentials are placed in the app. A later teacher enrolment of the same email creates a new student profile without the deleted history.

Deploy the matching `firestore.rules` before using these controls. The rules allow deletion only to approved teachers, require a disabled deletion marker before game deletion, and require the enrolment and profile to be removed together. Students cannot grant or restore their own access or delete records.

## Teacher results reports

Teacher accounts see **Students** and **Results**, and are routed away from the student game pages. **Results** loads 100 roster entries at a time; use **Load more students** to include further entries. The student picker supports search, multiple selections, select all and clear selection within the chosen class. Disabled students remain available for reporting until permanently deleted.

Reports start with the last 30 calendar days. Choose dates, then select **Show results**. To support dependent filters, the app queries up to the latest 25 games **within those dates for each loaded roster student**, with at most four simultaneous requests. Class, student and times-table filters then update immediately in page memory, without another database request. Each dropdown offers options matching the other active filters; counts identify matching students or games. Selected options remain available to clear if they have no matches. Changing dates or loading more roster students requires **Show results** again. **Refresh results** reloads the date range, and **Clear filters** restores the default selection and dates. A notice identifies when older games may be available. **Load older games** adds the next 25 for matching students, using cursors; the filters and graphs then include those extra records. Narrowing dates also limits what is fetched. Opening Results does not query game histories until requested. Errors identify students whose results could not be loaded; their records are excluded from charts and totals.

**Got it by times table** shows a different coloured line for each times table played in the selection. Colours stay consistent when filters change. Each point is one game's first-round Got it count out of 12, plotted at its game date and time, without daily averaging. With multiple students selected, their games share each table's line; hover over a point to identify the student and date, or expand **View games in this graph** for the same records in a table. Each recent-game row also shows its exact Got it and Not yet counts, game date/time, first-round finish date/time when recorded, and completion status. Retry attempts never alter these counts. Saved first rounds remain in this report even when the rest of a game was not finished. Older completed records without an explicit snapshot use their recorded initial-correctness flags; an earlier first-round finish time is not invented.

The answer chart counts initial correct answers versus missed or timed-out answers; retry answers do not change that breakdown. Graph data is also available in tables. Summary statistics distinguish saved first rounds from fully completed games; medal counts show current lifetime totals. Recent games lists the newest 100 games from the loaded selection, with links to individual student histories. Days without games are not shown as zero results. Date boundaries and daily groups use the teacher's browser time zone. The student picker closes on outside click, Escape or when keyboard focus moves away. Long student lists scroll inside the dropdown, and native select fields retain their built-in scrolling and keyboard controls. The From and To date fields are grouped side by side. Account and history chevrons use centred SVG icons. Sign-in errors stay visible inside the Account dialog until the next attempt or until it closes.

## Import students from a spreadsheet

1. Create the destination class from **Students → Add a class**.
2. In the spreadsheet, arrange two columns: **Student name**, then **Student email**. Use the Google email each student will sign in with. Names are limited to 32 characters and are displayed as the student's nickname.
3. Select the cells and copy them. The header row is optional. Blank rows and unused trailing columns are ignored. Comma-separated rows, including quoted names, are also accepted.
4. Open **Bulk import**, choose the destination **Class** from the dropdown, and paste the rows.
5. Select **Review students**. The preview lists source row numbers, names, normalised emails and validation errors. Fix all invalid rows using **Edit rows or class** before importing. Duplicate emails within the paste are skipped after the first valid row.
6. Select **Import students** to save the reviewed roster. Keep the dialog open while progress is shown. A partial import can be resumed with **Retry import**.

Example columns (use actual student Google emails only in the app, never in this repository):

| Student name | Student email |
| --- | --- |
| Alex | alex@school.example |
| Sam | sam@school.example |

Nothing is saved until the teacher confirms the preview. Pasted rows and the import draft are held only in page memory and are cleared when the dialog closes. Each student is saved through the same atomic Firestore enrolment transaction used for manual setup. Matching emails retain their existing name, access status, results and medals while adding the selected class. Repeating an import does not duplicate accounts or remove students who are absent from the pasted rows. No student invitations are emailed.

The app requests only ordinary Google sign-in information. Spreadsheet import does not connect to Google Classroom, Google Sheets, Drive or Microsoft accounts, and needs no additional Google API permissions. School administrators may still need to allow Google sign-in to this app.

## Publish to GitHub Pages

The project is hosted at [Multiplication Masters](https://markyf81-wq.github.io/multiplication-masters/), with its public [source repository](https://github.com/markyf81-wq/multiplication-masters). Student and teacher records are stored in Firebase, not GitHub.

Once source publication is authorised, enable **Settings → Pages → Deploy from a branch**, select the approved branch and the repository root, and save. This is a buildless static site. `.nojekyll` prevents unnecessary Jekyll processing, and relative URLs support the repository's Pages subdirectory. GitHub Pages serves the code; it does not store student results.

Add the resulting Pages hostname to Firebase's authorised domains. Do not put student records, exported reports, personal account details, private links or credentials into Git. Keep local data exports outside the published source. No GitHub Actions workflow or package installation is required.

## Source map

- `index.html`: app shell and accessible dialogs.
- `styles.css`: responsive layout, card flips, pile movement and countdown animation.
- `src/game.js`: shuffle, answer matching, frozen first-round snapshots and game records.
- `src/app.js`: screens, timers, interaction and reports.
- `src/store.js`: authenticated database access and temporary page-session state; no browser persistence for student records.
- `src/firebase.js`: lazily loaded Firebase Authentication and Firestore adapter.
- `src/medals.js`: the 12 original cartoon medal illustrations, colours and pun labels.
- `assets/logo.svg`: original cartoon flashcard logo; `assets/icon.svg` is the matching browser icon.
- `assets/fonts/`: bundled Fredoka and Nunito fonts with their original licences.
- `src/results.js`: teacher report filters, date-range queries, summaries and accessible SVG charts.
- `src/guide.js`: displays the same README safely inside the teacher guide, without executing embedded HTML.
- `src/student-import.js`: spreadsheet row parsing, optional headers, validation and duplicate detection.
- `src/class-admin.js`: student editing, class assignments and confirmed teacher/class deletion.
- `src/student-profile.js`: shared class labels and Unassigned filtering.
- `config.js`: public Firebase web app configuration and published invitation URL; it contains no administrator credentials or account-owner email.
- `firestore.rules`: cloud access rules, published separately in Firebase.

## Verification status

The public Firebase web configuration is connected. Google sign-in is enabled, and the default Firestore Standard database has been created in `australia-southeast2` (Melbourne) on Spark. The GitHub Pages hostname is authorised for Google sign-in. Teacher management uses the email-based approval rules and first-teacher bootstrap described above; publish the matching `firestore.rules` whenever deploying permission changes. The app no longer includes the Google Classroom integration or requests its permissions. Spreadsheet import uses teacher enrolment access. The student access, student deletion, first-round checkpoint, teacher deletion, class management and Unassigned schema rules have been published in Firebase. Source publication remains separate from database rules. Previously enabled Classroom API and OAuth declarations in the Google Cloud console have not been changed by this source update; the app does not use them. No real student records have been imported during implementation.

Source has been reviewed during implementation. No automated tests, browser checks of the game, build, typecheck or lint have been run. The Firebase console confirmed service setup and rule publication; that does not verify the app's behaviour. Live Google sign-in, database access enforcement, enrolment linking, cloud persistence, first-round checkpoint saves, spreadsheet import, student access management, permanent deletion, teacher report filters and the new visual layout still need a targeted verification pass before classroom rollout.
