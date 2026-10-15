// The full permission catalogue. Roles are rows in the database that hold a subset of these keys.
// Admins edit roles in Admin → Roles; code only ever checks keys, never role names.

export const PERMISSION_GROUPS = [
  {
    group: "Recognition",
    items: [
      { key: "recognition.give", label: "Give appreciation", hint: "Post appreciations and send points" },
      { key: "feed.comment", label: "Comment & react", hint: "Comment on and react to posts" },
      { key: "feed.announce", label: "Post announcements", hint: "Company-wide announcement posts" },
      { key: "rewards.redeem", label: "Redeem rewards", hint: "Spend points in the rewards store" },
    ],
  },
  {
    group: "People",
    items: [
      { key: "team.view", label: "View own team", hint: "See direct reports and their activity" },
      { key: "team.nudge", label: "Nudge team", hint: "Send reminders to quiet team members" },
      { key: "badges.award", label: "Award badges", hint: "Award badges to anyone directly" },
    ],
  },
  {
    group: "Administration",
    items: [
      { key: "analytics.view", label: "View analytics", hint: "Company-wide recognition dashboard" },
      { key: "users.manage", label: "Manage users", hint: "Invite, edit and deactivate people" },
      { key: "roles.manage", label: "Manage roles", hint: "Create roles and edit permissions" },
      { key: "levels.manage", label: "Manage levels", hint: "Edit level thresholds and perks" },
      { key: "badges.manage", label: "Manage badges", hint: "Create, edit and retire badges" },
      { key: "rewards.manage", label: "Manage rewards", hint: "Edit catalogue, approve redemptions" },
      { key: "moderation.manage", label: "Moderate content", hint: "Review reported posts" },
      { key: "settings.manage", label: "Company settings", hint: "Company name, values and self-recognition" },
      {
        key: "points.manage",
        label: "Set point rules",
        hint: "How many points are given automatically, budgets and manual adjustments",
        superAdminOnly: true,
      },
      { key: "audit.view", label: "View audit log", hint: "See who changed what" },
    ],
  },
];

export const ALL_PERMISSIONS = PERMISSION_GROUPS.flatMap((g) => g.items.map((i) => i.key));

/** Permissions only the Super Admin can ever hold. Other roles can't be given them. */
export const SUPER_ADMIN_ONLY = PERMISSION_GROUPS.flatMap((g) => g.items.filter((i) => i.superAdminOnly).map((i) => i.key));

export function isPermission(v) {
  return ALL_PERMISSIONS.includes(v);
}
