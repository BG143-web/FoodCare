# FoodCare Backend Architecture & Implementation Plan

Comprehensive website analysis and complete Node.js + MySQL backend architecture for the FoodCare food rescue and surplus management platform.

---

## User Review & Critical Decisions

> [!IMPORTANT]
> The recommendations below establish a production-grade backend aligned with the existing 9 frontend pages while preparing for real-world deployment.

- **Primary Database Engine**: Standard relational **MySQL 8.0+** using `mysql2/promise` connection pooling. During local standalone prototyping where an external MySQL daemon may not be reachable, an automated SQLite/in-memory fallback mirroring exact MySQL SQL syntax is provided so the development server runs without crashing.
- **Authentication & Security**: Stateless **JSON Web Tokens (JWT)** delivered via `httpOnly` secure cookies (with Bearer header support). Passwords hashed using **bcrypt** (salt rounds = 10).
- **Role-Based Access Control (RBAC)**: Two strict authorization tiers enforced via Express middleware:
  - `donor`: Allowed to create and manage food listings, accept/reject requests, and mark handovers.
  - `seeker`: Allowed to browse listings, submit portion requests, and track distributions.
- **Frontend Integration Strategy**: Zero breaking changes to existing HTML/CSS. `js/api.js` will be updated to replace localStorage mocks with real asynchronous `fetch('/api/...')` calls matching the exact function signatures already in use.

---

## 1. Overview & Core Concept

### What It Does
FoodCare connects restaurants, hotels, bakeries, caterers, and households with surplus edible food to local shelters, NGOs, community pantries, and individuals in need. The backend coordinates real-time inventory tracking, request approvals, and distribution history, preventing edible food waste and reducing greenhouse gas emissions.

### Target Personas
1. **Donors (Food Providers)**: Commercial kitchens, event caterers, restaurants, and grocers who need a fast, frictionless flow to list excess inventory before expiration.
2. **Food Seekers (Community Recipients)**: Shelters, charities, and community representatives seeking verified, safe meals and raw produce for local distribution.

### Key Value
- **Zero-Waste Redistribution**: Minimizes the window between surplus creation and community consumption.
- **Transparent Accountability**: Tracks food quantities, temperature/handling notes, and pickup verification across all stages.
- **Dignified Aid**: Replaces ad-hoc food dumping with scheduled, respectful community collections.

---

## 2. Website Analysis & User Experience Flow

### Existing Frontend Surface Analysis

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                             FOODCARE FRONTEND MAP                           │
├─────────────────────┬───────────────────────────────────────────────────────┤
│ PAGE                │ CORE DATA & INTERACTIONS                              │
├─────────────────────┼───────────────────────────────────────────────────────┤
│ index.html          │ Public aggregates: Meals Saved, Donors, Seekers, CO2  │
│ login.html          │ Credentials (email, password), Role selector          │
│ register.html       │ Profile creation, org/business name, terms validation │
│ donor-dashboard.html│ Metrics (Total, Available, Pending, Completed), Add   │
│                     │ Surplus Food modal, active donation cards             │
│ seeker-dashboard.html│ Live food search, category tabs (Cooked, Bakery, etc)│
│ food-details.html   │ Dynamic item view (?id=...), pickup notes, Request btn│
│ requests.html       │ Pending/Accepted/Rejected/Completed tabs, Accept/Reject│
│ profile.html        │ Read/edit profile, contact info, physical address    │
│ history.html        │ Historical log of completed donations & requests      │
└─────────────────────┴───────────────────────────────────────────────────────┘
```

### End-to-End User Experience Lifecycle

```
[Donor Flow]
  1. Register/Login (Role: Donor)
  2. Donor Dashboard -> Open "+ Add Surplus Food" Modal
  3. POST /api/foods (Title, Category, Quantity, Expiry, Location, Notes)
  4. Listing becomes active for all nearby Seekers
  5. Seeker requests food -> Donor notified on dashboard
  6. Donor reviews requests -> PUT /api/requests/:id (Status: Accepted)
  7. Physical handover -> PUT /api/requests/:id (Status: Completed)
  8. Auto-increments Meals Saved & Waste Diverted metrics

[Seeker Flow]
  1. Register/Login (Role: Food Seeker)
  2. Seeker Dashboard -> Browse & filter surplus listings
  3. View Details -> food-details.html?id=:id
  4. POST /api/requests (Food ID, Portions, Notes)
  5. Monitor requests.html -> Status updates: Pending -> Accepted
  6. Collect food from donor pickup address -> Handover verified
```

---

## 3. Key Product Decisions & Trade-Offs

### Decision 1: Node.js Express REST API vs. Monolithic SSR
- **Chosen Approach**: Lightweight Express REST API mounted under `/api/*` serving JSON, keeping the frontend completely decoupled as static HTML/CSS/JS.
- **Why**: The frontend is already built with pristine vanilla HTML/CSS. A decoupled REST layer allows the same backend to power mobile apps or SMS gateways in future phases.
- **Alternative Considered**: Server-side rendering (EJS/Pug). Rejected because it would require rewriting the existing 9 HTML pages.

### Decision 2: MySQL Relational Schema vs. NoSQL Document Store
- **Chosen Approach**: MySQL 8.0 with InnoDB transactional engine and foreign key constraints (`ON DELETE CASCADE` / `ON DELETE RESTRICT`).
- **Why**: Food donation involves inventory reservation and status transitions (Available -> Claimed -> Completed). Relational transactions prevent race conditions (e.g., two seekers simultaneously claiming the same batch).
- **Alternative Considered**: MongoDB. Lacks native transactional guarantees needed for concurrent portion claims.

### Decision 3: Image Handling Strategy
- **Chosen Approach**: Hybrid approach. High-resolution default category illustrations for instant mock data, with Multer middleware storing user-uploaded donor photos in `/uploads/foods` served via Express static files.
- **Why**: Zero external cloud dependency required during local testing, but seamlessly swappable with AWS S3 or Google Cloud Storage via standard storage adapters.

---

## 4. Technical Architecture & Data Strategy

### System Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                            FOODCARE ARCHITECTURE                            │
└─────────────────────────────────────────────────────────────────────────────┘

 [ Client Layer - Vanilla HTML/CSS/JS ]
   │
   │ fetch('/api/...') with JWT Cookie / Bearer Header
   ▼
 [ Express Server (server.ts / server.js) ]
   ├── Middleware Stack:
   │    ├── cors() & helmet() & express.json()
   │    ├── cookieParser()
   │    └── rateLimit() (Anti-abuse protection)
   │
   ├── Authentication Router (/api/auth)
   │    ├── POST /register   ───► bcrypt.hash() ───► INSERT INTO users
   │    ├── POST /login      ───► bcrypt.compare() ──► Generate JWT Cookie
   │    └── POST /logout     ───► Clear Cookie
   │
   ├── Core Application Routers (Protected via authenticateToken & authorizeRole)
   │    ├── /api/foods       ───► Food inventory CRUD & category search
   │    ├── /api/requests    ───► Claim lifecycle (Pending, Accepted, Rejected)
   │    ├── /api/users       ───► Profile read & update
   │    └── /api/stats       ───► Public & personal dashboard metrics
   │
   └── MySQL Database Connection Pool (mysql2/promise)
        ├── users Table
        ├── foods Table
        ├── food_requests Table
        └── audit_history Table
```

### Complete MySQL Database Schema (DDL)

```sql
-- 1. Users Table
CREATE TABLE IF NOT EXISTS users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  full_name VARCHAR(120) NOT NULL,
  email VARCHAR(160) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  phone VARCHAR(30) NOT NULL,
  role ENUM('donor', 'seeker') NOT NULL,
  organization_name VARCHAR(180) NULL,
  address TEXT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_users_email (email),
  INDEX idx_users_role (role)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 2. Foods (Surplus Listings) Table
CREATE TABLE IF NOT EXISTS foods (
  id INT AUTO_INCREMENT PRIMARY KEY,
  donor_id INT NOT NULL,
  title VARCHAR(200) NOT NULL,
  category ENUM('Cooked Food', 'Bakery', 'Fresh Produce', 'Dairy', 'Packaged Food') NOT NULL,
  quantity VARCHAR(80) NOT NULL,
  location VARCHAR(200) NOT NULL,
  available_until VARCHAR(100) NOT NULL,
  status ENUM('Available', 'Reserved', 'Completed', 'Cancelled') NOT NULL DEFAULT 'Available',
  description TEXT NULL,
  pickup_notes TEXT NULL,
  image_url VARCHAR(500) NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (donor_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_foods_status (status),
  INDEX idx_foods_category (category)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 3. Food Requests Table
CREATE TABLE IF NOT EXISTS food_requests (
  id INT AUTO_INCREMENT PRIMARY KEY,
  food_id INT NOT NULL,
  seeker_id INT NOT NULL,
  quantity_requested VARCHAR(80) NOT NULL,
  notes TEXT NULL,
  status ENUM('Pending', 'Accepted', 'Rejected', 'Completed') NOT NULL DEFAULT 'Pending',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (food_id) REFERENCES foods(id) ON DELETE CASCADE,
  FOREIGN KEY (seeker_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_requests_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 4. Audit & History Table
CREATE TABLE IF NOT EXISTS distribution_history (
  id INT AUTO_INCREMENT PRIMARY KEY,
  request_id INT NOT NULL,
  food_id INT NOT NULL,
  donor_id INT NOT NULL,
  seeker_id INT NOT NULL,
  quantity_completed VARCHAR(80) NOT NULL,
  meals_saved_estimate INT DEFAULT 0,
  waste_kg_estimate DECIMAL(8, 2) DEFAULT 0.00,
  completed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (request_id) REFERENCES food_requests(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

---

### REST API Endpoints Specification

| Method | Endpoint | Access | Description |
| :--- | :--- | :--- | :--- |
| `POST` | `/api/auth/register` | Public | Create new donor or seeker account with hashed password |
| `POST` | `/api/auth/login` | Public | Verify credentials, return user object, set JWT cookie |
| `POST` | `/api/auth/logout` | Authenticated | Invalidate session / clear auth cookie |
| `GET` | `/api/auth/me` | Authenticated | Retrieve currently signed-in user session |
| `GET` | `/api/foods` | Public | Retrieve food listings (supports `?category=...&search=...`) |
| `GET` | `/api/foods/:id` | Public | Get complete details and donor contact for a single food item |
| `POST` | `/api/foods` | Donor only | Create a new surplus food listing |
| `PUT` | `/api/foods/:id` | Donor only | Update listing details or status |
| `DELETE` | `/api/foods/:id` | Donor only | Remove listing |
| `GET` | `/api/requests` | Authenticated | Get requests (Donors see incoming; Seekers see submitted) |
| `POST` | `/api/requests` | Seeker only | Submit portion claim for a food listing |
| `PUT` | `/api/requests/:id` | Authenticated | Update status (`Accepted`, `Rejected`, `Completed`) |
| `GET` | `/api/users/profile` | Authenticated | Get current user's profile information |
| `PUT` | `/api/users/profile` | Authenticated | Update contact person, address, or organization |
| `GET` | `/api/stats/summary` | Public | Global platform metrics (Meals Saved, Donors, Seekers, Waste) |
| `GET` | `/api/history` | Authenticated | Retrieve completed donations or distributions |

---

### Step-by-Step Implementation Sequence

1. **Step 1: Backend Server Scaffold & Database Pool**
   - Create `server.ts` / Express server mounted with JSON parser, cookie parser, and logging.
   - Configure MySQL connection pool using environment variables (`MYSQL_HOST`, `MYSQL_USER`, `MYSQL_PASSWORD`, `MYSQL_DATABASE`) with automatic schema bootstrap on boot.

2. **Step 2: Authentication Engine & Middlewares**
   - Implement `/api/auth` routes with `bcryptjs` and `jsonwebtoken`.
   - Build `authenticateToken` and `requireRole('donor' | 'seeker')` middlewares.

3. **Step 3: Food Listing API**
   - Implement `GET /api/foods`, `POST /api/foods`, `GET /api/foods/:id`, `PUT /api/foods/:id`.
   - Add search and category query filtering in SQL.

4. **Step 4: Request & Handover Workflow**
   - Implement `POST /api/requests` and status transition handlers (`Accepted`, `Rejected`, `Completed`).
   - Automatically log completed requests to `distribution_history`.

5. **Step 5: Frontend Bridge & Verification**
   - Update `js/api.js` to execute real `fetch()` calls against the newly created REST endpoints.
   - Verify every flow: User Registration -> Donor Listing -> Seeker Claim -> Donor Approval -> Completed Handover.
