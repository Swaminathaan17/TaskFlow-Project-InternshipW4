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
  const backlogId = crypto.randomUUID();
  const progressId = crypto.randomUUID();
  const doneId = crypto.randomUUID();
  const now = new Date().toISOString();

  fs.writeFileSync(dbFile, JSON.stringify({
    users: [admin, member],
    boards: [{
      id: boardId,
      name: "Product Launch",
      description: "Plan the next TaskFlow release",
      ownerId: admin.id,
      memberIds: [admin.id, member.id],
      createdAt: now
    }],
    lists: [
      { id: backlogId, boardId, name: "Backlog", position: 0 },
      { id: progressId, boardId, name: "In Progress", position: 1 },
      { id: doneId, boardId, name: "Done", position: 2 }
    ],
    tasks: [
      {
        id: crypto.randomUUID(),
        listId: backlogId,
        title: "Create project roadmap",
        description: "Define milestones for the next release.",
        priority: "high",
        assigneeId: member.id,
        dueDate: null,
        labels: ["Planning"],
        position: 0,
        createdAt: now
      }
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

function canAccessBoard(board, user) {
  return Boolean(board && (user.role === "admin" || board.ownerId === user.id || (board.memberIds || []).includes(user.id)));
}

function boardForList(data, listId) {
  const list = data.lists.find(item => item.id === listId);
  return list ? data.boards.find(item => item.id === list.boardId) : null;
}

function boardForTask(data, task) {
  return task ? boardForList(data, task.listId) : null;
}

const app = express();
app.use(cors({ origin: true }));
app.use(express.json({ limit: "1mb" }));

app.get("/api/health", (_, res) => res.json({ status: "ok", service: "TaskFlow API", timestamp: new Date().toISOString() }));

app.post("/api/auth/register", async (req, res) => {
  const { name, email, password } = req.body;
  if (!name || !email || !password || password.length < 6) {
    return res.status(400).json({ message: "Name, email and a 6+ character password are required" });
  }

  const data = db();
  const normalized = email.toLowerCase();
  if (data.users.some(u => u.email === normalized)) {
    return res.status(409).json({ message: "Email already registered" });
  }

  const user = {
    id: crypto.randomUUID(),
    name: String(name).trim(),
    email: normalized,
    password: await bcrypt.hash(password, 10),
    role: "member",
    createdAt: new Date().toISOString()
  };

  data.users.push(user);
  save(data);
  res.status(201).json({ user: safeUser(user), token: tokenFor(user) });
});

app.post("/api/auth/login", async (req, res) => {
  const data = db();
  const user = data.users.find(u => u.email === String(req.body.email || "").toLowerCase());

  if (!user || !(await bcrypt.compare(req.body.password || "", user.password))) {
    return res.status(401).json({ message: "Invalid email or password" });
  }

  res.json({ user: safeUser(user), token: tokenFor(user) });
});

app.get("/api/me", auth, (req, res) => {
  const user = db().users.find(u => u.id === req.user.id);
  if (!user) return res.status(401).json({ message: "User no longer exists" });
  res.json({ user: safeUser(user) });
});

app.get("/api/boards", auth, (req, res) => {
  const data = db();
  const boards = data.boards.filter(board => canAccessBoard(board, req.user));
  res.json(boards);
});

app.post("/api/boards", auth, (req, res) => {
  const name = String(req.body.name || "").trim();
  if (!name) return res.status(400).json({ message: "Board name is required" });

  const data = db();
  const board = {
    id: crypto.randomUUID(),
    name,
    description: String(req.body.description || "").trim(),
    ownerId: req.user.id,
    memberIds: [req.user.id],
    createdAt: new Date().toISOString()
  };

  data.boards.push(board);
  ["Backlog", "In Progress", "Done"].forEach((name, i) => {
    data.lists.push({ id: crypto.randomUUID(), boardId: board.id, name, position: i });
  });

  save(data);
  res.status(201).json(board);
});

app.get("/api/boards/:id", auth, (req, res) => {
  const data = db();
  const board = data.boards.find(b => b.id === req.params.id);

  if (!board) return res.status(404).json({ message: "Board not found" });
  if (!canAccessBoard(board, req.user)) return res.status(403).json({ message: "You do not have access to this board" });

  const lists = data.lists.filter(l => l.boardId === board.id).sort((a, b) => a.position - b.position);
  const listIds = new Set(lists.map(l => l.id));
  const tasks = data.tasks.filter(t => listIds.has(t.listId)).sort((a, b) => a.position - b.position);

  res.json({ board, lists, tasks, users: data.users.map(safeUser) });
});

app.post("/api/tasks", auth, (req, res) => {
  const data = db();
  const list = data.lists.find(l => l.id === req.body.listId);
  const board = list && data.boards.find(b => b.id === list.boardId);

  if (!list || !board) return res.status(400).json({ message: "List not found" });
  if (!canAccessBoard(board, req.user)) return res.status(403).json({ message: "You do not have access to this board" });

  const task = {
    id: crypto.randomUUID(),
    listId: list.id,
    title: String(req.body.title || "New task").trim(),
    description: String(req.body.description || ""),
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
  const currentBoard = boardForTask(data, task);

  if (!task) return res.status(404).json({ message: "Task not found" });
  if (!canAccessBoard(currentBoard, req.user)) return res.status(403).json({ message: "You do not have access to this task" });

  if (req.body.listId) {
    const destinationBoard = boardForList(data, req.body.listId);
    if (!destinationBoard || destinationBoard.id !== currentBoard.id) {
      return res.status(400).json({ message: "Tasks can only move within the same board" });
    }
  }

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
  const task = data.tasks.find(t => t.id === req.params.id);

  if (!task) return res.status(404).json({ message: "Task not found" });
  if (!canAccessBoard(boardForTask(data, task), req.user)) {
    return res.status(403).json({ message: "You do not have access to this task" });
  }

  data.tasks = data.tasks.filter(t => t.id !== req.params.id);
  save(data);
  res.status(204).end();
});

app.post("/api/lists", auth, (req, res) => {
  const data = db();
  const board = data.boards.find(b => b.id === req.body.boardId);

  if (!board) return res.status(404).json({ message: "Board not found" });
  if (!canAccessBoard(board, req.user)) return res.status(403).json({ message: "You do not have access to this board" });

  const name = String(req.body.name || "").trim();
  if (!name) return res.status(400).json({ message: "List name is required" });

  const list = {
    id: crypto.randomUUID(),
    boardId: board.id,
    name,
    position: data.lists.filter(l => l.boardId === board.id).length
  };

  data.lists.push(list);
  save(data);
  res.status(201).json(list);
});

app.get("/api/users", auth, adminOnly, (_, res) => {
  res.json(db().users.map(safeUser));
});

app.delete("/api/users/:id", auth, adminOnly, (req, res) => {
  if (req.params.id === req.user.id) {
    return res.status(400).json({ message: "You cannot delete your own account" });
  }

  const data = db();
  const exists = data.users.some(u => u.id === req.params.id);
  if (!exists) return res.status(404).json({ message: "User not found" });

  data.users = data.users.filter(u => u.id !== req.params.id);
  data.boards.forEach(board => {
    board.memberIds = (board.memberIds || []).filter(id => id !== req.params.id);
  });
  data.tasks = data.tasks.filter(task => task.assigneeId !== req.params.id);
  save(data);
  res.status(204).end();
});

export { app };

if (process.env.NODE_ENV !== "test") {
  app.listen(PORT, () => console.log("TaskFlow API running on port " + PORT));
}
