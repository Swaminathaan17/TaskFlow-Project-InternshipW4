import test from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";

const port = 5123;
const base = `http://127.0.0.1:${port}/api`;
const server = spawn(process.execPath, ["server.js"], {
  cwd: process.cwd(),
  env: { ...process.env, PORT: String(port), NODE_ENV: "test" },
  stdio: ["ignore", "pipe", "pipe"]
});

async function waitForServer() {
  for (let i = 0; i < 30; i++) {
    try {
      const res = await fetch(base + "/health");
      if (res.ok) return;
    } catch {}
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  throw new Error("Server did not start");
}

async function request(path, options = {}) {
  const res = await fetch(base + path, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {})
    }
  });
  const body = res.status === 204 ? null : await res.json();
  return { res, body };
}

test("TaskFlow API smoke suite", async t => {
  await waitForServer();

  const health = await request("/health");
  assert.equal(health.res.status, 200);
  assert.equal(health.body.status, "ok");

  const adminLogin = await request("/auth/login", {
    method: "POST",
    body: JSON.stringify({
      email: "admin@taskflow.dev",
      password: "Admin@123"
    })
  });
  assert.equal(adminLogin.res.status, 200);
  const adminToken = adminLogin.body.token;

  const boards = await request("/boards", {
    headers: { Authorization: "Bearer " + adminToken }
  });
  assert.equal(boards.res.status, 200);
  assert.ok(Array.isArray(boards.body));
  assert.ok(boards.body.length >= 1);

  const board = boards.body[0];
  const detail = await request("/boards/" + board.id, {
    headers: { Authorization: "Bearer " + adminToken }
  });
  assert.equal(detail.res.status, 200);
  assert.ok(detail.body.lists.length >= 3);

  const created = await request("/boards", {
    method: "POST",
    headers: { Authorization: "Bearer " + adminToken },
    body: JSON.stringify({ name: "API Smoke Board", description: "Temporary CI board" })
  });
  assert.equal(created.res.status, 201);
  assert.ok(created.body.memberIds.includes(adminLogin.body.user.id));

  const createdDetail = await request("/boards/" + created.body.id, {
    headers: { Authorization: "Bearer " + adminToken }
  });
  assert.equal(createdDetail.res.status, 200);

  const task = await request("/tasks", {
    method: "POST",
    headers: { Authorization: "Bearer " + adminToken },
    body: JSON.stringify({
      listId: createdDetail.body.lists[0].id,
      title: "API smoke task",
      priority: "medium"
    })
  });
  assert.equal(task.res.status, 201);

  const moved = await request("/tasks/" + task.body.id, {
    method: "PATCH",
    headers: { Authorization: "Bearer " + adminToken },
    body: JSON.stringify({ listId: createdDetail.body.lists[1].id })
  });
  assert.equal(moved.res.status, 200);
  assert.equal(moved.body.listId, createdDetail.body.lists[1].id);

  const deleted = await request("/tasks/" + task.body.id, {
    method: "DELETE",
    headers: { Authorization: "Bearer " + adminToken }
  });
  assert.equal(deleted.res.status, 204);

  const adminUsers = await request("/users", {
    headers: { Authorization: "Bearer " + adminToken }
  });
  assert.equal(adminUsers.res.status, 200);
  assert.ok(adminUsers.body.length >= 2);
});
server.on("exit", code => {
  if (code !== 0) process.stderr.write(`TaskFlow server exited with code ${code}\n`);
});
t.after(() => server.kill());
