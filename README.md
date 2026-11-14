# TaskFlow — Project Management Dashboard

TaskFlow is a full-stack project management dashboard built as the final project of a four-week internship project series. It provides a focused workspace for organizing boards, lists, tasks, team members, priorities, due dates, and project progress.

## Highlights

- JWT authentication with registration and login
- Admin and member roles
- Protected board access and ownership checks
- Multiple project boards
- Board creation and settings
- Custom workflow lists
- Task creation and editing
- Drag-and-drop task movement
- Task priorities, assignees, descriptions, labels, and due dates
- Search across task titles and descriptions
- Admin team-management panel
- Persistent JSON data store
- Responsive dark dashboard UI
- REST API
- API smoke tests
- GitHub Actions CI for frontend builds and backend validation

## Tech Stack

| Layer | Technology |
| --- | --- |
| Frontend | React 19, Vite, Lucide React |
| Backend | Node.js, Express 5 |
| Authentication | JWT, bcryptjs |
| Persistence | JSON file database |
| Styling | Custom responsive CSS |
| CI | GitHub Actions |

## Project Structure

```text
TaskFlow-Project-InternshipW4/
├── backend/
│   ├── data/
│   │   └── db.json
│   ├── test/
│   │   └── api.test.js
│   ├── package.json
│   └── server.js
├── frontend/
│   ├── src/
│   │   ├── App.jsx
│   │   ├── main.jsx
│   │   └── styles.css
│   ├── index.html
│   ├── package.json
│   └── vite.config.js
├── .env.example
├── .github/workflows/ci.yml
├── package.json
└── README.md
```

## Run Locally

Requirements:
- Node.js 20+
- npm

Install everything:

```bash
npm install
npm run install:all
```

Start frontend and backend together:

```bash
npm run dev
```

Open:
- Frontend: http://localhost:5173
- API: http://localhost:5000
- Health check: http://localhost:5000/api/health

For PowerShell environments where `npm.ps1` is blocked, use:

```powershell
npm.cmd run dev
```

## Demo Accounts

The backend creates demo accounts automatically on the first run when the database is empty.

### Admin

```text
Email: admin@taskflow.dev
Password: Admin@123
Role: admin
```

### Member

```text
Email: member@taskflow.dev
Password: Member@123
Role: member
```

Change demo credentials before using TaskFlow in a real deployment.

## API

| Method | Endpoint | Purpose |
| --- | --- | --- |
| GET | `/api/health` | API health check |
| POST | `/api/auth/register` | Register member |
| POST | `/api/auth/login` | Login |
| GET | `/api/me` | Current user |
| GET | `/api/boards` | Accessible boards |
| POST | `/api/boards` | Create board |
| GET | `/api/boards/:id` | Board details |
| PATCH | `/api/boards/:id` | Update board |
| POST | `/api/lists` | Add list |
| POST | `/api/tasks` | Create task |
| PATCH | `/api/tasks/:id` | Update/move task |
| DELETE | `/api/tasks/:id` | Delete task |
| GET | `/api/users` | Admin user list |
| DELETE | `/api/users/:id` | Admin user removal |

Protected endpoints require:

```text
Authorization: Bearer <JWT>
```

## Testing

Run the backend API smoke suite:

```bash
npm test --prefix backend
```

The suite validates health checks, authentication, board creation, protected board access, list retrieval, task creation, task movement, task deletion, and admin user access.

Build the frontend:

```bash
npm run build
```

GitHub Actions runs both the frontend build and backend API validation on pushes and pull requests to `main`.

## Configuration

Copy `.env.example` when configuring a local or hosted frontend:

```text
VITE_API_URL=http://localhost:5000/api
```

The backend supports:

```text
PORT=5000
JWT_SECRET=replace-with-a-long-random-secret
NODE_ENV=production
```

## Security Notes

TaskFlow is designed as an internship/demo application. Before production use:

1. Set a strong `JWT_SECRET`.
2. Replace the seeded demo passwords.
3. Configure a specific CORS origin instead of permissive development CORS.
4. Replace JSON persistence with a managed database.
5. Add rate limiting, refresh-token/session rotation, audit logging, and HTTPS.
6. Use production secrets through the hosting provider rather than committing them.

## Internship Outcome

TaskFlow demonstrates a complete project-management workflow rather than a static UI:

**Authentication → Workspace → Boards → Lists → Tasks → Assignment → Drag & Drop → Progress Tracking → Administration → Persistence**

It is intended to be the final full-stack deliverable for Week 4 of the internship project series.
