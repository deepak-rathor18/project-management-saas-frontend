# Taskflow Frontend

## 1. Project overview

Taskflow's frontend is a responsive single-page application for organization-based project and task management. It is built with React, TypeScript, and Vite, and connects to the separately deployable Taskflow REST API. This directory is intended to be usable as its own repository.

## 2. Features

- Register, sign in, and sign out using JWT authentication managed by the backend.
- Switch between organizations (also called workspaces) and browse accessible projects.
- View role-appropriate dashboards, projects, organization members, project and workspace activity, and account details.
- Browse the selected workspace's authorized activity history with server-side pagination.
- Use a project-level Kanban board with TODO, IN_PROGRESS, IN_REVIEW, and COMPLETED task columns.
- Move tasks between statuses by dragging task cards or using the accessible status selector; status changes are persisted through the backend.
- Search and filter project tasks, browse them with server-side pagination, inspect task details, add comments, and update permitted task information.
- Show backend errors as React Toastify notifications.
- Responsive layouts and accessible controls with keyboard focus states.

The frontend improves the experience but does not enforce authorization. The backend remains the source of truth for access and permissions.

## 3. Tech stack

- React 18
- TypeScript 5
- Vite 6
- React Router 6
- Axios
- Lucide React icons
- React Toastify
- Tailwind CSS utilities for exact, reusable layout primitives; custom CSS for the application design system and responsive styling.

## 4. Architecture overview

The app uses React Router for page navigation and an authentication context for the signed-in user. At startup, it validates a stored token with `/auth/me` before rendering routes; expired sessions are cleared. Route components are lazy-loaded so users download each page's code when they navigate to it. The application shell provides navigation and selected-organization context. Tailwind's utility layer is enabled without its preflight reset, preserving the existing browser defaults; bespoke component and breakpoint rules remain in `src/styles.css`. Page components call a shared Axios client, which attaches the stored bearer token and surfaces API errors to the UI. The frontend stores no project-management records: it reads and updates them through the backend API.

```text
Browser
  React pages and components
    Auth context + shared Axios client
      HTTPS requests with bearer token
        Separately deployed Taskflow backend (/api)
```

## 5. Database design / ER-style explanation

The frontend does not connect directly to MongoDB or define the persisted database schema. It renders API representations of these backend entities and their relationships:

```text
User --< Organization.members
Organization --< Project
Project --< Task
User --< Task (reporter)
User --< Task (optional assignee)
Task --< Comment >-- User (author)
Organization --< Activity >-- User (actor)
Project --< Activity
Task --< Activity (optional)
```

Organizations contain users with organization roles. Projects belong to organizations and contain members/managers. Tasks belong to projects and may have an assignee. Comments belong to tasks. Activity records describe actions within an organization and optionally reference a project or task. For persisted schema and indexes, see the backend README.

## 6. API documentation

Set `VITE_API_URL` to the backend API root, including `/api`. Protected endpoints require the bearer token managed by the frontend authentication context.

| Method | Endpoint | API purpose |
|---|---|---|
| `POST` | `/api/auth/register` | Create an account |
| `POST` | `/api/auth/login` | Sign in |
| `POST` | `/api/auth/logout` | Sign-out acknowledgement |
| `GET` | `/api/auth/me` | Validate the stored session and return the current account at startup |
| `GET`, `POST` | `/api/organizations` | List organizations or create one |
| `GET`, `PUT` | `/api/organizations/:id` | Read or update organization details |
| `GET` | `/api/organizations/:id/dashboard` | Load dashboard data |
| `GET` | `/api/organizations/:id/activity` | Load authorized workspace activity history (`page`, `limit`) |
| `POST` | `/api/organizations/:id/members` | Add a registered member |
| `PATCH`, `DELETE` | `/api/organizations/:id/members/:userId` | Change a member role or remove a member |
| `GET`, `POST` | `/api/projects` | List accessible projects or create a project |
| `GET`, `PUT`, `DELETE` | `/api/projects/:id` | Read, update, or archive a project |
| `POST` | `/api/projects/:id/members` | Add a project member |
| `PATCH`, `DELETE` | `/api/projects/:id/members/:userId` | Change a project role or remove a member |
| `GET` | `/api/projects/:id/activity` | Load project activity |
| `GET`, `POST` | `/api/projects/:projectId/tasks` | List or create tasks |
| `GET`, `PUT`, `DELETE` | `/api/tasks/:taskId` | Read, update, or delete a task |
| `PATCH` | `/api/tasks/:taskId/status` | Persist a task status change from the board |
| `PATCH` | `/api/tasks/:taskId/assignee` | Assign or unassign a task |
| `GET`, `POST` | `/api/tasks/:taskId/comments` | Load or add task comments |
| `PUT`, `DELETE` | `/api/comments/:commentId` | Edit or delete a comment |
| `GET` | `/api/health` | Check backend health |

The task-list API supports `page`, `limit`, `status`, `priority`, `assignee`, `search`, and `sort`. The project board displays 50 tasks per page and provides Previous/Next controls.

## 7. Environment variables

Create `.env` from `.env.example`:

| Variable | Required | Purpose |
|---|---|---|
| `VITE_API_URL` | Yes | Backend API base URL, including `/api` |

Vite includes `VITE_` variables in the browser build. Use this only for public configuration; never put database credentials, private keys, or JWT signing secrets in frontend variables.

## 8. Local setup instructions

Requirements: Node.js 20 or later and a running local Taskflow backend.

```powershell
npm install
Copy-Item .env.example .env
npm run dev
```

Confirm `.env` contains `VITE_API_URL=http://localhost:5000/api`, adjusting the port if needed. Open the local URL printed by Vite (usually `http://localhost:5173`). In development, the backend allows HTTP origins on localhost, 127.0.0.1, and ::1; in production, configure `CLIENT_URL` with the exact deployed frontend origin.

Available commands:

| Command | Description |
|---|---|
| `npm run dev` | Start the Vite development server |
| `npm run build` | Type-check with TypeScript and build the app into `dist/` |
| `npm run preview` | Preview the production build locally |

## 9. Deployment instructions

1. Deploy the backend separately and note its public API URL.
2. Set `VITE_API_URL` to that URL with `/api` appended. Vite environment values are applied at build time.
3. Run `npm install` and `npm run build`.
4. Deploy the generated `dist/` directory to a static hosting provider.
5. Configure SPA fallback/rewrite behavior to serve `index.html` for app routes.
6. Configure the backend CORS allowlist (`CLIENT_URL`) for the exact deployed frontend origin.

Never add backend secrets to frontend environment variables or the built static site.

## 10. Test credentials

The frontend does not create or store test accounts. For local development, use the demo accounts seeded by the backend. From the backend directory, configure a development-only database and run `node src/seed.js`. All accounts share password `Test@123456`:

| Role | Email |
|---|---|
| Organization owner | `owner@example.com` |
| Organization admin | `admin@example.com` |
| Project manager | `manager@example.com` |
| Member | `member1@example.com` |
| Member | `member2@example.com` |

These are development-only credentials; do not use them in production.

## 11. Known limitations

- The app requires a reachable backend and has no offline mode or real-time updates.
- The board shows 50 tasks per page; very large boards require navigating pages rather than viewing every task column at once.
- The UI depends on backend authorization responses; frontend visibility is not a security boundary.
- Automated UI test coverage is limited.
- The dashboard shows the five newest workspace activities; the dedicated activity page uses server-side pagination.

## 12. Future improvements

- Add board pagination or incremental task loading for larger projects.
- Add real-time updates and notifications.
- Expand automated component, accessibility, and end-to-end tests.
- Add offline-friendly loading and retry experiences.

## 13. AI tools used

Copilot SDK in VS Code assisted with implementation and documentation. Review and understand generated changes, and verify API behavior against the separately deployed backend before production use or submission.
