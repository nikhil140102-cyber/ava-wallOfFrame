"use client";

import Link from "next/link";
import { Fragment, useEffect, useState } from "react";
import { Avatar } from "@/components/Avatar";
import { Icon } from "@/components/Icon";
import { useApp } from "@/components/shell/AppContext";
import { createRole, deleteRole, updateRole } from "@/app/actions";
import { PageHelp } from "@/components/PageHelp";

const COLORS = ["#6B7280", "#3355E6", "#0891B2", "#059669", "#D97706", "#DB2777", "#7C3AED", "#DC2626"];

export function RoleEditor({ roles, groups, myRoleId }) {
  const { toast } = useApp();
  const [view, setView] = useState("edit");
  const [selectedId, setSelectedId] = useState(roles[0]?.id);
  const [local, setLocal] = useState(roles);
  const [creating, setCreating] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  useEffect(() => setLocal(roles), [roles]);

  const role = local.find((r) => r.id === selectedId) ?? local[0];
  const isSuper = role?.name === "Super Admin";
  const allKeys = groups.flatMap((g) => g.items.map((i) => i.key));

  async function setPerms(next, previous, label) {
    setLocal((l) => l.map((r) => (r.id === role.id ? { ...r, permissions: next } : r)));
    const res = await updateRole(role.id, { permissions: next });
    if (!res.ok) {
      setLocal((l) => l.map((r) => (r.id === role.id ? { ...r, permissions: previous } : r)));
      return toast(res.error, { tone: "error" });
    }
    toast(label, {
      action: {
        label: "Undo",
        onClick: async () => {
          const u = await updateRole(role.id, { permissions: previous });
          if (u.ok) setLocal((l) => l.map((r) => (r.id === role.id ? { ...r, permissions: previous } : r)));
        },
      },
    });
  }

  function toggle(p) {
    const has = role.permissions.includes(p.key);
    const next = has ? role.permissions.filter((k) => k !== p.key) : [...role.permissions, p.key];
    setPerms(next, role.permissions, `${has ? "Removed" : "Added"} “${p.label}” ${has ? "from" : "to"} ${role.name}`);
  }

  async function saveMeta(patch) {
    const res = await updateRole(role.id, patch);
    if (!res.ok) return toast(res.error, { tone: "error" });
    setLocal((l) => l.map((r) => (r.id === role.id ? { ...r, ...patch } : r)));
  }

  return (
    <main className="page" style={{ maxWidth: 1240 }}>
      <header className="page-head">
        <div>
          <h1 className="large-title">Roles &amp; Permissions</h1>
          <p>Decide what each role can see and do. Changes apply the next time people load a page.</p>
        </div>
        <PageHelp topic="admin-roles" />
        <div className="segmented" role="tablist">
          <button role="tab" aria-selected={view === "edit"} onClick={() => setView("edit")}>
            Edit Roles
          </button>
          <button role="tab" aria-selected={view === "compare"} onClick={() => setView("compare")}>
            Compare
          </button>
        </div>
        <button className="btn btn-filled" onClick={() => setCreating(true)}>
          <Icon name="plus" size={16} /> New Role
        </button>
      </header>

      {view === "compare" ? (
        <div className="card" style={{ overflow: "auto", maxHeight: "calc(100vh - 180px)" }}>
          <table className="matrix">
            <thead>
              <tr>
                <th style={{ minWidth: 220 }}>Permission</th>
                {local.map((r) => (
                  <th key={r.id} style={{ minWidth: 110 }}>
                    <span className="dot" style={{ background: r.color, marginRight: 6 }} />
                    {r.name}
                    <span className="caption" style={{ display: "block", fontWeight: 400 }}>
                      {r.members.length} {r.members.length === 1 ? "person" : "people"}
                    </span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {groups.map((g) => (
                <Fragment key={g.group}>
                  <tr className="group-row">
                    <td colSpan={local.length + 1}>{g.group}</td>
                  </tr>
                  {g.items.map((p) => (
                    <tr key={p.key}>
                      <td>
                        {p.label}
                        <span className="caption" style={{ display: "block" }}>
                          {p.hint}
                        </span>
                      </td>
                      {local.map((r) => (
                        <td key={r.id}>
                          {r.name === "Super Admin" || (!p.superAdminOnly && r.permissions.includes(p.key)) ? (
                            <Icon name="check" size={18} stroke={2.6} style={{ color: "var(--green)", margin: "0 auto" }} label="Allowed" />
                          ) : (
                            <span className="tertiary" aria-label="Not allowed">
                              —
                            </span>
                          )}
                        </td>
                      ))}
                    </tr>
                  ))}
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="roles-layout">
          <nav className="group roles-list" aria-label="Roles">
            {local.map((r) => (
              <button
                key={r.id}
                className="group-item"
                aria-current={r.id === role?.id ? "true" : undefined}
                onClick={() => setSelectedId(r.id)}
              >
                <span className="role-swatch" style={{ background: r.color }}>
                  <Icon name={r.name === "Super Admin" ? "shield" : r.isSystem ? "key" : "person"} size={14} stroke={2.2} />
                </span>
                <span style={{ flex: 1, minWidth: 0 }}>
                  <b style={{ fontSize: 14, display: "block" }}>{r.name}</b>
                  <span className="caption">
                    {r.members.length} {r.members.length === 1 ? "person" : "people"} ·{" "}
                    {r.name === "Super Admin" ? allKeys.length : r.permissions.length} permissions
                  </span>
                </span>
                {!r.isSystem && <span className="tag">Custom</span>}
              </button>
            ))}
          </nav>

          {role && (
            <section className="role-detail" key={role.id}>
              <div className="card card-pad">
                <div className="row" style={{ alignItems: "flex-start", gap: 16 }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <input
                      className="role-name"
                      defaultValue={role.name}
                      disabled={isSuper}
                      aria-label="Role name"
                      onBlur={(e) => e.target.value.trim() && e.target.value !== role.name && saveMeta({ name: e.target.value.trim() })}
                    />
                    <input
                      className="role-desc"
                      defaultValue={role.description}
                      placeholder="Describe who this role is for"
                      aria-label="Role description"
                      onBlur={(e) => e.target.value !== role.description && saveMeta({ description: e.target.value })}
                    />
                  </div>
                  <div className="row" style={{ gap: 6 }} role="radiogroup" aria-label="Role colour">
                    {COLORS.map((c) => (
                      <button
                        key={c}
                        className="color-dot"
                        style={{ background: c }}
                        aria-checked={role.color.toLowerCase() === c.toLowerCase()}
                        role="radio"
                        aria-label={c}
                        onClick={() => saveMeta({ color: c })}
                      />
                    ))}
                  </div>
                </div>
                {isSuper && (
                  <p className="role-note">
                    <Icon name="lock" size={14} /> Super Admin always has every permission, so there&apos;s always someone who can fix
                    access.
                  </p>
                )}
                {role.id === myRoleId && !isSuper && (
                  <p className="role-note">
                    <Icon name="person" size={14} /> This is your role. You can&apos;t remove “Manage roles” from it.
                  </p>
                )}
              </div>

              {groups.map((g) => {
                const grantable = g.items.filter((i) => !i.superAdminOnly);
                const on = grantable.filter((i) => isSuper || role.permissions.includes(i.key)).length;
                return (
                  <section key={g.group} className="group-block" style={{ marginTop: 22 }}>
                    <div className="row section-label" style={{ paddingRight: 16 }}>
                      <span style={{ flex: 1 }}>{g.group}</span>
                      {!isSuper && (
                        <button
                          className="btn btn-plain btn-sm"
                          style={{ textTransform: "none", letterSpacing: 0, height: 24 }}
                          onClick={() => {
                            const keys = grantable.map((i) => i.key);
                            const all = on === grantable.length;
                            const next = all
                              ? role.permissions.filter((k) => !keys.includes(k))
                              : [...new Set([...role.permissions, ...keys])];
                            setPerms(next, role.permissions, `${all ? "Turned off" : "Turned on"} all ${g.group} permissions`);
                          }}
                        >
                          {on === grantable.length ? "Turn All Off" : "Turn All On"}
                        </button>
                      )}
                    </div>
                    <div className="group">
                      {g.items.map((p) => {
                        const checked = isSuper || (!p.superAdminOnly && role.permissions.includes(p.key));
                        const locked = isSuper || p.superAdminOnly || (role.id === myRoleId && p.key === "roles.manage");
                        return (
                          <div key={p.key} className="group-item">
                            <span style={{ flex: 1 }}>
                              <span style={{ display: "block", fontSize: 15 }}>{p.label}</span>
                              <span className="caption">
                                {p.superAdminOnly && !isSuper ? "Only the Super Admin can have this." : p.hint}
                              </span>
                            </span>
                            <button
                              className="switch"
                              role="switch"
                              aria-checked={checked}
                              aria-label={p.label}
                              disabled={locked}
                              onClick={() => toggle(p)}
                            />
                          </div>
                        );
                      })}
                    </div>
                  </section>
                );
              })}

              <section className="group-block" style={{ marginTop: 22 }}>
                <div className="section-label">
                  {role.members.length} {role.members.length === 1 ? "Person" : "People"}
                </div>
                <div className="group">
                  {role.members.length === 0 && <div className="group-item caption">No one has this role yet. Assign it from Users.</div>}
                  {role.members.map((m) => (
                    <Link key={m.id} href={`/people/${m.id}`} className="group-item indent">
                      <Avatar name={m.name} size={30} />
                      <span style={{ flex: 1 }}>{m.name}</span>
                      <Icon name="chevronRight" size={14} className="chev" />
                    </Link>
                  ))}
                </div>
                <p className="group-footer">
                  Change someone&apos;s role in{" "}
                  <Link href="/admin/users" style={{ color: "var(--accent)" }}>
                    Users
                  </Link>
                  .
                </p>
              </section>

              {!role.isSystem && (
                <div className="group" style={{ marginTop: 22 }}>
                  <button
                    className="group-item"
                    style={{ color: "var(--red)", justifyContent: "center" }}
                    onClick={() => setConfirmDelete(true)}
                  >
                    Delete Role
                  </button>
                </div>
              )}
            </section>
          )}
        </div>
      )}

      {creating && (
        <NewRoleSheet
          roles={local}
          onClose={() => setCreating(false)}
          onCreated={(id) => {
            setCreating(false);
            setSelectedId(id);
            setView("edit");
            toast("Role created — now pick its permissions");
          }}
        />
      )}

      {confirmDelete && role && (
        <>
          <div className="scrim" onClick={() => setConfirmDelete(false)} />
          <div
            className="sheet"
            style={{ width: "min(380px, calc(100vw - 32px))" }}
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="del-title"
          >
            <div className="sheet-body" style={{ textAlign: "center", paddingTop: 26 }}>
              <h2 id="del-title" className="title-3">
                Delete “{role.name}”?
              </h2>
              <p className="subhead" style={{ marginTop: 6 }}>
                {role.members.length
                  ? `${role.members.length} ${role.members.length === 1 ? "person" : "people"} will be moved to Employee.`
                  : "No one has this role, so nothing else changes."}{" "}
                This can&apos;t be undone.
              </p>
            </div>
            <div className="sheet-foot">
              <button className="btn btn-gray" style={{ flex: 1 }} onClick={() => setConfirmDelete(false)}>
                Cancel
              </button>
              <button
                className="btn btn-filled btn-destructive"
                style={{ flex: 1 }}
                onClick={async () => {
                  const r = await deleteRole(role.id);
                  setConfirmDelete(false);
                  if (!r.ok) return toast(r.error, { tone: "error" });
                  setSelectedId(local.find((x) => x.id !== role.id)?.id);
                  toast(r.message ?? "Role deleted");
                }}
              >
                Delete
              </button>
            </div>
          </div>
        </>
      )}
    </main>
  );
}

function NewRoleSheet({ roles, onClose, onCreated }) {
  const employee = roles.find((r) => r.name === "Employee");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [color, setColor] = useState(COLORS[1]);
  const [from, setFrom] = useState(employee?.id ?? "");
  const [error, setError] = useState(null);

  async function create() {
    const base = roles.find((r) => r.id === from);
    const res = await createRole({
      name,
      description,
      color,
      permissions: base ? (base.name === "Super Admin" ? [] : base.permissions) : [],
    });
    if (!res.ok) return setError(res.error);
    onCreated(res.data.id);
  }

  return (
    <>
      <div className="scrim" onClick={onClose} />
      <div className="sheet" style={{ width: "min(480px, calc(100vw - 32px))" }} role="dialog" aria-modal="true" aria-labelledby="new-role">
        <div className="sheet-head">
          <button className="btn btn-plain" onClick={onClose}>
            Cancel
          </button>
          <h2 id="new-role">New Role</h2>
          <button className="btn btn-plain" style={{ fontWeight: 700 }} disabled={name.trim().length < 2} onClick={create}>
            Create
          </button>
        </div>
        <div className="sheet-body stack" style={{ gap: 16 }}>
          <label>
            <span className="field-label">Name</span>
            <input
              className="field"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Recognition Champion"
              autoFocus
            />
          </label>
          <label>
            <span className="field-label">Description</span>
            <input
              className="field"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Who is this role for?"
            />
          </label>
          <div>
            <span className="field-label">Colour</span>
            <div className="row" style={{ gap: 8 }}>
              {COLORS.map((c) => (
                <button
                  key={c}
                  className="color-dot"
                  style={{ background: c, width: 28, height: 28 }}
                  aria-checked={color === c}
                  role="radio"
                  aria-label={c}
                  onClick={() => setColor(c)}
                />
              ))}
            </div>
          </div>
          <label>
            <span className="field-label">Start with permissions from</span>
            <select className="field" value={from} onChange={(e) => setFrom(e.target.value)}>
              <option value="">Nothing — start empty</option>
              {roles
                .filter((r) => r.name !== "Super Admin")
                .map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name}
                  </option>
                ))}
            </select>
            <span className="field-hint">You can change every permission after creating the role.</span>
          </label>
          {error && (
            <p className="rec-error" role="alert">
              {error}
            </p>
          )}
        </div>
      </div>
    </>
  );
}
