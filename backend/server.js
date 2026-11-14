import express from "express";
import cors from "cors";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import crypto from "crypto";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dataDir = path.join(__dirname, "data");
const dbFile = path.join(dataDir, "db.json");
const PORT = process.env.PORT || 5000;
const JWT_SECRET = process.env.JWT_SECRET || "taskflow-dev-secret-change-me";

fs.mkdirSync(dataDir, { recursive: true });

function seed() {
  if (fs.existsSync(dbFile)) return;
  const admin = {
    id: crypto.randomUUID(),
    name: "TaskFlow Admin",
    email: "admin@taskflow.dev",
    password: bcrypt.hashSync("Admin@123", 10),
    role: "admin",
    createdAt: new Date().toISOString()
  };
  const member = {
    id: crypto.randomUUID(),
    name: "Demo Member",
    email: "member@taskflow.dev",
    password: bcrypt.hashSync("Member@123", 10),
    role: "member",
    createdAt: new Date().toISOString()
  };
  const boardId = crypto.randomUUID();
  const now = new Date().toISOString();
  fs.writeFileSync(dbFile, JSON.stringify({
    users: [admin, member],
    boards: [{ id: boardId, name: "Product Launch", description: "Plan the next TaskFlow release", ownerId: admin.id, createdAt: now }],
    lists: [
      { id: crypto.randomUUID(), boardId, name: "Backlog", position: 0 },
      { id: crypto.randomUUID(), boardId, name: "In Progress", position: 1 },
      { id: crypto.randomUUID(), boardId, name: "Done", position: 2 }
    ],
    tasks: [
      { id: crypto.randomUUID(), listId: null, title: "Create project roadmap", description: "Define milestones for the next release.", priority: "high", assigneeId: member.id, dueDate: null, labels: ["Planning"], position: 0, createdAt: now }
    ]
  }, null, 2));
}

seed();

function db() {
  return JSON.parse(fs.readFileSync(dbFile, "utf8"));
}
function save(data) {
  const tmp = dbFile + ".tmp";
  fs.writeFileSync(tmp, JSON.stringify(data, null, 2));
  fs.renameSync(tmp, dbFile);
}
function safeUser(u) {
  return { id: u.id, name: u.name, email: u.email, role: u.role, createdAt: u.createdAt };
}
function tokenFor(u) {
  return jwt.sign({ id: u.id, role: u.role }, JWT_SECRET, { expiresIn: "7d" });
}
function auth(req, res, next) {
  try {
    const token = (req.headers.authorization || "").replace("Bearer ", "");
    req.user = jwt.verify(token, JWT_SECRET);
    next();
  } catch {
    res.status(401).json({ message: "Authentication required" });
  }
}
function adminOnly(req, res, next) {
  if (req.user.role !== "admin") return res.status(403).json({ message: "Admin access required" });
  next();
}

const app = express();
app.use(cors({ origin: true }));
app.use(express.json({ limit: "1mb" }));

app.get("/api/health", (_, res) => res.json({ status: "ok", service: "TaskFlow API" }));

app.post("/api/auth/register", async (req, res) => {
  const { name, email, password } = req.body;
  if (!name || !email || !password || password.length < 6) return res.status(400).json({ message: "Name, email and a 6+ character password are required" });
  const data = db();
  const normalized = email.toLowerCase();
  if (data.users.some(u => u.email === normalized)) return res.status(409).json({ message: "Email already registered" });
  const user = { id: crypto.randomUUID(), name, email: normalized, password: await bcrypt.hash(password, 10), role: "member", createdAt: new Date().toISOString() };
  data.users.push(user);
  save(data);
  res.status(201).json({ user: safeUser(user), token: tokenFor(user) });
});

app.post("/api/auth/login", async (req, res) => {
  const data = db();
  const user = data.users.find(u => u.email === String(req.body.email || "").toLowerCase());
  if (!user || !(await bcrypt.compare(req.body.password || "", user.password))) return res.status(401).json({ message: "Invalid email or password" });
  res.json({ user: safeUser(user), token: tokenFor(user) });
});

app.get("/api/me", auth, (req, res) => {
  const user = db().users.find(u => u.id === req.user.id);
  res.json({ user: safeUser(user) });
});

app.get("/api/boards", auth, (req, res) => {
  const data = db();
  const boards = data.boards.filter(b => req.user.role === "admin" || b.ownerId === req.user.id || true);
  res.json(boards);
});

app.post("/api/boards", auth, (req, res) => {
  const data = db();
  const board = { id: crypto.randomUUID(), name: req.body.name || "Untitled Board", description: req.body.description || "", ownerId: req.user.id, createdAt: new Date().toISOString() };
  data.boards.push(board);
  ["Backlog", "In Progress", "Done"].forEach((name, i) => data.lists.push({ id: crypto.randomUUID(), boardId: board.id, name, position: i }));
  save(data);
  res.status(201).json(board);
});

app.get("/api/boards/:id", auth, (req, res) => {
  const data = db();
  const board = data.boards.find(b => b.id === req.params.id);
  if (!board) return res.status(404).json({ message: "Board not found" });
  const lists = data.lists.filter(l => l.boardId === board.id).sort((a, b) => a.position - b.position);
  const tasks = data.tasks.filter(t => lists.some(l => l.id === t.listId)).sort((a, b) => a.position - b.position);
  res.json({ board, lists, tasks, users: data.users.map(safeUser) });
});

app.post("/api/tasks", auth, (req, res) => {
  const data = db();
  const list = data.lists.find(l => l.id === req.body.listId);
  if (!list) return res.status(400).json({ message: "List not found" });
  const task = {
    id: crypto.randomUUID(),
    listId: list.id,
    title: req.body.title || "New task",
    description: req.body.description || "",
    priority: req.body.priority || "medium",
    assigneeId: req.body.assigneeId || req.user.id,
    dueDate: req.body.dueDate || null,
    labels: Array.isArray(req.body.labels) ? req.body.labels : [],
    position: data.tasks.filter(t => t.listId === list.id).length,
    createdAt: new Date().toISOString()
  };
  data.tasks.push(task);
  save(data);
  res.status(201).json(task);
});

app.patch("/api/tasks/:id", auth, (req, res) => {
  const data = db();
  const task = data.tasks.find(t => t.id === req.params.id);
  if (!task) return res.status(404).json({ message: "Task not found" });
  Object.assign(task, {
    title: req.body.title ?? task.title,
    description: req.body.description ?? task.description,
    priority: req.body.priority ?? task.priority,
    assigneeId: req.body.assigneeId ?? task.assigneeId,
    dueDate: req.body.dueDate ?? task.dueDate,
    labels: req.body.labels ?? task.labels,
    listId: req.body.listId ?? task.listId,
    position: req.body.position ?? task.position
  });
  save(data);
  res.json(task);
});

app.delete("/api/tasks/:id", auth, (req, res) => {
  const data = db();
  const before = data.tasks.length;
  data.tasks = data.tasks.filter(t => t.id !== req.params.id);
  if (data.tasks.length === before) return res.status(404).json({ message: "Task not found" });
  save(data);
  res.status(204).end();
});

app.post("/api/lists", auth, (req, res) => {
  const data = db();
  const list = { id: crypto.randomUUID(), boardId: req.body.boardId, name: req.body.name || "New List", position: data.lists.filter(l => l.boardId === req.body.boardId).length };
  data.lists.push(list);
  save(data);
  res.status(201).json(list);
});

app.get("/api/users", auth, adminOnly, (_, res) => res.json(db().users.map(safeUser)));

app.delete("/api/users/:id", auth, adminOnly, (req, res) => {
  if (req.params.id === req.user.id) return res.status(400).json({ message: "You cannot delete your own account" });
  const data = db();
  data.users = data.users.filter(u => u.id !== req.params.id);
  save(data);
  res.status(204).end();
});

app.listen(PORT, () => console.log("TaskFlow API running on port " + PORT));