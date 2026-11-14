# TaskFlow — Project Management Dashboard

TaskFlow is a modern full-stack project management dashboard built for the final week of the internship project series.

## Features
- JWT authentication
- User registration and login
- Role-based access (admin/member)
- Workspace dashboard
- Boards, lists, and task cards
- Native drag-and-drop task movement
- Task priorities, assignees, due dates, labels, and descriptions
- Persistent JSON database
- Admin user management
- Responsive dark UI
- REST API

## Stack
React + Vite • Node.js • Express • JWT • JSON persistence

## Run
```bash
npm install
npm run install:all
npm run dev
```

Frontend: http://localhost:5173
Backend: http://localhost:5000

### Demo account
After first start, the API seeds:
- Email: admin@taskflow.dev
- Password: Admin@123
- Role: admin

Change the password before production use.
