# CleanTrack Uganda backend

CleanTrack Uganda is a web-based waste collection management application that connects customers, drivers, waste collection company managers, and administrators. Customers can report waste collection needs and manage pickup requests, while drivers and managers coordinate collection work. The project has a React frontend, a Node.js/Express REST API, and a MySQL/MariaDB database.

This version extends the original application with three additional features: recurring pickup schedules, customer recycling rewards, and pickup rescheduling requests.

## Main Features

### Existing application features

- User registration and login with JWT authentication.
- Role-based access for customers, drivers, company managers, and administrators.
- Customer locations and waste pickup requests.
- Pickup assignment and status updates for collection staff.
- Company and truck management.
- Waste category management, customer feedback, and photo uploads for pickup reports and collection proof.

### Added features

1. **Recurring pickup schedules** — customers can create weekly or monthly schedules linked to their saved locations, view their schedules, and pause, reactivate, or cancel them. The backend checks for due schedules when it starts and every 24 hours, then creates the corresponding pickup requests. Generated requests still need to be assigned through the existing manager workflow.
2. **Customer recycling rewards** — a customer earns 10 points when a pickup is successfully completed by a driver. The points history is stored in the database, and a completed pickup should not earn points more than once.
3. **Pickup rescheduling** — customers can request a future date for an eligible pickup. A manager can review requests for pickups assigned to their company; an administrator can review pending requests through the API. Approving a request updates the pickup's scheduled date.

## Technology Stack

- **Frontend:** React, Vite, React Router, Axios, and Bootstrap.
- **Backend:** Node.js, Express, `mysql2`, JWT authentication, `bcrypt`, and Multer for image uploads.
- **Database:** MySQL or MariaDB.
- **API style:** REST endpoints under `/api`.

## Project Structure

The frontend and backend are maintained as separate projects:

```text
CleanTrack/
├── cleantrack-frontend/
│   ├── src/components/     # Shared UI components and route guards
│   ├── src/context/        # Authentication context
│   ├── src/layouts/        # Public and dashboard layouts
│   ├── src/pages/          # Customer, driver, manager, and admin pages
│   ├── src/services/       # Axios requests grouped by feature
│   └── src/App.jsx         # Frontend routes
└── cleantrack-backend/
    ├── config/             # Database connection
    ├── controllers/        # Request handling and business logic
    ├── middleware/         # Authentication, role checks, and uploads
    ├── routes/             # API route definitions
    ├── database/           # Schema, seed data, and migration SQL
    ├── scripts/            # Database setup helper
    └── server.js            # Express application entry point
```

## Requirements

Install the following before running the project:

- A compatible Node.js and npm version.
- MySQL or MariaDB running locally.
- A terminal and a browser.

## Setup and Run Locally

Run the backend and frontend in separate terminals. The commands below assume both folders are in the same parent directory.

### 1. Configure the backend

```bash
cd cleantrack-backend
npm install
cp .env.example .env
```

Open `cleantrack-backend/.env` and set the database connection details and a long, random `JWT_SECRET`. The example configuration uses:

```env
PORT=5000
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=root
DB_NAME=cleantrack_uganda
JWT_SECRET=replace_with_a_long_random_secret
JWT_EXPIRES_IN=1d
FRONTEND_URL=http://localhost:5173
```

These values are examples for local development. Use the username and password configured on your own computer; do not commit real credentials to Git.

### 2. Set up the database

**For a fresh local learning database only:**

```bash
npm run db:setup
```

This runs the supplied schema and seed scripts. The schema recreates the `cleantrack_uganda` database, so do not run this command if you need to preserve existing data.

**For an existing CleanTrack database that you want to preserve:**

1. Back up the database.
2. Open `database/migrations.sql` and confirm that its database name matches `DB_NAME` in `.env`.
3. Run the migration once from the backend directory, adjusting the username if necessary:

```bash
mysql -u root -p < database/migrations.sql
```

The migration adds the scheduled pickup date field and the tables required for recurring schedules, rewards, and rescheduling. It is intended as a migration for the existing schema, not as a replacement for `schema.sql`. If a migration was partially applied, inspect the database before running it again.

### 3. Start the backend

From `cleantrack-backend`:

```bash
npm run dev
```

The API normally runs at `http://localhost:5000`. Check that it responds by opening `http://localhost:5000/` or running:

```bash
curl http://localhost:5000/
```

### 4. Configure and start the frontend

Open a second terminal:

```bash
cd cleantrack-frontend
npm install
cp .env.example .env
```

Ensure `cleantrack-frontend/.env` contains the URL of your backend:

```env
VITE_API_URL=http://localhost:5000/api
```

Then start Vite:

```bash
npm run dev
```

Open the local URL printed by Vite, normally `http://localhost:5173`. The backend must be running at the same time. If you use a different backend port, update `VITE_API_URL`; if you use a different frontend port, update `FRONTEND_URL` in the backend environment and restart the backend.

## Using the Added Features

- **Recurring schedules:** Sign in as a customer and open **Recurring Schedules** in the customer navigation. Create a schedule using a location belonging to your account. Due pickup requests are generated by the backend; managers still assign drivers and trucks using the existing workflow.
- **Rewards:** Sign in as a customer and open **My Rewards**. Complete a pickup through the normal driver workflow first; then check the customer's points balance and transaction history.
- **Rescheduling:** Sign in as a customer and use **Reschedule Pickup** to request a future date for an eligible pickup. Sign in as the appropriate manager and open **Review Reschedules** to approve or reject requests.

The reward policy in this version awards 10 points per successfully completed pickup. Monthly schedules use days 1 through 28 so the recurrence is valid in every month.

## Test Accounts

The supplied seed data documents these example accounts. All use the password `password123`:

- Administrator: `admin@cleantrack.ug`
- Customer: `customer@cleantrack.ug`
- Driver: `driver1@cleantrack.ug`
- Manager: `manager@greenroute.ug`

Use these accounts only in a local learning environment. Change or remove seeded credentials before any public deployment.

## Testing Checklist

After setup, test both new and existing workflows:

- Confirm login and the original pickup request workflow still work.
- Create a recurring schedule; verify it is saved, remains visible after logging in again, and can be paused or cancelled.
- Try invalid schedule dates and a location owned by another customer; the API should reject invalid or unauthorised requests.
- Complete a pickup as the assigned driver and confirm the customer receives 10 points once, with a transaction visible in the rewards page.
- Request a future rescheduling date; confirm an authorised manager can approve or reject it and that approval updates the pickup date.
- Try past dates, another customer's pickup, duplicate pending requests, and requests from unauthorised roles.
- Record the test steps, expected result, actual result, and pass/fail outcome. Capture screenshots for the assignment report.

## Security and Project Notes

- Copy `.env.example` to `.env`; never commit `.env`, real credentials, or private user data.
- The API uses JWT authentication and role/ownership checks for protected operations.
- Uploaded photos are stored under the backend's `uploads/` folders during local development.
- Preserve the original project's attribution and record meaningful Git commits for your additions.
- Disclose any AI assistance, external code, libraries, or references according to the lecturer's requirements.
- Before submission, run the application on your own machine and verify the complete frontend, backend, and database integration. In particular, test the added features and repeat the original login and pickup workflow; do not report tests as passed until you have run them.

## Known Behaviour and Limitations

- Recurring schedules generate pickup requests but do not automatically assign a truck or driver.
- Administrators can review pending rescheduling requests through the API; this version does not include a separate administrator review page.
- The feature bundle's backend JavaScript was syntax-checked, but a full frontend production build and live database integration test were not verified during preparation. Confirm them locally and document any issues you encounter.

## Attribution

CleanTrack Uganda is based on the original CleanTrack frontend and backend repositories. Retain the original authorship and repository attribution when modifying or redistributing the project.
