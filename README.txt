================================================================================
  TASKFLOW — Team Task Manager
  Full-Stack Web Application
================================================================================

OVERVIEW
--------
TaskFlow is a full-stack team task management application with role-based access
control, project management, task tracking, and a real-time dashboard.

TECH STACK
----------
  Backend:  Node.js + Express.js
  Database: SQLite (via better-sqlite3)
  Auth:     JWT (jsonwebtoken) + bcryptjs
  Frontend: React 18 + React Router v6 + Vite
  Deploy:   Railway

FEATURES
--------
  ✅ Authentication (Signup / Login) with JWT
  ✅ Role-based access: Admin / Member
  ✅ Create and manage projects
  ✅ Invite team members to projects (by email)
  ✅ Create, assign, update, delete tasks
  ✅ Task statuses: To Do, In Progress, Done
  ✅ Task priorities: Low, Medium, High
  ✅ Due date tracking with overdue detection
  ✅ Dashboard with stats, my tasks, overdue tasks
  ✅ Filter tasks by status and priority
  ✅ Fully responsive UI

PROJECT STRUCTURE
-----------------
  team-task-manager/
  ├── backend/
  │   ├── db/
  │   │   └── database.js       # SQLite init & schema
  │   ├── middleware/
  │   │   └── auth.js           # JWT middleware, RBAC
  │   ├── routes/
  │   │   ├── auth.js           # POST /login, /signup, GET /me
  │   │   ├── projects.js       # CRUD projects + members
  │   │   ├── tasks.js          # CRUD tasks per project
  │   │   └── dashboard.js      # Stats + activity feed
  │   ├── seed.js               # Demo data seeder
  │   └── server.js             # Express entry point
  ├── frontend/
  │   ├── src/
  │   │   ├── components/
  │   │   │   └── Layout.jsx    # Sidebar + nav
  │   │   ├── context/
  │   │   │   └── AuthContext.jsx
  │   │   ├── pages/
  │   │   │   ├── Login.jsx
  │   │   │   ├── Signup.jsx
  │   │   │   ├── Dashboard.jsx
  │   │   │   ├── Projects.jsx
  │   │   │   └── ProjectDetail.jsx
  │   │   ├── utils/
  │   │   │   └── api.js        # Axios instance
  │   │   ├── App.jsx
  │   │   ├── index.css
  │   │   └── main.jsx
  │   ├── index.html
  │   └── vite.config.js
  ├── railway.toml
  ├── package.json
  └── .env.example

API ENDPOINTS
-------------
  Auth:
    POST  /api/auth/signup       Register new user
    POST  /api/auth/login        Login, returns JWT
    GET   /api/auth/me           Current user info

  Projects:
    GET   /api/projects          List accessible projects
    POST  /api/projects          Create project
    GET   /api/projects/:id      Project detail + members
    PUT   /api/projects/:id      Update project (admin)
    DELETE /api/projects/:id     Delete project (admin/owner)
    POST  /api/projects/:id/members    Add member by email
    DELETE /api/projects/:id/members/:userId  Remove member

  Tasks:
    GET   /api/projects/:id/tasks          List tasks (filterable)
    POST  /api/projects/:id/tasks          Create task
    PUT   /api/projects/:id/tasks/:taskId  Update task
    DELETE /api/projects/:id/tasks/:taskId Delete task

  Dashboard:
    GET   /api/dashboard         Stats + my tasks + overdue + recent

  Users:
    GET   /api/users             All users (for member search)

LOCAL SETUP
-----------
  1. Clone the repository
     git clone <your-github-repo-url>
     cd team-task-manager

  2. Install backend dependencies
     cd backend
     npm install

  3. Set environment variables
     cp ../.env.example .env
     # Edit .env with your JWT_SECRET

  4. Seed demo data (optional)
     node seed.js

  5. Start backend
     npm run dev     # development (nodemon)
     npm start       # production

  6. Install frontend dependencies (new terminal)
     cd frontend
     npm install

  7. Start frontend
     npm run dev     # runs on http://localhost:5173

  8. Open http://localhost:5173

DEMO CREDENTIALS
----------------
  Admin:  admin@demo.com  / admin123
  Member: member@demo.com / member123
  (Run seed.js first to create these accounts)

RAILWAY DEPLOYMENT
------------------
  1. Push code to GitHub

  2. Go to https://railway.app and create a new project
     → Deploy from GitHub repo

  3. Set environment variables in Railway dashboard:
     NODE_ENV=production
     JWT_SECRET=your_very_long_secret_here
     PORT=5000

  4. Railway auto-detects railway.toml and runs:
     Build:  npm install (backend+frontend) && vite build
     Start:  node backend/server.js

  5. The Express server serves both API and built React frontend

  6. Get your live URL from Railway dashboard

ROLE-BASED ACCESS CONTROL
--------------------------
  Global Admin (role=admin):
    - Access all projects and tasks
    - Delete any project or task

  Project Owner (creator):
    - Full control over their project
    - Add/remove members
    - Manage all tasks

  Project Admin (role in project_members):
    - Manage tasks and members within project

  Project Member:
    - View project and tasks
    - Create tasks
    - Edit own tasks

DATABASE SCHEMA
---------------
  users (id, name, email, password, role, created_at)
  projects (id, name, description, owner_id, created_at)
  project_members (project_id, user_id, role)
  tasks (id, title, description, status, priority,
         project_id, assignee_id, created_by, due_date,
         created_at, updated_at)

================================================================================
