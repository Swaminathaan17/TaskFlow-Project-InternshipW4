import { useEffect, useMemo, useState } from "react";
import { Plus, Search, LayoutDashboard, CheckCircle2, Clock3, CircleDot, LogOut, Shield, Trash2, X, ChevronDown } from "lucide-react";

const API = import.meta.env.VITE_API_URL || "http://localhost:5000/api";
const getToken = () => localStorage.getItem("taskflow_token");

async function api(path, options = {}) {
  const res = await fetch(API + path, {
    ...options,
    headers: { "Content-Type": "application/json", ...(options.headers || {}), ...(getToken() ? { Authorization: "Bearer " + getToken() } : {}) }
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
    e.preventDefault(); setError("");
    try {
      const data = await api("/auth/" + mode, { method: "POST", body: JSON.stringify(form) });
      localStorage.setItem("taskflow_token", data.token); onLogin(data.user);
    } catch (err) { setError(err.message); }
  };
  return <div className="auth-shell">
    <div className="auth-brand"><div className="brand-mark">T</div><div><b>TaskFlow</b><span>Project command center</span></div></div>
    <div className="auth-card">
      <div className="eyebrow">WORKSPACE ACCESS</div>
      <h1>{mode === "login" ? "Welcome back." : "Build your workspace."}</h1>
      <p className="muted">{mode === "login" ? "Sign in to continue managing your projects." : "Create your free project workspace."}</p>
      <form onSubmit={submit}>
        {mode === "register" && <input required placeholder="Full name" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />}
        <input required type="email" placeholder="Email address" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} />
        <input required type="password" minLength="6" placeholder="Password" value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} />
        {error && <div className="error">{error}</div>}
        <button className="primary wide">{mode === "login" ? "Sign in" : "Create account"}</button>
      </form>
      <button className="link-btn" onClick={() => { setMode(mode === "login" ? "register" : "login"); setError(""); }}>
        {mode === "login" ? "Create an account" : "Already have an account? Sign in"}
      </button>
      {mode === "login" && <div className="demo">Demo admin: <b>admin@taskflow.dev</b> / <b>Admin@123</b></div>}
    </div>
  </div>;
}

function App() {
  const [user, setUser] = useState(null);
  const [board, setBoard] = useState(null);
  const [detail, setDetail] = useState(null);
  const [query, setQuery] = useState("");
  const [modal, setModal] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    const t = getToken();
    if (t) api("/me").then(r => setUser(r.user)).catch(() => localStorage.removeItem("taskflow_token"));
  }, []);
  useEffect(() => { if (user) loadBoard(); }, [user]);

  async function loadBoard(id) {
    try {
      const boards = await api("/boards");
      const selected = id ? boards.find(b => b.id === id) : boards[0];
      setBoard(selected || null);
      if (selected) setDetail(await api("/boards/" + selected.id));
    } catch (e) { setError(e.message); }
  }
  if (!user) return <Auth onLogin={setUser} />;
  const logout = () => { localStorage.removeItem("taskflow_token"); setUser(null); };
  const stats = {
    total: detail?.tasks.length || 0,
    done: detail?.tasks.filter(t => detail.lists.find(l => l.id === t.listId)?.name.toLowerCase() === "done").length || 0,
    progress: detail?.tasks.filter(t => detail.lists.find(l => l.id === t.listId)?.name.toLowerCase().includes("progress")).length || 0
  };

  return <div className="app-shell">
    <aside className="sidebar">
      <div className="brand"><div className="brand-mark">T</div><div><b>TaskFlow</b><span>Workspace</span></div></div>
      <nav><button className="nav-active"><LayoutDashboard size={18}/> Overview</button></nav>
      <div className="side-section"><span>BOARD</span>{board && <button className="board-link"><span className="dot"></span>{board.name}</button>}</div>
      <div className="sidebar-bottom">
        <div className="user-mini"><div className="avatar">{user.name[0]}</div><div><b>{user.name}</b><span>{user.role}</span></div></div>
        <button className="logout" onClick={logout}><LogOut size={17}/> Sign out</button>
      </div>
    </aside>
    <main className="main">
      <header className="topbar">
        <div><div className="eyebrow">PROJECT MANAGEMENT</div><h2>{board?.name || "My workspace"}</h2></div>
        <div className="top-actions"><div className="search"><Search size={16}/><input placeholder="Search tasks..." value={query} onChange={e => setQuery(e.target.value)}/></div><button className="primary" onClick={() => setModal("task")}><Plus size={17}/> New task</button></div>
      </header>
      {error && <div className="error banner">{error}</div>}
      <section className="stats">
        <Stat icon={<CircleDot/>} label="Total tasks" value={stats.total}/>
        <Stat icon={<Clock3/>} label="In progress" value={stats.progress}/>
        <Stat icon={<CheckCircle2/>} label="Completed" value={stats.done}/>
        <Stat icon={<Shield/>} label="Your role" value={user.role}/>
      </section>
      <div className="board-head"><div><h3>Project board</h3><span className="muted">Drag tasks between stages to update progress.</span></div><button className="ghost" onClick={() => setModal("list")}><Plus size={16}/> Add list</button></div>
      <div className="board">
        {(detail?.lists || []).map(list => <List key={list.id} list={list} tasks={(detail.tasks || []).filter(t => t.listId === list.id && (t.title + " " + t.description).toLowerCase().includes(query.toLowerCase()))} users={detail.users || []} onDrop={async taskId => {
          await api("/tasks/" + taskId, { method: "PATCH", body: JSON.stringify({ listId: list.id, position: (detail.tasks || []).filter(t => t.listId === list.id).length }) }); loadBoard(board.id);
        }} onDelete={async id => { await api("/tasks/" + id, { method: "DELETE" }); loadBoard(board.id); }} onEdit={task => setModal(task)} />)}
      </div>
      {modal && <Modal type={modal} detail={detail} user={user} board={board} close={() => setModal(null)} refresh={() => loadBoard(board.id)} />}
    </main>
  </div>;
}

function Stat({ icon, label, value }) { return <div className="stat"><div className="stat-icon">{icon}</div><div><span>{label}</span><strong>{value}</strong></div></div>; }

function List({ list, tasks, users, onDrop, onDelete, onEdit }) {
  const [over, setOver] = useState(false);
  return <section className={"list " + (over ? "drag-over" : "")} onDragOver={e => { e.preventDefault(); setOver(true); }} onDragLeave={() => setOver(false)} onDrop={e => { e.preventDefault(); setOver(false); const id = e.dataTransfer.getData("task"); if (id) onDrop(id); }}>
    <div className="list-head"><div><span className="list-dot"></span><b>{list.name}</b><span className="count">{tasks.length}</span></div><ChevronDown size={16}/></div>
    <div className="task-stack">{tasks.map(t => <article className="task-card" key={t.id} draggable onDragStart={e => e.dataTransfer.setData("task", t.id)} onDoubleClick={() => onEdit(t)}>
      <div className="task-top"><span className={"priority " + t.priority}>{t.priority}</span><button className="icon-btn" onClick={() => onDelete(t.id)}><Trash2 size={14}/></button></div>
      <h4>{t.title}</h4><p>{t.description || "No description added."}</p>
      <div className="task-footer"><div className="avatar small">{(users.find(u => u.id === t.assigneeId)?.name || "?")[0]}</div><span>{t.dueDate ? new Date(t.dueDate).toLocaleDateString() : "No due date"}</span></div>
    </article>)}</div>
  </section>;
}

function Modal({ type, detail, user, board, close, refresh }) {
  const task = typeof type === "object" ? type : null;
  const isTask = type === "task" || task;
  const [form, setForm] = useState(task ? { ...task } : { title: "", description: "", priority: "medium", assigneeId: user.id, dueDate: "", listId: detail?.lists[0]?.id || "" });
  const [busy, setBusy] = useState(false);
  const submit = async e => {
    e.preventDefault(); setBusy(true);
    try {
      if (isTask) {
        const body = { ...form };
        if (task) await api("/tasks/" + task.id, { method: "PATCH", body: JSON.stringify(body) });
        else await api("/tasks", { method: "POST", body: JSON.stringify(body) });
      } else {
        await api("/lists", { method: "POST", body: JSON.stringify({ boardId: board.id, name: form.name }) });
      }
      close(); refresh();
    } catch (e) { alert(e.message); } finally { setBusy(false); }
  };
  return <div className="modal-backdrop" onMouseDown={e => e.target === e.currentTarget && close()}><div className="modal">
    <div className="modal-head"><div><div className="eyebrow">{isTask ? "TASK DETAILS" : "BOARD LIST"}</div><h3>{isTask ? (task ? "Edit task" : "Create task") : "Add a list"}</h3></div><button className="icon-btn" onClick={close}><X/></button></div>
    <form onSubmit={submit}>
      {isTask ? <>
        <label>Title<input required value={form.title} onChange={e => setForm({ ...form, title: e.target.value })}/></label>
        <label>Description<textarea rows="3" value={form.description} onChange={e => setForm({ ...form, description: e.target.value })}/></label>
        <div className="form-grid"><label>Priority<select value={form.priority} onChange={e => setForm({ ...form, priority: e.target.value })}><option>low</option><option>medium</option><option>high</option></select></label><label>Stage<select value={form.listId} onChange={e => setForm({ ...form, listId: e.target.value })}>{detail?.lists.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}</select></label></div>
        <div className="form-grid"><label>Assignee<select value={form.assigneeId} onChange={e => setForm({ ...form, assigneeId: e.target.value })}>{detail?.users.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}</select></label><label>Due date<input type="date" value={form.dueDate || ""} onChange={e => setForm({ ...form, dueDate: e.target.value })}/></label></div>
      </> : <label>List name<input required autoFocus value={form.name || ""} onChange={e => setForm({ name: e.target.value })}/></label>}
      <div className="modal-actions"><button type="button" className="ghost" onClick={close}>Cancel</button><button className="primary" disabled={busy}>{busy ? "Saving..." : "Save changes"}</button></div>
    </form>
  </div></div>;
}

export default App;