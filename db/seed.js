/* Seeds a realistic company: departments, roles, people, levels, badges, rewards and ~2 months of activity.
   Run with `npm run setup` (creates tables and seeds) or `npm run db:seed` (re-seed only). */
import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import bcrypt from "bcryptjs";
import fs from "node:fs";
import path from "node:path";
import * as s from "./schema";
import { ALL_PERMISSIONS } from "../lib/permissions";

// Use the same settings as the app: .env.local (if present) can point at a hosted Turso database.
try {
  process.loadEnvFile(".env.local");
} catch {}
const url = (process.env.DATABASE_URL || process.env.TURSO_DATABASE_URL) ?? "file:./data/app.db";
if (url.startsWith("file:")) fs.mkdirSync("data", { recursive: true });
const db = drizzle(createClient({ url, authToken: process.env.DATABASE_AUTH_TOKEN || process.env.TURSO_AUTH_TOKEN }), { schema: s });

const DAY = 86_400_000;
const ago = (days, hours = 0) => new Date(Date.now() - days * DAY - hours * 3_600_000);
const uid = () => crypto.randomUUID();

async function main() {
  // Clear in dependency order so the seed can be re-run.
  for (const t of [
    s.memories,
    s.auditLogs,
    s.reports,
    s.notifications,
    s.redemptions,
    s.pointLedger,
    s.comments,
    s.reactions,
    s.postRecipients,
    s.postImages,
    s.posts,
    s.userBadges,
    s.users,
    s.rewards,
    s.badges,
    s.companyValues,
    s.levels,
    s.roles,
    s.departments,
    s.settings,
  ]) {
    await db.delete(t);
  }

  // ---------- Departments ----------
  const deptNames = ["Design", "Engineering", "Product", "Sales", "Operations", "People & HR", "Finance"];
  const dept = {};
  for (const name of deptNames) {
    dept[name] = uid();
    await db.insert(s.departments).values({ id: dept[name], name });
  }

  // ---------- Roles ----------
  const role = {
    employee: uid(),
    manager: uid(),
    hr: uid(),
    superAdmin: uid(),
    teamLead: uid(),
  };
  await db.insert(s.roles).values([
    {
      id: role.employee,
      name: "Employee",
      description: "Everyone. Give and receive recognition, redeem rewards.",
      color: "#6B7280",
      isSystem: true,
      permissions: ["recognition.give", "feed.comment", "rewards.redeem"],
    },
    {
      id: role.manager,
      name: "Manager",
      description: "Leads a team. Sees team activity and nudges quiet members.",
      color: "#0891B2",
      isSystem: true,
      permissions: ["recognition.give", "feed.comment", "rewards.redeem", "team.view", "team.nudge", "badges.award"],
    },
    {
      id: role.hr,
      name: "HR Admin",
      description: "Runs the programme: people, rewards, levels and moderation.",
      color: "#7C3AED",
      isSystem: true,
      permissions: [
        "recognition.give",
        "feed.comment",
        "feed.announce",
        "rewards.redeem",
        "team.view",
        "badges.award",
        "badges.manage",
        "analytics.view",
        "users.manage",
        "levels.manage",
        "rewards.manage",
        "moderation.manage",
        "audit.view",
      ],
    },
    {
      id: role.superAdmin,
      name: "Super Admin",
      description: "Full access, including roles and company settings.",
      color: "#DC2626",
      isSystem: true,
      permissions: [...ALL_PERMISSIONS],
    },
    {
      id: role.teamLead,
      name: "Team Lead",
      description: "Custom role: a senior IC who can see their team but not nudge.",
      color: "#D97706",
      isSystem: false,
      permissions: ["recognition.give", "feed.comment", "rewards.redeem", "team.view", "badges.award"],
    },
  ]);

  // ---------- Levels ----------
  await db.insert(s.levels).values([
    { name: "Bronze", minPoints: 0, color: "#B45309", perk: "Welcome kit and profile badge" },
    { name: "Silver", minPoints: 500, color: "#6B7280", perk: "Monthly coffee voucher" },
    { name: "Gold", minPoints: 1500, color: "#D97706", perk: "+1 learning day per quarter" },
    { name: "Platinum", minPoints: 3000, color: "#4F46E5", perk: "Lunch with leadership and an extra day off" },
  ]);

  // ---------- Values ----------
  const valueNames = [
    ["Teamwork", "Lifting each other up and sharing the load"],
    ["Ownership", "Seeing things through, end to end"],
    ["Customer first", "Starting from what the customer needs"],
    ["Innovation", "Trying a better way"],
    ["Going extra mile", "Effort beyond what was asked"],
  ];
  const val = {};
  for (const [name, description] of valueNames) {
    val[name] = uid();
    await db.insert(s.companyValues).values({ id: val[name], name, description });
  }

  // ---------- Badges ----------
  const badgeRows = [
    ["Velocity Engine", "Ships consistently, on time", "Delivery", "bolt", "#3355E6", 50],
    ["Code Crafter", "Quality, reviewed, maintainable work", "Delivery", "code", "#3355E6", 50],
    ["Architect", "Designed a system others build on", "Delivery", "layers", "#3355E6", 100],
    ["Scribe", "Writes docs people actually use", "Remote Work", "book", "#059669", 50],
    ["Async Master", "Keeps work moving across time zones", "Remote Work", "clock", "#059669", 50],
    ["Librarian", "Turns knowledge into reusable resources", "Remote Work", "book", "#059669", 100],
    ["Navigator", "Guides people through ambiguity", "Mentorship", "compass", "#D97706", 50],
    ["Gatekeeper", "Raises the bar on standards", "Mentorship", "shield", "#D97706", 50],
    ["Coach", "Helped someone level up", "Mentorship", "heart", "#D97706", 100],
    ["Alchemist", "Turned an idea into a prototype", "Innovation", "flask", "#7C3AED", 50],
    ["Automator", "Automated away repetitive work", "Innovation", "cpu", "#7C3AED", 100],
    ["Kudos Beacon", "Recognises others generously", "Culture", "star", "#DB2777", 50],
    ["Gatherer", "Brings people together", "Culture", "users", "#DB2777", 50],
    ["Client Champion", "Went above and beyond for a client", "Culture", "award", "#DB2777", 100],
    ["Milestone Tracker", "Celebrated a work anniversary", "Tenure", "calendar", "#0891B2", 50],
    ["Vault Keeper", "Three years and counting", "Tenure", "key", "#0891B2", 150],
  ];
  const criteria = {
    "Velocity Engine": "Ship 5 planned items on or before their due date in a quarter.",
    "Code Crafter": "Keep a 90%+ approval rate across 20 reviewed pull requests or designs.",
    Architect: "Design a system or framework that at least two other teams build on.",
    Scribe: "Write 3 docs or guides that others reference.",
    "Async Master": "Move a cross–time-zone project forward without needing a meeting.",
    Librarian: "Create a shared resource used by 10+ people.",
    Navigator: "Guide a teammate or team through an unclear problem to a decision.",
    Gatekeeper: "Raise the quality bar through consistent, kind reviews.",
    Coach: "Help someone reach the next level in their role.",
    Alchemist: "Turn an idea into a working prototype.",
    Automator: "Automate a task that saves the team hours every week.",
    "Kudos Beacon": "Recognise 10 different people.",
    Gatherer: "Organise an event that brings people together.",
    "Client Champion": "Go above and beyond for a client, noticed by them.",
    "Milestone Tracker": "Celebrate your first work anniversary.",
    "Vault Keeper": "Three years at the company.",
  };
  const badge = {};
  for (const [name, description, category, icon, color, points] of badgeRows) {
    badge[name] = uid();
    await db.insert(s.badges).values({ id: badge[name], name, description, category, icon, color, points, criteria: criteria[name] ?? "" });
  }

  // ---------- Rewards ----------
  await db.insert(s.rewards).values([
    { name: "Donate to a cause", description: "We donate ₹250 to a charity you choose", category: "Give back", icon: "heart", cost: 250 },
    {
      name: "Coffee with leadership",
      description: "30 minutes with a member of the leadership team",
      category: "Experiences",
      icon: "coffee",
      cost: 400,
    },
    { name: "Shopping voucher ₹500", description: "Digital voucher sent to your email", category: "Vouchers", icon: "gift", cost: 500 },
    { name: "Learning budget ₹2,000", description: "Courses, books or certifications", category: "Learning", icon: "book", cost: 600 },
    { name: "Half-day off", description: "Take an afternoon, on us", category: "Time off", icon: "sun", cost: 800 },
    { name: "Team lunch on us", description: "Lunch for your team of up to 8", category: "Experiences", icon: "users", cost: 900 },
    { name: "Extra day off", description: "One additional paid day off", category: "Time off", icon: "calendar", cost: 1500 },
    { name: "Conference ticket", description: "A ticket to a conference of your choice", category: "Learning", icon: "rocket", cost: 2500 },
  ]);

  // ---------- People ----------
  const hash = await bcrypt.hash("avazone123", 10);

  const people = [
    {
      key: "nikhil",
      name: "Nikhil Rana",
      email: "nikhil@avadhesh.co",
      title: "Head of Product & Design",
      dept: "Product",
      role: role.superAdmin,
      city: "Bengaluru",
      joinedDaysAgo: 1150,
      bio: "Building tools that make good work visible.",
    },
    {
      key: "priya",
      name: "Priya Sharma",
      email: "priya@avadhesh.co",
      title: "People Partner",
      dept: "People & HR",
      role: role.hr,
      manager: "nikhil",
      city: "Delhi",
      joinedDaysAgo: 720,
      bio: "Making AvadheshCo a place people love to work.",
    },
    {
      key: "syed",
      name: "Syed Amjad",
      email: "syed@avadhesh.co",
      title: "Design Lead",
      dept: "Design",
      role: role.manager,
      manager: "nikhil",
      city: "Bengaluru",
      joinedDaysAgo: 460,
      bio: "Passionate about meaningful user experiences and solving real-world problems through design.",
    },
    {
      key: "apurva",
      name: "Apurva Goswami",
      email: "apurva@avadhesh.co",
      title: "Engineering Manager",
      dept: "Engineering",
      role: role.manager,
      manager: "nikhil",
      city: "Pune",
      joinedDaysAgo: 900,
    },
    {
      key: "kannha",
      name: "Kannha Salooja",
      email: "kannha@avadhesh.co",
      title: "Product Designer",
      dept: "Design",
      role: role.employee,
      manager: "syed",
      city: "Bengaluru",
      joinedDaysAgo: 380,
    },
    {
      key: "sara",
      name: "Sara Khan",
      email: "sara@avadhesh.co",
      title: "UI Designer",
      dept: "Design",
      role: role.employee,
      manager: "syed",
      city: "Mumbai",
      joinedDaysAgo: 55,
    },
    {
      key: "riya",
      name: "Riya Sen",
      email: "riya@avadhesh.co",
      title: "UX Researcher",
      dept: "Design",
      role: role.employee,
      manager: "syed",
      city: "Kolkata",
      joinedDaysAgo: 210,
    },
    {
      key: "meera",
      name: "Meera Iyer",
      email: "meera@avadhesh.co",
      title: "Staff Engineer",
      dept: "Engineering",
      role: role.teamLead,
      manager: "apurva",
      city: "Chennai",
      joinedDaysAgo: 1300,
    },
    {
      key: "dev",
      name: "Dev Patel",
      email: "dev@avadhesh.co",
      title: "Frontend Engineer",
      dept: "Engineering",
      role: role.employee,
      manager: "apurva",
      city: "Ahmedabad",
      joinedDaysAgo: 160,
    },
    {
      key: "nisha",
      name: "Nisha Kapoor",
      email: "nisha@avadhesh.co",
      title: "Backend Engineer",
      dept: "Engineering",
      role: role.employee,
      manager: "apurva",
      city: "Pune",
      joinedDaysAgo: 300,
    },
    {
      key: "arjun",
      name: "Arjun Rao",
      email: "arjun@avadhesh.co",
      title: "DevOps Engineer",
      dept: "Engineering",
      role: role.employee,
      manager: "apurva",
      city: "Hyderabad",
      joinedDaysAgo: 20,
    },
    {
      key: "nitin",
      name: "Nitin Verma",
      email: "nitin@avadhesh.co",
      title: "Account Executive",
      dept: "Sales",
      role: role.employee,
      manager: "nikhil",
      city: "Delhi",
      joinedDaysAgo: 400,
    },
    {
      key: "james",
      name: "James Lee",
      email: "james@avadhesh.co",
      title: "Operations Manager",
      dept: "Operations",
      role: role.employee,
      manager: "nikhil",
      city: "Bengaluru",
      joinedDaysAgo: 1093,
    },
    {
      key: "amit",
      name: "Amit Joshi",
      email: "amit@avadhesh.co",
      title: "Finance Analyst",
      dept: "Finance",
      role: role.employee,
      manager: "nikhil",
      city: "Mumbai",
      joinedDaysAgo: 600,
    },
  ];
  // Birthdays are stored as "MM-DD". Kannha's birthday and Apurva's 2-year work anniversary fall on the day you seed,
  // so the automatic points can be seen straight away.
  const md = (d) => `${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  const inDays = (n) => md(new Date(Date.now() + n * DAY));
  const yearsAgo = (n) => {
    const d = new Date();
    d.setFullYear(d.getFullYear() - n);
    return Math.round((Date.now() - d.getTime()) / DAY);
  };
  const extra = {
    nikhil: { birthday: "03-14", phone: "+91 98450 11201" },
    priya: { birthday: inDays(4), phone: "+91 98450 11202" },
    syed: { birthday: "11-22", phone: "+91 98450 11203" },
    apurva: { birthday: "07-09", phone: "+91 98450 11204", joinedDaysAgo: yearsAgo(2) },
    kannha: { birthday: inDays(0), phone: "+91 98450 11205" },
    sara: { birthday: inDays(12), phone: "+91 98450 11206" },
    riya: { birthday: "05-30", phone: "+91 98450 11207" },
    meera: { birthday: "09-02", phone: "+91 98450 11208" },
    dev: { birthday: "12-18", phone: "+91 98450 11209" },
    nisha: { birthday: inDays(21), phone: "+91 98450 11210" },
    arjun: { birthday: "02-27", phone: "+91 98450 11211" },
    nitin: { birthday: "08-15", phone: "+91 98450 11212" },
    james: { birthday: "06-06", phone: "+91 98450 11213" },
    amit: { birthday: "01-19", phone: "+91 98450 11214" },
  };
  people.forEach((p, i) => Object.assign(p, extra[p.key], { employeeCode: `AVZ-${String(101 + i).padStart(3, "0")}` }));

  const u = {};
  for (const p of people) u[p.key] = uid();
  for (const p of people) {
    await db.insert(s.users).values({
      id: u[p.key],
      name: p.name,
      email: p.email,
      passwordHash: hash,
      title: p.title,
      bio: p.bio ?? "",
      city: p.city,
      phone: p.phone ?? "",
      birthday: p.birthday ?? "",
      employeeCode: p.employeeCode,
      departmentId: dept[p.dept],
      managerId: p.manager ? u[p.manager] : null,
      roleId: p.role,
      joinedAt: ago(p.joinedDaysAgo),
      lastSeenAt: ago(Math.random() * 3),
    });
  }

  // Historical points (before the window we simulate) so levels are spread out.
  const history = {
    nikhil: 2950,
    priya: 1300,
    syed: 1180,
    apurva: 1150,
    kannha: 620,
    meera: 1900,
    riya: 340,
    nisha: 480,
    dev: 210,
    nitin: 520,
    james: 1450,
    amit: 380,
  };
  for (const [k, pts] of Object.entries(history)) {
    await db.insert(s.pointLedger).values({ userId: u[k], delta: pts, reason: "adjustment", note: "Opening balance", createdAt: ago(70) });
  }

  // ---------- Activity ----------
  async function appreciate(from, to, value, body, points, daysAgo, opts = {}) {
    const postId = uid();
    const at = opts.at ?? ago(daysAgo, Math.floor(Math.random() * 8));
    await db.insert(s.posts).values({
      id: postId,
      authorId: u[from],
      kind: "appreciation",
      body,
      valueId: val[value],
      badgeId: opts.badge ? badge[opts.badge] : null,
      pointsEach: points,
      createdAt: at,
    });
    for (const r of to) {
      await db.insert(s.postRecipients).values({ postId, userId: u[r] });
      if (points)
        await db.insert(s.pointLedger).values({ userId: u[r], delta: points, reason: "appreciation", refId: postId, createdAt: at });
      if (opts.badge) {
        await db
          .insert(s.userBadges)
          .values({ userId: u[r], badgeId: badge[opts.badge], awardedById: u[from], awardedAt: at })
          .onConflictDoNothing();
      }
    }
    for (const r of opts.reactors ?? []) await db.insert(s.reactions).values({ postId, userId: u[r] });
    let i = 1;
    for (const [who, text] of opts.comments ?? []) {
      await db.insert(s.comments).values({ postId, authorId: u[who], body: text, createdAt: new Date(at.getTime() + i++ * 1_800_000) });
    }
    return postId;
  }

  async function milestone(author, body, daysAgo, reactors = [], kind = "milestone", badgeName) {
    const postId = uid();
    await db
      .insert(s.posts)
      .values({ id: postId, authorId: u[author], kind, body, badgeId: badgeName ? badge[badgeName] : null, createdAt: ago(daysAgo, 3) });
    for (const r of reactors) await db.insert(s.reactions).values({ postId, userId: u[r] });
    return postId;
  }

  // Sample photos (original illustrations in db/seed-images), stored in the database like real uploads.
  const SIZES = {
    "affinity-map": [1600, 1000],
    "ci-green": [1600, 1000],
    "three-years": [1600, 1200],
    "campus-day": [1600, 1000],
    "client-slide": [1600, 900],
    "deal-signed": [1600, 1000],
    certificate: [1000, 1000],
    "meetup-talk": [1000, 1000],
    hackathon: [1000, 1000],
    offsite: [1000, 1000],
    "figma-tokens": [1000, 1000],
    prototype: [1000, 1000],
    "welcome-week": [1000, 1000],
  };
  async function photos(postId, uploader, names) {
    for (const [position, name] of names.entries()) {
      const id = uid();
      const fileName = `${id}.jpg`;
      const data = fs.readFileSync(path.join("db", "seed-images", `${name}.jpg`));
      const [width, height] = SIZES[name];
      await db.insert(s.postImages).values({
        id,
        postId,
        uploaderId: u[uploader],
        fileName,
        mime: "image/jpeg",
        data,
        width,
        height,
        size: data.length,
        position,
      });
    }
  }

  async function award(user, badgeName, by, daysAgo) {
    await db
      .insert(s.userBadges)
      .values({ userId: u[user], badgeId: badge[badgeName], awardedById: u[by], awardedAt: ago(daysAgo) })
      .onConflictDoNothing();
    const pts = badgeRows.find((b) => b[0] === badgeName)[5];
    await db
      .insert(s.pointLedger)
      .values({ userId: u[user], delta: pts, reason: "badge", refId: badge[badgeName], createdAt: ago(daysAgo) });
  }

  await award("meera", "Architect", "apurva", 50);
  await award("meera", "Librarian", "apurva", 40);
  await award("syed", "Scribe", "nikhil", 45);
  await award("syed", "Navigator", "nikhil", 30);
  await award("kannha", "Code Crafter", "syed", 35);
  await award("james", "Vault Keeper", "priya", 28);
  await award("dev", "Velocity Engine", "apurva", 25);
  await award("nisha", "Automator", "meera", 18);
  await award("riya", "Gatekeeper", "syed", 12);
  await award("priya", "Gatherer", "nikhil", 9);
  await award("sara", "Alchemist", "syed", 6);

  await milestone(
    "priya",
    "Welcome to Wall of Frames! 🎉 This is where we say thank you, celebrate milestones and see the great work happening across AvadheshCo. Start by recognising someone who helped you this week.",
    58,
    ["nikhil", "syed", "apurva", "meera", "james"],
    "announcement"
  );
  const pRiya = await appreciate(
    "syed",
    ["riya"],
    "Customer first",
    "Your interview synthesis changed the direction of the onboarding redesign. Clear, evidence-backed and honest about what we don't know yet.",
    20,
    42,
    { reactors: ["kannha", "sara", "nikhil"], comments: [["kannha", "The affinity map was so useful!"]] }
  );
  await appreciate(
    "apurva",
    ["nisha"],
    "Ownership",
    "Nisha owned the payment-retry migration end to end, including the 2 a.m. rollback plan we thankfully never needed.",
    50,
    36,
    { badge: "Automator", reactors: ["meera", "dev", "arjun", "nikhil"] }
  );
  await appreciate(
    "nitin",
    ["james"],
    "Customer first",
    "James re-routed three delayed shipments for our biggest client in a single afternoon. They noticed — and renewed.",
    20,
    31,
    { reactors: ["amit", "priya"] }
  );
  const pJames = await milestone(
    "james",
    "Celebrating 3 years at AvadheshCo today. Thank you to everyone who made it a great ride! 🎂",
    28,
    ["nikhil", "priya", "nitin", "amit", "syed", "apurva", "meera"],
    "milestone"
  );
  const pCi = await appreciate(
    "meera",
    ["dev", "nisha"],
    "Teamwork",
    "Thank you both for pairing on the flaky test suite. CI is green for a full week for the first time this year.",
    20,
    24,
    {
      reactors: ["apurva", "arjun"],
      comments: [
        ["dev", "Team effort 🙌"],
        ["apurva", "This saved everyone hours a day."],
      ],
    }
  );
  await appreciate(
    "nikhil",
    ["syed"],
    "Innovation",
    "The new design QA workflow caught 40+ issues before handoff on the Grync launch. Exactly the kind of leverage we need.",
    50,
    20,
    { badge: "Navigator", reactors: ["kannha", "sara", "riya", "priya"] }
  );
  const pCampus = await appreciate(
    "priya",
    ["nitin"],
    "Going extra mile",
    "Nitin volunteered to run the campus hiring day and pitched AvadheshCo to 200+ students. Huge thanks.",
    20,
    16,
    { reactors: ["nikhil", "amit"] }
  );
  await appreciate(
    "kannha",
    ["sara"],
    "Teamwork",
    "Sara jumped into the design system audit in her second week and fixed 60 detached components. Welcome to the team!",
    10,
    12,
    { reactors: ["syed", "riya"], comments: [["sara", "Thank you! Learning so much already."]] }
  );
  await milestone(
    "kannha",
    "Earned the Code Crafter badge for consistent peer review excellence over the last 6 months.",
    10,
    ["syed", "sara", "riya", "nikhil"],
    "badge",
    "Code Crafter"
  );
  await appreciate(
    "apurva",
    ["arjun"],
    "Ownership",
    "Arjun set up preview deployments for every pull request in his first two weeks. Reviews are so much faster now.",
    20,
    6,
    { reactors: ["dev", "nisha", "meera"] }
  );
  const pClient = await appreciate(
    "syed",
    ["kannha"],
    "Customer first",
    "Great job on the client presentation! Your attention to detail really helped us close the deal. Proud to have you on the team.",
    20,
    2,
    {
      badge: "Client Champion",
      reactors: ["sara", "riya", "nikhil", "priya", "apurva"],
      comments: [
        ["nikhil", "The competitor comparison slide was the turning point. 👏"],
        ["kannha", "Couldn't have done it without the design team's mockups."],
      ],
    }
  );
  await appreciate(
    "apurva",
    ["syed", "kannha"],
    "Teamwork",
    "Thank you both for pulling the client demo together in two days. The walkthrough was clear and the client signed off on the spot.",
    20,
    0,
    { reactors: ["meera", "dev"] }
  );

  await photos(pRiya, "syed", ["affinity-map"]);
  await photos(pJames, "james", ["three-years"]);
  await photos(pCi, "meera", ["ci-green"]);
  await photos(pCampus, "priya", ["campus-day"]);
  await photos(pClient, "syed", ["client-slide", "deal-signed"]);

  // ---------- Memory Wall: moments people pinned themselves ----------
  // (Badges, thank-yous, level-ups, birthdays and anniversaries appear on the wall automatically.)
  async function pin(who, kind, title, detail, daysAgo, imageName, at) {
    const id = uid();
    let imageId = null;
    if (imageName) {
      imageId = uid();
      const data = fs.readFileSync(path.join("db", "seed-images", `${imageName}.jpg`));
      const [width, height] = SIZES[imageName];
      await db.insert(s.postImages).values({
        id: imageId,
        memoryId: id,
        uploaderId: u[who],
        fileName: `${imageId}.jpg`,
        mime: "image/jpeg",
        data,
        width,
        height,
        size: data.length,
      });
    }
    await db
      .insert(s.memories)
      .values({ id, userId: u[who], kind, title, detail, imageId, occurredAt: at ?? ago(daysAgo, 2), createdById: u[who] });
  }
  await pin(
    "kannha",
    "skill",
    "Prototyping in code (React)",
    "Rebuilt our onboarding prototype in React so usability tests felt real.",
    230,
    "prototype"
  );
  await pin("kannha", "moment", "Team offsite in Coorg", "Sunrise trek with the design team. Best two days of the year.", 150, "offsite");
  await pin(
    "kannha",
    "skill",
    "Figma variables & modes",
    "Moved the design system to variables — light and dark themes from one file.",
    25,
    "figma-tokens"
  );
  await pin(
    "kannha",
    "achievement",
    "Led my first client presentation",
    "Walked the client through the redesign — they signed off in the room.",
    2
  );
  await pin(
    "riya",
    "certification",
    "Advanced Accessibility · WCAG 2.2",
    "Six-week course; already using it in our audits.",
    18,
    "certificate"
  );
  await pin("syed", "achievement", "Spoke at a design meetup", "“Design QA at scale” — 120 people, great questions.", 14, "meetup-talk");
  await pin("nisha", "achievement", "Won Hack Day", "Smart retry queue for payments, built in 36 hours with Dev.", 40, "hackathon");
  await pin("dev", "skill", "Rust basics", "Finished the ownership chapter and rewrote a CLI tool.", 9);
  await pin("meera", "certification", "Cloud architecture certification", "Passed on the first attempt.", 60);
  // ---------- “On this day”: moments from exactly one and two years ago today ----------
  const sameDay = (yearsBack) => {
    const d = new Date();
    return new Date(d.getFullYear() - yearsBack, d.getMonth(), d.getDate(), 12);
  };
  await pin(
    "kannha",
    "moment",
    "My first week at AvadheshCo",
    "Welcome kit, a desk plant and the best coffee machine in Bengaluru.",
    0,
    "welcome-week",
    sameDay(1)
  );
  await pin(
    "kannha",
    "skill",
    "Our design system, inside out",
    "Built my first screen entirely from library components.",
    0,
    null,
    sameDay(1)
  );
  await appreciate(
    "syed",
    ["kannha"],
    "Teamwork",
    "Two weeks in and your first design critique was already spot on. So glad you joined us!",
    20,
    0,
    { at: sameDay(1), reactors: ["nikhil", "riya"] }
  );
  await pin(
    "nikhil",
    "achievement",
    "Kicked off Wall of Frames in Figma",
    "First sketches of a place where good work gets seen.",
    0,
    "affinity-map",
    sameDay(1)
  );
  await pin("nikhil", "achievement", "Set up the Product & Design team", "Three of us and a whiteboard.", 0, null, sameDay(2));

  // Kannha's first work anniversary was paid automatically a couple of weeks ago.
  await db.insert(s.pointLedger).values({
    userId: u["kannha"],
    delta: 100,
    reason: "auto",
    refId: `auto:anniversary:${new Date().getFullYear()}:${u["kannha"]}`,
    note: "1-year work anniversary",
    createdAt: ago(15),
  });

  // ---------- Redemptions ----------
  const rewardRows = await db.select().from(s.rewards);
  const r = (name) => rewardRows.find((x) => x.name === name);
  const redeem = async (who, name, status, daysAgo, by) => {
    const rw = r(name);
    const id = uid();
    await db.insert(s.redemptions).values({
      id,
      userId: u[who],
      rewardId: rw.id,
      cost: rw.cost,
      status,
      createdAt: ago(daysAgo),
      decidedById: by ? u[by] : null,
      decidedAt: by ? ago(daysAgo - 1) : null,
    });
    await db.insert(s.pointLedger).values({ userId: u[who], delta: -rw.cost, reason: "redemption", refId: id, createdAt: ago(daysAgo) });
    if (status === "rejected")
      await db.insert(s.pointLedger).values({ userId: u[who], delta: rw.cost, reason: "refund", refId: id, createdAt: ago(daysAgo - 1) });
  };
  await redeem("syed", "Learning budget ₹2,000", "approved", 12, "priya");
  await redeem("james", "Coffee with leadership", "approved", 20, "priya");
  await redeem("meera", "Half-day off", "pending", 2);
  await redeem("nisha", "Shopping voucher ₹500", "pending", 1);

  // ---------- Notifications (for the demo accounts) ----------
  const note = (to, kind, title, actor, daysAgo, read = false, link = "/home") =>
    db
      .insert(s.notifications)
      .values({ userId: u[to], kind, title, actorId: actor ? u[actor] : null, link, read, createdAt: ago(daysAgo) });
  await note("kannha", "appreciation", "Apurva Goswami appreciated you for Teamwork (+20 points)", "apurva", 0);
  await note("kannha", "appreciation", "Syed Amjad appreciated you for Customer first and gave you the Client Champion badge", "syed", 2);
  await note("kannha", "comment", "Nikhil Rana commented on a post about you", "nikhil", 2);
  await note("syed", "appreciation", "Apurva Goswami appreciated you for Teamwork (+20 points)", "apurva", 0);
  await note("syed", "reward", "Your Learning budget ₹2,000 redemption was approved", "priya", 11, true, "/rewards");
  await note("priya", "reward", "2 reward redemptions are waiting for approval", null, 1, false, "/admin/rewards");
  await note("nikhil", "system", "1 post was reported and needs review", null, 1, false, "/admin/moderation");
  await note("apurva", "nudge", "Arjun Rao joined 20 days ago — he's had 1 appreciation so far", null, 3, false, "/team");

  // ---------- Reports ----------
  const reported = await milestone(
    "nitin",
    "Who keeps taking the last coffee pods? 😤 Some of us have deadlines.",
    1,
    ["amit"],
    "milestone"
  );
  await db.insert(s.reports).values({ postId: reported, reporterId: u["james"], reason: "Not appropriate for the recognition feed" });

  // ---------- Settings & audit ----------
  await db.insert(s.settings).values([
    { key: "company_name", value: "AvadheshCo" },
    { key: "monthly_budget", value: "200" },
    { key: "allow_self", value: "false" },
    // Points Rules — decided by the Super Admin.
    { key: "appreciation_points", value: "20" },
    { key: "badge_default_points", value: "50" },
    { key: "auto_welcome_on", value: "true" },
    { key: "auto_welcome_points", value: "100" },
    { key: "auto_birthday_on", value: "true" },
    { key: "auto_birthday_points", value: "50" },
    { key: "auto_anniversary_on", value: "true" },
    { key: "auto_anniversary_points", value: "100" },
  ]);
  // Arjun joined 20 days ago and got the automatic welcome bonus.
  await db.insert(s.pointLedger).values({
    userId: u["arjun"],
    delta: 100,
    reason: "auto",
    refId: `auto:welcome:${u["arjun"]}`,
    note: "Welcome bonus",
    createdAt: ago(20),
  });
  await db.insert(s.auditLogs).values([
    { actorId: u["nikhil"], action: "Created role", target: "Team Lead", createdAt: ago(40) },
    { actorId: u["priya"], action: "Created badge", target: "Client Champion", createdAt: ago(38) },
    { actorId: u["priya"], action: "Approved redemption", target: "Learning budget ₹2,000 · Syed Amjad", createdAt: ago(11) },
    { actorId: u["priya"], action: "Invited user", target: "Arjun Rao", createdAt: ago(20) },
    { actorId: u["nikhil"], action: "Changed point rules", target: "Monthly budget 150 → 200 · Birthday on", createdAt: ago(33) },
    { actorId: u["priya"], action: "Edited details", target: "Arjun Rao: phone, birthday", createdAt: ago(19) },
  ]);

  console.log(`Seeded ${people.length} people. Log in with any email above and password "avazone123".`);
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
