# Wall of Frames

AvaZone's internal recognition platform for AvadheshCo. People appreciate each other with points, earn badges and levels, and redeem rewards. Managers see their teams. HR and admins run the programme with custom roles and permissions.

Built with **Next.js 16 (App Router)** in plain **JavaScript / JSX** (no TypeScript), **Drizzle ORM** and **SQLite (libSQL)**, with real sign-in, server-side permission checks and an audit log.

---

## Quick start

You need **Node.js 20 or newer** (`node -v` to check).

```bash
npm install
npm run setup      # creates .env.local, the database, and sample company data
npm run dev        # http://localhost:3000
```

Sign in with any demo account. The password for all of them is **`avazone123`**.

| Account | Role | What to try |
|---|---|---|
| nikhil@avadhesh.co | Super Admin | Roles & Permissions, Company Settings, Audit Log |
| priya@avadhesh.co | HR Admin | Users, Reward Approvals, Moderation, Levels, Overview |
| syed@avadhesh.co | Manager | My Team, nudges, awarding badges |
| meera@avadhesh.co | Team Lead (custom role) | Sees her team, can't nudge |
| kannha@avadhesh.co | Employee | Recognise, comment, redeem rewards |

The sign-in page has one-tap buttons for each account.

`npm run db:reset` puts the sample data back to its starting state at any time. `npm run format` tidies the code with Prettier.

A visual walkthrough of every journey is in **Wall-of-Frames-App-Flow-Guide.pdf**.

## Deploy to Vercel

Vercel can't keep files between requests, so the app needs a **hosted database**. [Turso](https://turso.tech) (hosted SQLite) has a free tier and works with no code changes. Photos live in the database too, so you don't need a separate file store.

**1. Create the database** (pick one):

- **In Vercel (easiest):** open your project, go to **Storage → Marketplace → Turso → Create**, and connect it to the project. This adds `TURSO_DATABASE_URL` and `TURSO_AUTH_TOKEN` for you.
- **With the Turso CLI:**
  ```bash
  turso db create wall-of-frames
  turso db show wall-of-frames --url      # → DATABASE_URL (libsql://…)
  turso db tokens create wall-of-frames   # → DATABASE_AUTH_TOKEN
  ```

**2. Add environment variables** in Vercel, under **Project → Settings → Environment Variables**:

| Name | Value |
|---|---|
| `DATABASE_URL` | `libsql://wall-of-frames-<you>.turso.io` (skip this if you used the Vercel Turso integration) |
| `DATABASE_AUTH_TOKEN` | your Turso token (skip this if you used the integration) |
| `SESSION_SECRET` | any long random string. Run `node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"` to make one |
| `SHOW_DEMO_ACCOUNTS` | `true` to show the one-tap demo logins, `false` for real use |
| `SEED_DEMO_DATA` | optional. Set to `false` to start with an empty company instead of the demo |

**3. Deploy.** Push the project to GitHub and import it in Vercel, or run `npx vercel` in the folder.

The build runs `npm run vercel-build`, which does three things:

1. Checks the variables above. If any are missing, the build stops and tells you which ones to add.
2. Creates or updates the tables in your database.
3. On the very first deploy only, loads the demo company. Every demo account's password is `avazone123`. Later deploys never touch your data.

**Common problems**

| What you see | Fix |
|---|---|
| Build fails with "can't be deployed yet" | Add the variables it lists, then redeploy |
| "Application error" when the site opens | `SESSION_SECRET` or the database variables were added after the last deploy. Redeploy so they take effect |
| `DATABASE_URL is not set to a hosted database` | You're still using the local `file:` database. Use your Turso URL instead |
| Photo upload fails on a big GIF | Vercel caps uploads at 4.5 MB. Other photos are shrunk automatically |

To use the same Turso database from your own computer, put `DATABASE_URL` and `DATABASE_AUTH_TOKEN` in `.env.local`. `npm run setup` and `npm run db:reset` will then use that database.

### Self-hosting

```bash
npm run build
npm start
```

Set a real `SESSION_SECRET` in `.env.local` (the setup script already generates one). For a hosted database, point `DATABASE_URL` at a [Turso](https://turso.tech) / libSQL URL and set `DATABASE_AUTH_TOKEN`. Set `SHOW_DEMO_ACCOUNTS=false` to hide the demo buttons. Post photos are stored in the database, so there is no upload folder to look after.

---

## Made easy for everyone

- **Getting started checklist** on Home ticks itself off as you actually do things (add a bio, thank someone, react, redeem).
- **“Needs you” card** shows role-aware to-dos: pending reward requests, reported posts, quiet teammates.
- **“?” on every page** explains in plain words what the page is for and what you can do there.
- **Guided Recognize sheet** numbers the steps (1 Who · 2 Which value · 3 Say thanks) and the button always says what’s next.
- **Phone-friendly**: an iOS-style tab bar at the bottom with a big + to recognise someone.
- **Undo** after most actions, skeleton loading screens, and a little confetti when you send thanks.
- Press **?** anywhere to see keyboard shortcuts.

---

## Automatic points (Super Admin decides)

Nobody types a points amount. The Super Admin sets the rules in **Admin → Points Rules**, and the app gives points out by itself:

| Rule | Default | When it's given |
|---|---|---|
| Points per appreciation | 20 | To every person thanked, automatically |
| Monthly giving budget | 200 | How many points each person can trigger per month |
| Welcome bonus | 100 | When HR or the Super Admin adds a new person |
| Birthday | 50 | On their birthday, once a year |
| Work anniversary | 100 | Every year on their joining date |
| Points for a new badge | 50 | Used when HR creates a badge |

- Birthdays and anniversaries are checked on the first page view of each day, and straight away when the rules are saved. Each grant has a unique key, so nobody is ever paid twice.
- **Set point rules** (`points.manage`) belongs to the Super Admin only. It can't be switched on for any other role, not even HR. HR sees badge points as "Set by Super Admin".
- From a person's Edit sheet, the Super Admin can also **give or take bonus points**, always with a reason the person sees.
- Every change is written to the Audit Log, for example "Per appreciation 20 → 25 · Birthday off".

## Editing people (HR and Super Admin)

In **Admin → Users**, tap **Edit** on anyone to change their name, email, job title, employee ID, phone, city, role, department, manager, joining date and birthday (day and month only).

- HR can edit everyone except the Super Admin. HR can assign any role except Super Admin, or a role that can manage roles.
- Every save is logged in the Audit Log, for example "Edited details: phone, birthday".

**Rewards** are decided only by HR and the Super Admin (the `rewards.manage` permission). Points are held while a request waits, and refunded automatically if it's declined.

## Photos in posts

Appreciations and announcements can carry **up to 4 photos**. Tap **Add photos**, paste, or drag them onto the Recognize sheet.

- Large photos are resized in the browser before upload. The server checks the file's real type, so only JPG, PNG, WebP and GIF files up to 5 MB are accepted.
- The feed shows 1, 2, 3 or 4-photo layouts. Tap a photo for a full-screen viewer, and use ← → to browse.
- Photos are served only to signed-in people, through `/api/uploads/[id]`. Photos on hidden posts are visible only to moderators.
- Photos are stored in the database (they are small after resizing), so the app needs no disk and runs on Vercel.
- Undoing or deleting a post deletes its photos. Uploads that are never posted are cleaned up after a day.

## Badge Studio (create new badges)

HR Admins and Super Admins (anyone with the **Manage badges** permission) can create badges at any time in **Admin → Badge Studio**:

1. Tap **New badge**. Give it a name, a short description and **how to earn it**.
2. Pick a category (or create a new one), points, an icon and a colour, with a live preview.
3. Save. It appears instantly on the Badges page and in the Recognize sheet, ready for managers to award.

Badges can be edited, **retired** (hidden from pickers, but people who earned it keep it), restored, or deleted if nobody holds them yet.

---

## Roles, permissions and levels

**Permissions** are fixed keys defined in `lib/permissions.js`. Code only ever checks permission keys, never role names.

**Roles** are rows in the database, each holding a set of permissions. Admins with *Manage roles* can:

- create custom roles (starting empty or copying another role),
- switch individual permissions on and off (with Undo),
- compare every role side by side in a matrix,
- delete custom roles (their members move to Employee).

Guard rails stop anyone from locking the company out:

- **Super Admin** always has every permission and can't be renamed.
- You can't remove *Manage roles* from your own role, or change your own role.
- People without *Manage roles* (HR) can't assign Super Admin or a role that can manage roles, and can't edit the Super Admin.
- Every role, permission, user, reward and settings change is written to the **Audit Log**.

| Permission | Employee | Manager | HR Admin | Super Admin |
|---|:-:|:-:|:-:|:-:|
| Give appreciation, comment, redeem | ✓ | ✓ | ✓ | ✓ |
| Post announcements | | | ✓ | ✓ |
| View own team | | ✓ | ✓ | ✓ |
| Nudge team | | ✓ | | ✓ |
| Award badges | | ✓ | ✓ | ✓ |
| Create & edit badges (Badge Studio) | | | ✓ | ✓ |
| Edit people's details, decide rewards | | | ✓ | ✓ |
| Set point amounts (Points Rules), give bonus points | | | | ✓ |
| Analytics, levels, moderation, audit | | | ✓ | ✓ |
| Roles, company settings | | | | ✓ |

**Levels** come from *lifetime* points (appreciations and badges received). Spending points in the store lowers your balance, never your level. HR edits thresholds, colours and perks in Admin → Levels, with a live preview of how many people land at each level.

**Points:**
- Everyone has a monthly giving budget, which the Super Admin sets in Admin → Points Rules.
- Points sit in a ledger (`point_ledger`), so balances are always explainable.
- Redemptions hold points until HR approves; a decline refunds them automatically.

---

## Design principles

The interface follows Apple's Human Interface Guidelines.

- **Clarity.** It uses the system font (SF Pro on Apple devices, Segoe UI on Windows) with a single accent colour. Large titles head every page, and text meets contrast requirements in light and dark mode.
- **Deference.** The sidebar and popovers use translucent materials so content leads. Chrome is quiet and uses colour sparingly.
- **Depth.** Sheets, popovers and HUD toasts layer over content with iOS-style spring motion. Reduced-motion settings are respected.
- **Direct feedback.** Every action responds immediately with optimistic updates and a confirmation HUD.
- **Undo over "Are you sure?".** Appreciations, permission changes and moderation decisions can be undone from the toast. Confirmation dialogs are kept for things that can't be undone, such as deleting a role or redeeming points.
- **Familiar controls.** It uses segmented controls, iOS switches, grouped inset lists (like Settings), tokens in the recipient field, an activity-ring level card and a ⌘K command palette.
- **Keyboard first.**

  | Shortcut | Action |
  |---|---|
  | ⌘K / Ctrl+K | Search people, pages and actions |
  | ⌘J / Ctrl+J | Recognize someone from anywhere |
  | ⌘↵ | Send |
  | ? | Show shortcuts |
  | Esc | Close sheets |

- **Appearance.** Automatic, Light or Dark per person, applied instantly with no reload.
- **Accessible.** Pages use semantic landmarks, labelled controls, `role="switch"` and `aria-checked`, visible focus rings, and touch targets of 36 to 44 px.

---

## Project structure

All components are `.jsx`, everything else `.js`. The `@/` import alias is set in `jsconfig.json`.

```
app/
  (app)/                 signed-in area (layout loads the shell data once)
    home/ people/ posts/ badges/ rewards/ leaderboard/ notifications/ settings/
    team/                needs team.view
    admin/               overview, users, roles, levels, badges, points (Points Rules), rewards, moderation, settings, audit
  api/uploads/[id]/      serves post photos to signed-in people
  login/                 sign-in with demo accounts
  actions.js             every mutation, as server actions, each permission-checked and validated with zod
  globals.css            design tokens (light + dark) and controls
  shell.css, pages.css   app shell and page patterns
components/
  shell/                 sidebar, tab bar, command palette, Recognize sheet, shortcuts, toasts
  GettingStarted, NeedsYou, PageHelp, PostCard, LevelCard, Avatar, Icon, …
db/
  schema.js              Drizzle schema (users, roles, posts, ledger, rewards, notifications, audit…)
  seed.js                sample company
  seed-images/           original sample illustrations attached to demo posts
lib/
  auth.js                current user, requireUser / requirePermission / assertPermission
  session.js             signed httpOnly session cookie (jose)
  permissions.js         the permission catalogue
  queries.js, analytics.js
  help.js                plain-language help text for every page
  autopoints.js          birthday, anniversary and welcome bonuses
  uploads.js             saving, attaching and cleaning up post photos (stored in the database)
```

### Security notes

- Passwords are hashed with bcrypt. Sessions are signed JWTs in `httpOnly`, `sameSite=lax` cookies, and are `secure` in production.
- Every page checks permissions on the server (`requirePermission`), and so does every server action (`assertPermission`). Hiding a button in the UI is never the only protection.
- Input is validated with zod on the server.
- Deactivated users can't sign in, and their existing sessions stop working on the next request.
"# ava-wallOfFrame" 
