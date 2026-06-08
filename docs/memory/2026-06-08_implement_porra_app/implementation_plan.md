# Implementation Plan - Porra Deportiva World Cup 2026 Web Application

We will complete the implementation of the full-stack web application. The application consists of a **FastAPI backend** (which currently serves a Telegram webhook) and a **React + Vite frontend**.

We will design a sleek, premium, glassmorphic UI matching the palette defined in `frontend/src/index.css` (slate neutral scale with violet/purple accent) and implement backend REST endpoints for user authentication, match list retrieval, prediction management, and leaderboards.

---

## User Review Required

> [!IMPORTANT]
> - **Mock Authentication via Telegram:** Since there is no full OAuth setup, we will use a simple, secure username/ID lookup. Users register first in the Telegram bot using `/start`, and then sign in to the web app using their Telegram username/ID. The web app sends the user's `telegram_id` in a custom HTTP header (`X-Telegram-Id`) to authenticate API requests.
> - **Strict Betting Lock:** Once a match starts (`match.date <= utcnow`), the backend will block any prediction creation or updates.

---

## Proposed Changes

### 1. Code Quality & Mypy Fixes (Backend)

We will resolve the mypy strict errors in the current backend:
- Fix type signatures and return annotations (e.g. `-> None` for `__init__`, correct types for async generators).
- Fix SQLModel query attributes by using `sqlalchemy.desc(...)` and `sqlalchemy.asc(...)` instead of Python attribute calls.
- Add type ignores where SQLModel's dynamic attributes conflict with strict mypy checks.
- Clean up unused imports and un-sorted imports.

---

### 2. Backend REST Endpoints

 We will create a new API router in `backend/app/api/endpoints.py` containing the REST endpoints for the React app:

- `GET /api/matches`
  - Fetches matches from the DB.
  - Triggers lazy update from API-Sports if needed.
  - Returns match details.
- `GET /api/predictions`
  - Requires `X-Telegram-Id` header.
  - Returns predictions placed by the authenticated user.
- `POST /api/predictions`
  - Requires `X-Telegram-Id` header.
  - Payload: `{ "match_id": int, "home_score": int, "away_score": int }`
  - Validates that the match exists and has not started yet.
- `GET /api/leaderboard`
  - Returns classification list.
  - Returns a random humorous roast comment (the "consulada").
- `POST /api/auth`
  - Payload: `{ "username_or_id": string }`
  - Authenticates the user (verifies they exist in DB) and returns their `telegram_id` and details.

#### [NEW] [endpoints.py](file:///Users/e.sanchez/PROYECTOS/porra-deportiva/backend/app/api/endpoints.py)
#### [MODIFY] [main.py](file:///Users/e.sanchez/PROYECTOS/porra-deportiva/backend/app/main.py)
- Import and register the `endpoints.router` with prefix `/api`.

---

### 3. Frontend React Application

We will build a high-end dashboard inside `frontend/src`:
- A login screen allowing users to log in with their Telegram Username or Telegram ID.
- A beautiful dashboard layout with glassmorphic cards, smooth transitions, and dark mode compatibility.
- Tabs:
  - **Matches Tab:** View matches grouped by date/stage. If the match hasn't started, show editable fields to place/update predictions. If finished, show actual score, user prediction, and points earned.
  - **Leaderboard Tab:** Highlighting the top 3 users in a podium, listing all users with their points, and displaying a sarcastic "Technical Comment" (Roast) box with animations.
- Service module `frontend/src/services/api.ts` to coordinate backend API requests.

#### [NEW] [api.ts](file:///Users/e.sanchez/PROYECTOS/porra-deportiva/frontend/src/services/api.ts)
- HTTP client module for REST API operations.
#### [MODIFY] [App.tsx](file:///Users/e.sanchez/PROYECTOS/porra-deportiva/frontend/src/App.tsx)
- Replaces the default template with the dashboard application.
#### [MODIFY] [index.css](file:///Users/e.sanchez/PROYECTOS/porra-deportiva/frontend/src/index.css)
- Add premium layout classes and micro-animations for the dashboard.

---

## Verification Plan

### Automated Tests
- Run `uv run pytest` inside backend container to verify the new endpoints and validations work.
- Run linting and type-checking using `./scripts/verify.sh --fast`.

### Manual Verification
- Access the Vite development server on `http://localhost:3000`.
- Log in, place predictions, view the leaderboard, and check that the roast is fetched dynamically.
