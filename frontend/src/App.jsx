import { useEffect, useMemo, useState } from "react";
import {
  Plus, Search, LayoutDashboard, CheckCircle2, Clock3, CircleDot,
  LogOut, Shield, Trash2, X, ChevronDown, Pencil, Settings2,
  Users, FolderKanban, MoreHorizontal
} from "lucide-react";

const API = import.meta.env.VITE_API_URL || "http://localhost:5000/api";
const getToken = () => localStorage.getItem("taskflow_token");

async function api(path, options = {}) {
  const res = await fetch(API + path, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {}),
      ...(getToken() ? { Authorization: "Bearer " + getToken() } : {})
    }
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.message || "Request failed");
  }

  return res.status === 204 ? null : res.json();
}

function Auth({ onLogin }) {
  const [mode, setMode] = useState("login");
  const [form, setForm] = useState({ name: "", email: "", password: "" });
  const [error, setError] = useState("");

  const submit = async e => {
    e.preventDefault();
    setError("");

    try {
      const data = await api("/auth/" + mode, {
        method: "POST",
        body: JSON.stringify(form)
      });
      localStorage.setItem("taskflow_token", data.token);
      onLogin(data.user);
    } catch (err) {
      setError(err.message);
    }
  };

  return <div className="auth-shell">
    <div className="auth-brand">
      <div className="brand-mark">T</div>
      <div><b>TaskFlow</b><span>Project command center</span></div>
    </div>

    <div className="auth-card">
      <div className="eyebrow">WORKSPACE ACCESS</div>
      <h1>{mode === "login" ? "Welcome back." : "Build your workspace."}</h1>
      <p className="muted">
        {mode === "login"
          ? "Sign in to continue managing your projects."
          : "Create your project workspace in seconds."}
      </p>

      <form onSubmit={submit}>
        {mode === "register" && (
          <input
            required
            placeholder="Full name"
            value={form.name}
            onChange={e => setForm({ ...form, name: e.target.value })}
          />
        )}
        <input
          required
          type="email"
          placeholder="Email address"
          value={form.email}
          onChange={e => setForm({ ...form, email: e.target.value })}
        />
        <input
          required
          type="password"
          minLength="6"
          placeholder="Password"
          value={form.password}
          onChange={e => setForm({ ...form, password: e.target.value })}
        />
        {error && <div className="error">{error}</div>}
        <button className="primary wide">
          {mode === "login" ? "Sign in" : "Create account"}
        </button>
      </form>

      <button
        className="link-btn"
        onClick={() => {
          setMode(mode === "login" ? "register" : "login");
          setError("");
        }}
      >
        {mode === "login" ? "Create an account" : "Already have an account? Sign in"}
      </button>

      {mode === "login" && (
        <div className="demo">
          Demo admin: <b>admin@taskflow.dev</b> / <b>Admin@123</b><br />
          Demo member: <b>member@taskflow.dev</b> / <b>Member@123</b>
        </div>
      )}
    </div>
  </div>;
}

function App() {
  const [user, setUser] = useState(null);
  const [boards, setBoards] = useState([]);
  const [board, setBoard] = useState(null);
  const [detail, setDetail] = useState(null);
  const [query, setQuery] = useState("");
  const [modal, setModal] = useState(null);
  const [view, setView] = useState("board");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = getToken();
    if (!token) return setLoading(false);

    api("/me")
      .then(r => setUser(r.user))
      .catch(() => localStorage.removeItem("taskflow_token"))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (user) loadBoards();
  }, [user]);

  async function loadBoards(preferredId) {
    try {
      setError("");
      const list = await api("/boards");
      setBoards(list);

      const selected = preferredId
        ? list.find(b => b.id === preferredId)
        : board
          ? list.find(b => b.id === board.id)
          : list[0];

      setBoard(selected || null);
      if (selected) {
        setDetail(await api("/boards/" + selected.id));
      } else {
        setDetail(null);
      }
    } catch (e) {
      setError(e.message);
    }
  }

  async function refreshBoard() {
    if (board) setDetail(await api("/boards/" + board.id));
    await loadBoards(board?.id);
  }

  async function selectBoard(id) {
    try {
      setError("");
      const selected = boards.find(b => b.id === id);
      setBoard(selected || null);
      setDetail(selected ? await api("/boards/" + selected.id) : null);
      setView("board");
    } catch (e) {
      setError(e.message);
    }
  }

  const logout = () => {
    localStorage.removeItem("taskflow_token");
    setUser(null);
    setBoard(null);
    setDetail(null);
  };

  if (loading) return <div className="loading-screen"><div className="brand-mark">T</div><span>Loading workspace…</span></div>;
  if (!user) return <Auth onLogin={setUser} />;

  const stats = {
    total: detail?.tasks.length || 0,
    done: detail?.tasks.filter(t =>
      detail.lists.find(l => l.id === t.listId)?.name.toLowerCase() === "done"
    ).length || 0,
    progress: detail?.tasks.filter(t =>
      detail.lists.find(l => l.id === t.listId)?.name.toLowerCase().includes("progress")
    ).length || 0
  };

  return <div className="app-shell">
    <aside className="sidebar">
      <div className="brand">
        <div className="brand-mark">T</div>
        <div><b>TaskFlow</b><span>Workspace</span></div>
      </div>

      <nav>
        <button className={view === "board" ? "nav-active" : "nav-btn"} onClick={() => setView("board")}>
          <LayoutDashboard size={18}/> Overview
        </button>
        {user.role === "admin" && (
          <button className={view === "admin" ? "nav-active" : "nav-btn"} onClick={() => setView("admin")}>
            <Shield size={18}/> Admin
          </button>
        )}
      </nav>

      <div className="side-section">
        <div className="section-row">
          <span>BOARDS</span>
          <button className="mini-plus" onClick={() => setModal("board")} title="Create board"><Plus size={13}/></button>
        </div>
        {boards.map(b => (
          <button
            key={b.id}
            className={"board-link " + (board?.id === b.id ? "selected" : "")}
            onClick={() => selectBoard(b.id)}
          >
            <span className="dot"></span>{b.name}
          </button>
        ))}
        {!boards.length && <div className="empty-side">No boards yet</div>}
      </div>

      <div className="sidebar-bottom">
        <div className="user-mini">
          <div className="avatar">{user.name[0]?.toUpperCase()}</div>
          <div><b>{user.name}</b><span>{user.role}</span></div>
        </div>
        <button className="logout" onClick={logout}><LogOut size={17}/> Sign out</button>
      </div>
    </aside>

    <main className="main">
      <header className="topbar">
        <div>
          <div className="eyebrow">{view === "admin" ? "ADMINISTRATION" : "PROJECT MANAGEMENT"}</div>
          <h2>{view === "admin" ? "Workspace administration" : board?.name || "My workspace"}</h2>
        </div>

        <div className="top-actions">
          {view === "board" && (
            <>
              <div className="search">
                <Search size={16}/>
                <input
                  placeholder="Search tasks..."
                  value={query}
                  onChange={e => setQuery(e.target.value)}
                />
              </div>
              <button className="primary" disabled={!board} onClick={() => setModal("task")}>
                <Plus size={17}/> New task
              </button>
            </>
          )}
          {view === "admin" && <button className="ghost" onClick={() => loadBoards()}><Settings2 size={16}/> Refresh</button>}
        </div>
      </header>

      {error && <div className="error banner">{error}</div>}

      {view === "admin" ? (
        <AdminPanel refresh={loadBoards} />
      ) : (
        <>
          <section className="stats">
            <Stat icon={<CircleDot/>} label="Total tasks" value={stats.total}/>
            <Stat icon={<Clock3/>} label="In progress" value={stats.progress}/>
            <Stat icon={<CheckCircle2/>} label="Completed" value={stats.done}/>
            <Stat icon={<Shield/>} label="Your role" value={user.role}/>
          </section>

          {!board ? (
            <EmptyBoard onCreate={() => setModal("board")} />
          ) : (
            <>
              <div className="board-head">
                <div>
                  <h3>Project board</h3>
                  <span className="muted">Drag tasks between stages to update progress.</span>
                </div>
                <div className="board-actions">
                  <button className="ghost" onClick={() => setModal("list")}><Plus size={16}/> Add list</button>
                  <button className="ghost" onClick={() => setModal("board-edit")}><Pencil size={15}/> Board settings</button>
                </div>
              </div>

              <div className="board">
                {(detail?.lists || []).map(list => (
                  <List
                    key={list.id}
                    list={list}
                    tasks={(detail?.tasks || []).filter(t =>
                      t.listId === list.id &&
                      (t.title + " " + t.description).toLowerCase().includes(query.toLowerCase())
                    )}
                    users={detail?.users || []}
                    onDrop={async taskId => {
                      await api("/tasks/" + taskId, {
                        method: "PATCH",
                        body: JSON.stringify({
                          listId: list.id,
                          position: (detail?.tasks || []).filter(t => t.listId === list.id).length
                        })
                      });
                      await refreshBoard();
                    }}
                    onDelete={async id => {
                      if (!window.confirm("Delete this task?")) return;
                      await api("/tasks/" + id, { method: "DELETE" });
                      await refreshBoard();
                    }}
                    onEdit={task => setModal(task)}
                  />
                ))}
              </div>
            </>
          )}
        </>
      )}

      {modal && (
        <Modal
          type={modal}
          detail={detail}
          user={user}
          board={board}
          close={() => setModal(null)}
          refresh={refreshBoard}
          afterBoardCreate={async created => {
            setModal(null);
            await loadBoards(created.id);
          }}
        />
      )}
    </main>
  </div>;
}

function Stat({ icon, label, value }) {
  return <div className="stat">
    <div className="stat-icon">{icon}</div>
    <div><span>{label}</span><strong>{value}</strong></div>
  </div>;
}

function EmptyBoard({ onCreate }) {
  return <div className="empty-board">
    <div className="empty-icon"><FolderKanban size={26}/></div>
    <h3>No project board yet</h3>
    <p>Create your first board and start organizing work.</p>
    <button className="primary" onClick={onCreate}><Plus size={16}/> Create board</button>
  </div>;
}

function List({ list, tasks, users, onDrop, onDelete, onEdit }) {
  const [over, setOver] = useState(false);

  return <section
    className={"list " + (over ? "drag-over" : "")}
    onDragOver={e => { e.preventDefault(); setOver(true); }}
    onDragLeave={() => setOver(false)}
    onDrop={e => {
      e.preventDefault();
      setOver(false);
      const id = e.dataTransfer.getData("task");
      if (id) onDrop(id);
    }}
  >
    <div className="list-head">
      <div><span className="list-dot"></span><b>{list.name}</b><span className="count">{tasks.length}</span></div>
      <MoreHorizontal size={16}/>
    </div>

    <div className="task-stack">
      {tasks.map(t => (
        <article
          className="task-card"
          key={t.id}
          draggable
          onDragStart={e => e.dataTransfer.setData("task", t.id)}
        >
          <div className="task-top">
            <span className={"priority " + t.priority}>{t.priority}</span>
            <div className="task-tools">
              <button className="icon-btn" onClick={() => onEdit(t)} title="Edit task"><Pencil size={13}/></button>
              <button className="icon-btn danger" onClick={() => onDelete(t.id)} title="Delete task"><Trash2 size={14}/></button>
            </div>
          </div>
          <h4>{t.title}</h4>
          <p>{t.description || "No description added."}</p>
          <div className="task-footer">
            <div className="avatar small">{(users.find(u => u.id === t.assigneeId)?.name || "?")[0]}</div>
            <span>{t.dueDate ? new Date(t.dueDate).toLocaleDateString() : "No due date"}</span>
          </div>
        </article>
      ))}
      {!tasks.length && <div className="empty-list">Drop tasks here</div>}
    </div>
  </section>;
}

function AdminPanel({ refresh }) {
  const [users, setUsers] = useState([]);
  const [error, setError] = useState("");

  async function loadUsers() {
    try {
      setUsers(await api("/users"));
      setError("");
    } catch (e) {
      setError(e.message);
    }
  }

  useEffect(() => { loadUsers(); }, []);

  async function removeUser(id) {
    if (!window.confirm("Remove this user? Their assigned tasks will also be removed.")) return;
    try {
      await api("/users/" + id, { method: "DELETE" });
      await loadUsers();
      await refresh();
    } catch (e) {
      setError(e.message);
    }
  }

  return <section className="admin-grid">
    <div className="admin-hero">
      <div className="admin-icon"><Shield size={23}/></div>
      <div>
        <div className="eyebrow">ADMIN CONTROL CENTER</div>
        <h3>Team & workspace management</h3>
        <p>Manage registered members and keep your project workspace organized.</p>
      </div>
    </div>

    {error && <div className="error">{error}</div>}

    <div className="panel">
      <div className="panel-head">
        <div><h3>Team members</h3><span className="muted">{users.length} registered users</span></div>
        <button className="ghost" onClick={loadUsers}><Users size={15}/> Refresh</button>
      </div>

      <div className="user-table">
        {users.map(u => (
          <div className="user-row" key={u.id}>
            <div className="member">
              <div className="avatar">{u.name[0]?.toUpperCase()}</div>
              <div><b>{u.name}</b><span>{u.email}</span></div>
            </div>
            <span className={"role-pill " + u.role}>{u.role}</span>
            <span className="member-date">{new Date(u.createdAt).toLocaleDateString()}</span>
            <button className="icon-btn danger" disabled={u.role === "admin"} onClick={() => removeUser(u.id)} title={u.role === "admin" ? "Admin account" : "Remove user"}>
              <Trash2 size={15}/>
            </button>
          </div>
        ))}
      </div>
    </div>
  </section>;
}

function Modal({ type, detail, user, board, close, refresh, afterBoardCreate }) {
  const task = typeof type === "object" ? type : null;
  const isTask = type === "task" || task;
  const isBoard = type === "board" || type === "board-edit";

  const [form, setForm] = useState(
    task
      ? { ...task }
      : type === "board-edit"
        ? { name: board?.name || "", description: board?.description || "" }
        : isBoard
          ? { name: "", description: "" }
          : { title: "", description: "", priority: "medium", assigneeId: user.id, dueDate: "", listId: detail?.lists[0]?.id || "" }
  );
  const [busy, setBusy] = useState(false);

  const submit = async e => {
    e.preventDefault();
    setBusy(true);

    try {
      if (isTask) {
        await api(task ? "/tasks/" + task.id : "/tasks", {
          method: task ? "PATCH" : "POST",
          body: JSON.stringify(form)
        });
      } else if (type === "list") {
        await api("/lists", {
          method: "POST",
          body: JSON.stringify({ boardId: board.id, name: form.name })
        });
      } else if (type === "board") {
        const created = await api("/boards", {
          method: "POST",
          body: JSON.stringify(form)
        });
        afterBoardCreate(created);
        return;
      } else if (type === "board-edit") {
        const updated = await api("/boards/" + board.id, {
          method: "PATCH",
          body: JSON.stringify(form)
        });
        void updated;
      }

      close();
      await refresh();
    } catch (e) {
      alert(e.message);
    } finally {
      setBusy(false);
    }
  };

  return <div className="modal-backdrop" onMouseDown={e => e.target === e.currentTarget && close()}>
    <div className="modal">
      <div className="modal-head">
        <div>
          <div className="eyebrow">{isTask ? "TASK DETAILS" : isBoard ? "PROJECT BOARD" : "BOARD LIST"}</div>
          <h3>
            {isTask
              ? task ? "Edit task" : "Create task"
              : type === "board" ? "Create a board"
              : type === "board-edit" ? "Board settings"
              : "Add a list"}
          </h3>
        </div>
        <button className="icon-btn" onClick={close}><X/></button>
      </div>

      <form onSubmit={submit}>
        {isTask ? <>
          <label>Title<input required value={form.title} onChange={e => setForm({ ...form, title: e.target.value })}/></label>
          <label>Description<textarea rows="3" value={form.description} onChange={e => setForm({ ...form, description: e.target.value })}/></label>
          <div className="form-grid">
            <label>Priority<select value={form.priority} onChange={e => setForm({ ...form, priority: e.target.value })}><option>low</option><option>medium</option><option>high</option></select></label>
            <label>Stage<select value={form.listId} onChange={e => setForm({ ...form, listId: e.target.value })}>{detail?.lists.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}</select></label>
          </div>
          <div className="form-grid">
            <label>Assignee<select value={form.assigneeId} onChange={e => setForm({ ...form, assigneeId: e.target.value })}>{detail?.users.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}</select></label>
            <label>Due date<input type="date" value={form.dueDate || ""} onChange={e => setForm({ ...form, dueDate: e.target.value })}/></label>
          </div>
        </> : isBoard ? <>
          <label>Board name<input required autoFocus value={form.name} onChange={e => setForm({ ...form, name: e.target.value })}/></label>
          <label>Description<textarea rows="3" value={form.description} onChange={e => setForm({ ...form, description: e.target.value })}/></label>
        </> : (
          <label>List name<input required autoFocus value={form.name || ""} onChange={e => setForm({ name: e.target.value })}/></label>
        )}

        <div className="modal-actions">
          <button type="button" className="ghost" onClick={close}>Cancel</button>
          <button className="primary" disabled={busy}>{busy ? "Saving..." : "Save changes"}</button>
        </div>
      </form>
    </div>
  </div>;
}

export default App;
