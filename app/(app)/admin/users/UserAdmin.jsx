"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Avatar } from "@/components/Avatar";
import { Icon } from "@/components/Icon";
import { useApp } from "@/components/shell/AppContext";
import { adjustPoints, getUserLedger, inviteUser, resetPassword, updateUser } from "@/app/actions";
import { timeAgo } from "@/lib/format";
import { PageHelp } from "@/components/PageHelp";

export function UserAdmin({ meId, users, roles, depts, assignable, welcomeBonus }) {
  const { toast } = useApp();
  const [editingId, setEditingId] = useState(null);
  const editing = users.find((u) => u.id === editingId) ?? null;
  const [q, setQ] = useState("");
  const [roleFilter, setRoleFilter] = useState("");
  const [status, setStatus] = useState("active");
  const [inviting, setInviting] = useState(false);
  const [secret, setSecret] = useState(null);
  const roleById = useMemo(() => new Map(roles.map((r) => [r.id, r])), [roles]);

  const shown = users.filter(
    (u) =>
      (status === "active" ? u.active : !u.active) &&
      (!roleFilter || u.roleId === roleFilter) &&
      (!q || `${u.name} ${u.email} ${u.title}`.toLowerCase().includes(q.toLowerCase()))
  );

  async function patch(u, data, label) {
    const r = await updateUser(u.id, data);
    toast(r.ok ? label : r.error, { tone: r.ok ? "default" : "error" });
  }

  return (
    <main className="page">
      <header className="page-head">
        <div>
          <h1 className="large-title">Users</h1>
          <p>
            {users.filter((u) => u.active).length} active · {users.filter((u) => !u.active).length} deactivated
          </p>
        </div>
        <PageHelp topic="admin-users" />
        <button className="btn btn-filled" onClick={() => setInviting(true)}>
          <Icon name="personPlus" size={16} /> Invite Person
        </button>
      </header>

      <div className="toolbar">
        <label className="search" style={{ width: 260 }}>
          <Icon name="search" size={16} />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search name, email or title" aria-label="Search users" />
        </label>
        <select
          className="field"
          style={{ width: 180, height: 36 }}
          value={roleFilter}
          onChange={(e) => setRoleFilter(e.target.value)}
          aria-label="Filter by role"
        >
          <option value="">All roles</option>
          {roles.map((r) => (
            <option key={r.id} value={r.id}>
              {r.name}
            </option>
          ))}
        </select>
        <div className="segmented" role="tablist" style={{ marginLeft: "auto" }}>
          <button role="tab" aria-selected={status === "active"} onClick={() => setStatus("active")}>
            Active
          </button>
          <button role="tab" aria-selected={status === "inactive"} onClick={() => setStatus("inactive")}>
            Deactivated
          </button>
        </div>
      </div>

      <div className="card" style={{ overflowX: "auto" }}>
        <table className="table">
          <thead>
            <tr>
              <th>Person</th>
              <th>Role</th>
              <th>Department</th>
              <th>Manager</th>
              <th>Last seen</th>
              <th style={{ textAlign: "center" }}>Active</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {shown.map((u) => {
              const role = roleById.get(u.roleId);
              const isMe = u.id === meId;
              return (
                <tr key={u.id}>
                  <td>
                    <Link href={`/people/${u.id}`} className="row" style={{ gap: 10 }}>
                      <Avatar name={u.name} size={32} />
                      <span style={{ minWidth: 0 }}>
                        <b style={{ fontSize: 14 }}>
                          {u.name} {isMe && <span className="tag tag-accent">You</span>}
                        </b>
                        <span className="caption" style={{ display: "block" }}>
                          {u.email}
                        </span>
                      </span>
                    </Link>
                  </td>
                  <td>
                    <span className="row" style={{ gap: 6 }}>
                      <span className="dot" style={{ background: role?.color }} />
                      <select
                        className="cell-select"
                        value={u.roleId}
                        disabled={isMe || !u.editable}
                        title={isMe ? "You can't change your own role" : !u.editable ? "Only the Super Admin can change this" : undefined}
                        onChange={(e) =>
                          patch(u, { roleId: e.target.value }, `${u.name.split(" ")[0]} is now ${roleById.get(e.target.value)?.name}`)
                        }
                        aria-label={`Role for ${u.name}`}
                      >
                        {roles.map((r) => (
                          <option key={r.id} value={r.id} disabled={!assignable.includes(r.id) && r.id !== u.roleId}>
                            {r.name}
                          </option>
                        ))}
                      </select>
                    </span>
                  </td>
                  <td>
                    <select
                      className="cell-select"
                      value={u.departmentId ?? ""}
                      disabled={!u.editable}
                      onChange={(e) => patch(u, { departmentId: e.target.value || null }, "Department updated")}
                      aria-label={`Department for ${u.name}`}
                    >
                      <option value="">—</option>
                      {depts.map((d) => (
                        <option key={d.id} value={d.id}>
                          {d.name}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td>
                    <select
                      className="cell-select"
                      value={u.managerId ?? ""}
                      disabled={!u.editable}
                      onChange={(e) => patch(u, { managerId: e.target.value || null }, "Manager updated")}
                      aria-label={`Manager for ${u.name}`}
                    >
                      <option value="">No manager</option>
                      {users
                        .filter((m) => m.active && m.id !== u.id)
                        .map((m) => (
                          <option key={m.id} value={m.id}>
                            {m.name}
                          </option>
                        ))}
                    </select>
                  </td>
                  <td className="caption">{u.lastSeenAt ? timeAgo(u.lastSeenAt) : "Never"}</td>
                  <td style={{ textAlign: "center" }}>
                    <button
                      className="switch switch-sm"
                      role="switch"
                      aria-checked={u.active}
                      aria-label={`${u.name} active`}
                      disabled={isMe || !u.editable}
                      onClick={() =>
                        patch(u, { active: !u.active }, u.active ? `${u.name} deactivated — they can't sign in` : `${u.name} reactivated`)
                      }
                    />
                  </td>
                  <td>
                    {u.editable ? (
                      <button className="btn btn-tinted btn-sm" onClick={() => setEditingId(u.id)} aria-label={`Edit ${u.name}`}>
                        <Icon name="pencil" size={13} /> Edit
                      </button>
                    ) : (
                      <span className="caption row" style={{ gap: 4 }} title="Only the Super Admin can edit this person">
                        <Icon name="lock" size={13} /> Super Admin only
                      </span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {shown.length === 0 && (
          <div className="empty" style={{ padding: 32 }}>
            No one matches.
          </div>
        )}
      </div>

      {editing && (
        <EditPersonSheet
          key={editing.id}
          person={editing}
          isMe={editing.id === meId}
          roles={roles}
          assignable={assignable}
          depts={depts}
          users={users.filter((m) => m.active && m.id !== editing.id)}
          onClose={() => setEditingId(null)}
          onPassword={(sec) => setSecret(sec)}
        />
      )}

      {inviting && (
        <InviteSheet
          welcomeBonus={welcomeBonus}
          roles={roles.filter((r) => assignable.includes(r.id))}
          depts={depts}
          users={users.filter((u) => u.active)}
          onClose={() => setInviting(false)}
          onDone={(s) => {
            setInviting(false);
            setSecret(s);
          }}
        />
      )}

      {secret && (
        <>
          <div className="scrim" onClick={() => setSecret(null)} />
          <div
            className="sheet"
            style={{ width: "min(420px, calc(100vw - 32px))" }}
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="pw-title"
          >
            <div className="sheet-body" style={{ textAlign: "center", paddingTop: 28 }}>
              <span
                className="empty-icon"
                style={{
                  margin: "0 auto",
                  background: "var(--green-tint)",
                  color: "var(--green)",
                  width: 56,
                  height: 56,
                  borderRadius: 16,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Icon name="key" size={26} />
              </span>
              <h2 id="pw-title" className="title-3" style={{ marginTop: 14 }}>
                Temporary password for {secret.name.split(" ")[0]}
              </h2>
              <p className="subhead" style={{ marginTop: 6 }}>
                Share this privately. It&apos;s shown only once — they should change it in Settings after signing in.
              </p>
              <div className="secret-box">
                <span className="caption">{secret.email}</span>
                <code>{secret.password}</code>
              </div>
            </div>
            <div className="sheet-foot">
              <button
                className="btn btn-gray"
                style={{ flex: 1 }}
                onClick={() => {
                  navigator.clipboard?.writeText(`Email: ${secret.email}\nTemporary password: ${secret.password}`);
                  toast("Copied to clipboard");
                }}
              >
                <Icon name="copy" size={15} /> Copy
              </button>
              <button className="btn btn-filled" style={{ flex: 1 }} onClick={() => setSecret(null)}>
                Done
              </button>
            </div>
          </div>
        </>
      )}
    </main>
  );
}

function InviteSheet({ roles, depts, users, onClose, onDone, welcomeBonus }) {
  const employee = roles.find((r) => r.name === "Employee")?.id ?? roles[0]?.id ?? "";
  const [f, setF] = useState({ name: "", email: "", title: "", departmentId: "", managerId: "", roleId: employee });
  const [error, setError] = useState(null);
  const [pending, setPending] = useState(false);
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });

  async function submit() {
    setPending(true);
    setError(null);
    const r = await inviteUser({ ...f, departmentId: f.departmentId || null, managerId: f.managerId || null });
    setPending(false);
    if (!r.ok) return setError(r.error);
    onDone({ name: f.name, email: f.email.toLowerCase(), password: r.data.password });
  }

  return (
    <>
      <div className="scrim" onClick={onClose} />
      <div className="sheet" role="dialog" aria-modal="true" aria-labelledby="invite-title">
        <div className="sheet-head">
          <button className="btn btn-plain" onClick={onClose}>
            Cancel
          </button>
          <h2 id="invite-title">Invite Person</h2>
          <button className="btn btn-plain" style={{ fontWeight: 700 }} disabled={!f.name || !f.email || pending} onClick={submit}>
            Invite
          </button>
        </div>
        <div className="sheet-body form-grid">
          <label>
            <span className="field-label">Full name</span>
            <input className="field" value={f.name} onChange={set("name")} autoFocus />
          </label>
          <label>
            <span className="field-label">Work email</span>
            <input className="field" type="email" value={f.email} onChange={set("email")} placeholder="name@avadhesh.co" />
          </label>
          <label>
            <span className="field-label">Job title</span>
            <input className="field" value={f.title} onChange={set("title")} />
          </label>
          <label>
            <span className="field-label">Role</span>
            <select className="field" value={f.roleId} onChange={set("roleId")}>
              {roles.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span className="field-label">Department</span>
            <select className="field" value={f.departmentId} onChange={set("departmentId")}>
              <option value="">—</option>
              {depts.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span className="field-label">Manager</span>
            <select className="field" value={f.managerId} onChange={set("managerId")}>
              <option value="">No manager</option>
              {users.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name}
                </option>
              ))}
            </select>
          </label>
          {error && (
            <p className="rec-error" style={{ gridColumn: "1 / -1" }} role="alert">
              {error}
            </p>
          )}
          <p className="caption" style={{ gridColumn: "1 / -1" }}>
            We&apos;ll create the account and show you a one-time temporary password to share.
            {welcomeBonus > 0 && ` They'll get a ${welcomeBonus}-point welcome bonus automatically.`} You can add their birthday, phone and
            more later with Edit.
          </p>
        </div>
      </div>
    </>
  );
}

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const DAYS_IN = [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
const toDateInput = (ms) => {
  const d = new Date(ms);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};
const REASON_LABEL = {
  appreciation: "Appreciation",
  badge: "Badge",
  redemption: "Reward",
  refund: "Refund",
  adjustment: "Adjustment",
  auto: "Automatic",
};

/** HR and the Super Admin edit every detail of a person in one place. */
function EditPersonSheet({ person, isMe, roles, assignable, depts, users, onClose, onPassword }) {
  const { toast, can } = useApp();
  const start = {
    name: person.name,
    email: person.email,
    title: person.title,
    employeeCode: person.employeeCode,
    phone: person.phone,
    city: person.city,
    roleId: person.roleId,
    departmentId: person.departmentId ?? "",
    managerId: person.managerId ?? "",
    joinedAt: toDateInput(person.joinedAt),
    birthday: person.birthday,
  };
  const [f, setF] = useState(start);
  const [error, setError] = useState(null);
  const [pending, setPending] = useState(false);
  const [ledger, setLedger] = useState(null);
  const [adj, setAdj] = useState({ dir: "give", amount: "", note: "" });
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const dirty = JSON.stringify(f) !== JSON.stringify(start);
  const [bm, bd] = f.birthday ? f.birthday.split("-").map(Number) : [0, 0];
  const role = roles.find((r) => r.id === f.roleId);
  const canPoints = can("points.manage");

  useEffect(() => {
    getUserLedger(person.id).then((r) => r.ok && setLedger(r.data));
  }, [person.id]);

  useEffect(() => {
    const onKey = (e) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  function setBirthday(m, d) {
    if (!m) return setF({ ...f, birthday: "" });
    const day = Math.min(d || 1, DAYS_IN[m - 1]);
    setF({ ...f, birthday: `${String(m).padStart(2, "0")}-${String(day).padStart(2, "0")}` });
  }

  async function save() {
    setPending(true);
    setError(null);
    const patch = {};
    for (const k of Object.keys(f)) if (f[k] !== start[k]) patch[k] = f[k];
    if ("departmentId" in patch) patch.departmentId = patch.departmentId || null;
    if ("managerId" in patch) patch.managerId = patch.managerId || null;
    if ("joinedAt" in patch) {
      const [y, m, d] = patch.joinedAt.split("-").map(Number);
      patch.joinedAt = new Date(y, m - 1, d, 12).getTime();
    }
    const r = await updateUser(person.id, patch);
    setPending(false);
    if (!r.ok) return setError(r.error);
    toast(`${f.name.split(" ")[0]}'s details saved`);
    onClose();
  }

  async function applyPoints() {
    const n = Number(adj.amount);
    const r = await adjustPoints(person.id, { delta: adj.dir === "give" ? n : -n, note: adj.note });
    if (!r.ok) return toast(r.error, { tone: "error" });
    toast(adj.dir === "give" ? `Gave ${n} points to ${person.name.split(" ")[0]}` : `Took ${n} points from ${person.name.split(" ")[0]}`);
    setAdj({ dir: "give", amount: "", note: "" });
    const l = await getUserLedger(person.id);
    if (l.ok) setLedger(l.data);
  }

  return (
    <>
      <div className="scrim" onClick={onClose} />
      <div className="sheet edit-person" role="dialog" aria-modal="true" aria-labelledby="edit-title">
        <div className="sheet-head">
          <button className="btn btn-plain" onClick={onClose}>
            Cancel
          </button>
          <h2 id="edit-title">Edit Person</h2>
          <button className="btn btn-plain" style={{ fontWeight: 700 }} disabled={!dirty || pending} onClick={save}>
            {pending ? "Saving…" : "Save"}
          </button>
        </div>
        <div className="sheet-body">
          <div className="person-summary">
            <Avatar name={f.name || person.name} size={52} />
            <div style={{ minWidth: 0 }}>
              <b>{f.name || person.name}</b>
              <span className="caption">
                <span className="dot" style={{ background: role?.color, marginRight: 6 }} />
                {role?.name} · {person.active ? "Active" : "Deactivated"}
              </span>
            </div>
          </div>

          <section>
            <div className="form-section-title">Basic details</div>
            <div className="form-grid">
              <label>
                <span className="field-label">Full name</span>
                <input className="field" value={f.name} onChange={set("name")} autoComplete="off" />
              </label>
              <label>
                <span className="field-label">Work email</span>
                <input className="field" type="email" value={f.email} onChange={set("email")} autoComplete="off" />
              </label>
              <label>
                <span className="field-label">Job title</span>
                <input className="field" value={f.title} onChange={set("title")} />
              </label>
              <label>
                <span className="field-label">Employee ID</span>
                <input className="field" value={f.employeeCode} onChange={set("employeeCode")} placeholder="e.g. AVZ-014" />
              </label>
              <label>
                <span className="field-label">Phone</span>
                <input className="field" type="tel" value={f.phone} onChange={set("phone")} placeholder="+91 98765 43210" />
              </label>
              <label>
                <span className="field-label">City</span>
                <input className="field" value={f.city} onChange={set("city")} />
              </label>
            </div>
          </section>

          <section>
            <div className="form-section-title">Work</div>
            <div className="form-grid">
              <label>
                <span className="field-label">Role</span>
                <select className="field" value={f.roleId} onChange={set("roleId")} disabled={isMe}>
                  {roles.map((r) => (
                    <option key={r.id} value={r.id} disabled={!assignable.includes(r.id) && r.id !== person.roleId}>
                      {r.name}
                    </option>
                  ))}
                </select>
                {isMe && <span className="caption">You can&apos;t change your own role.</span>}
              </label>
              <label>
                <span className="field-label">Department</span>
                <select className="field" value={f.departmentId} onChange={set("departmentId")}>
                  <option value="">—</option>
                  {depts.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                <span className="field-label">Manager</span>
                <select className="field" value={f.managerId} onChange={set("managerId")}>
                  <option value="">No manager</option>
                  {users.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.name}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                <span className="field-label">Joining date</span>
                <input className="field" type="date" value={f.joinedAt} max={toDateInput(Date.now())} onChange={set("joinedAt")} />
                <span className="caption">Used for work-anniversary points.</span>
              </label>
            </div>
          </section>

          <section>
            <div className="form-section-title">Birthday</div>
            <div className="form-grid">
              <label>
                <span className="field-label">Month</span>
                <select className="field" value={bm || ""} onChange={(e) => setBirthday(Number(e.target.value), bd)}>
                  <option value="">Not set</option>
                  {MONTHS.map((m, i) => (
                    <option key={m} value={i + 1}>
                      {m}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                <span className="field-label">Day</span>
                <select className="field" value={bd || ""} disabled={!bm} onChange={(e) => setBirthday(bm, Number(e.target.value))}>
                  {!bm && <option value="">—</option>}
                  {bm > 0 &&
                    Array.from({ length: DAYS_IN[bm - 1] }, (_, i) => (
                      <option key={i + 1} value={i + 1}>
                        {i + 1}
                      </option>
                    ))}
                </select>
              </label>
            </div>
            <p className="caption" style={{ marginTop: 6 }}>
              Only the day and month are stored — the year is never asked. Used for the automatic birthday bonus.
            </p>
          </section>

          <section>
            <div className="form-section-title">Points</div>
            <div className="points-box">
              <div className="row" style={{ justifyContent: "space-between" }}>
                <span>
                  <span className="caption">Balance</span>
                  <span className="balance" style={{ display: "block" }}>
                    {ledger ? ledger.balance.toLocaleString() : "…"}
                  </span>
                </span>
                {!canPoints && (
                  <span className="caption row" style={{ gap: 4, maxWidth: 220, textAlign: "right" }}>
                    <Icon name="lock" size={13} /> Only the Super Admin can give or take points.
                  </span>
                )}
              </div>
              {canPoints && (
                <div className="points-adjust">
                  <div className="segmented" role="radiogroup" aria-label="Give or take">
                    <button role="radio" aria-checked={adj.dir === "give"} onClick={() => setAdj({ ...adj, dir: "give" })}>
                      Give
                    </button>
                    <button role="radio" aria-checked={adj.dir === "take"} onClick={() => setAdj({ ...adj, dir: "take" })}>
                      Take
                    </button>
                  </div>
                  <input
                    className="field num"
                    style={{ width: 90 }}
                    inputMode="numeric"
                    placeholder="Points"
                    aria-label="Points"
                    value={adj.amount}
                    onChange={(e) => setAdj({ ...adj, amount: e.target.value.replace(/\D/g, "") })}
                  />
                  <input
                    className="field"
                    style={{ flex: 1, minWidth: 160 }}
                    placeholder="Reason they'll see, e.g. Spot bonus"
                    aria-label="Reason"
                    value={adj.note}
                    onChange={(e) => setAdj({ ...adj, note: e.target.value })}
                  />
                  <button
                    className="btn btn-tinted btn-sm"
                    disabled={!Number(adj.amount) || adj.note.trim().length < 3}
                    onClick={applyPoints}
                  >
                    Apply
                  </button>
                </div>
              )}
              {ledger?.rows.length > 0 && (
                <div className="ledger-mini">
                  {ledger.rows.map((r) => (
                    <div key={r.id}>
                      <span className="caption">
                        {r.note || REASON_LABEL[r.reason]} · {timeAgo(r.at)}
                      </span>
                      <b className="num" style={{ color: r.delta > 0 ? "var(--green)" : "var(--red)" }}>
                        {r.delta > 0 ? "+" : ""}
                        {r.delta}
                      </b>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </section>

          <section>
            <div className="form-section-title">Account</div>
            <div className="group">
              <button
                className="group-item"
                onClick={async () => {
                  const r = await resetPassword(person.id);
                  if (!r.ok) return toast(r.error, { tone: "error" });
                  onPassword({ name: person.name, email: person.email, password: r.data.password });
                }}
              >
                <Icon name="key" size={16} style={{ color: "var(--accent)" }} />
                <span style={{ flex: 1, textAlign: "left" }}>Reset password</span>
                <Icon name="chevronRight" size={14} className="tertiary" />
              </button>
            </div>
          </section>

          {error && (
            <p className="rec-error" role="alert">
              {error}
            </p>
          )}
        </div>
        <div className="sheet-foot">
          <span className="caption" style={{ flex: 1 }}>
            {dirty ? "Changes are saved to the Audit Log." : "Change anything above, then save."}
          </span>
          <button className="btn btn-filled" disabled={!dirty || pending} onClick={save}>
            {pending ? "Saving…" : "Save Changes"}
          </button>
        </div>
      </div>
    </>
  );
}
