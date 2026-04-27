# RuralCare Connect: Project Architecture & Documentation

## 1. Project Overview
**RuralCare Connect** is a multi-role web application designed to bridge the healthcare gap in rural areas. It provides a unified platform for **Patients** to find and reserve medical resources, **Hospitals** to manage their inventory and incoming requests, and **Government Officers** to audit resource allocation and identify shortages across districts.

---

## 2. Technology Stack

### Frontend (User Interface)
The UI was built to be lightweight, fast, and mobile-responsive without relying on heavy frontend frameworks (like React or Angular) to ensure high performance.
* **HTML5:** Semantic structure for the Single Page Application (SPA) layout.
* **Vanilla CSS (Custom Styles):** 
  * Responsive grid systems for dashboards.
  * Modern glassmorphism UI elements and gradients.
  * Dynamic data visualization (e.g., SVG rings changing from green to amber to red based on bed occupancy).
* **Vanilla JavaScript (ES6+):**
  * **DOM Manipulation:** Dynamically rendering views (`app.js`, `app2.js`, `app3.js`) without page reloads.
  * **Fetch API:** Communicating with the backend REST endpoints.
  * **State Management:** Using `localStorage` for JWT token storage and session persistence.

### Backend (Server & API)
* **Runtime Environment:** Node.js
* **Framework:** Express.js
* **Authentication:** JSON Web Tokens (JWT) for secure, stateless, role-based access control (RBAC). Middleware intercepts requests to ensure only authorized roles (Patient, Hospital, Govt) can access specific endpoints.
* **Architecture:** RESTful API with modularized routes (e.g., `/api/auth`, `/api/hospitals`, `/api/patients`).

### Database
* **Database Engine:** PostgreSQL via **Supabase** (managed cloud database).
* **Client Library:** `pg` (node-postgres) — raw SQL queries with an async connection pool.
* **Why Supabase?** Fully managed PostgreSQL with a live web dashboard (Table Editor), persistent cloud storage, free tier, and no server to maintain.
* **Schema Design:** Relational tables for Users, Patients, Hospitals, Resources, Bed Reservations, Medicine Reservations, and Audit Logs.

### Infrastructure & Deployment
* **Version Control:** Git & GitHub (`Nvaibhav29/ruralcare-connect`).
* **Hosting Platform:** Railway (railway.app) — hosts the Node.js/Express backend server.
* **Database Hosting:** Supabase (supabase.com) — managed PostgreSQL cloud database. No Railway Volume needed; all data is stored persistently in Supabase.

---

## 3. Deployment Details (How it runs)
1. **GitHub Integration:** The code lives on your GitHub repository. Railway is connected directly to this repository.
2. **Build & Run:** Whenever code is pushed to the `main` branch on GitHub, Railway automatically pulls it, runs `npm install`, and starts the server using the `npm start` (`node server.js`) command.
3. **Environment Variables:** Securely stored in Railway's variables dashboard:
   * `PORT=3000` (The port the Node.js server listens on)
   * `JWT_SECRET` (Cryptographic key for signing user tokens)
   * `DATABASE_URL` (Supabase PostgreSQL connection string — replaces old `DB_PATH`)
4. **Auto-Seeding:** On the very first boot (or if Supabase is empty), `db/seed.js` automatically populates the database with demo hospitals, baseline medicine stock, and admin accounts.
5. **No Volume Required:** Because all data lives in Supabase, Railway's ephemeral filesystem is no longer a concern. The Railway Volume can be removed.

---

## 4. How to Access the System

**Live URL:** [https://ruralcare-connect-production.up.railway.app](https://ruralcare-connect-production.up.railway.app)

### Demo Credentials
* **Hospital Admin:** 
  * Login ID: `HOSP001`
  * Password: `hospital123`
* **Government / NHM Officer:**
  * Login ID: `GOVT001`
  * Password: `govt123`
* **Patient:**
  * Login ID: `9876543210`
  * Password: `patient123`
  * *(Note: New patients can also self-register from the login screen, and their accounts will persist securely).*

---

## 5. File & Folder Structure
* `server.js` - Main entry point. Sets up Express, static file serving, and API routes.
* `index.html` - The single HTML file that serves as the shell for the UI.
* `app.js` - Core frontend logic (routing, login logic, session management, patient UI).
* `app2.js` - Hospital Dashboard UI (Stats rings, pending counts) and Resource Updating logic.
* `app3.js` - Hospital Inbox UI (Managing Bed & Medicine Reservations).
* `routes/` - Backend Express routers, separated by feature (`auth.js`, `hospitals.js`, `medicines.js`, etc.).
* `db/` - Database logic (`database.js`), schema definitions (`schema.sql`), and seed data script (`seed.js`).
* `middleware/` - Contains `auth.js` to protect backend routes by verifying the user's JWT.

---

## 6. Key System Workflows Explained
1. **Patient Reservation Flow:** A patient logs in, searches for a bed or medicine, and submits a request. The frontend sends a `POST` request to the backend. The backend inserts a record into `bed_reservations` or `medicine_reservations` with the status `pending`.
2. **Hospital Confirmation (Transactions):** The Hospital Admin views the dashboard. The frontend polls the backend and shows "Pending Actions". The Admin clicks "Confirm". The backend runs a **DB Transaction**:
   * Changes the reservation status to `confirmed`.
   * **Auto-decrements** the `beds_free` or `icu_free` count in the `hospital_resources` table synchronously.
   * Logs the action in the `audit_log` for government tracking.
3. **Government Audit:** The Government Officer logs in to view district-wide resource levels, track specific shortages (like O2 cylinders dropping below safe levels), and review immutable audit logs of hospital actions.
