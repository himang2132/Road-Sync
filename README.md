# RoadSync — Smart Road-Cutting Coordination and Scheduling System

A beginner-friendly academic Operating Systems PBL MVP built with **Node.js, Express, HTML, CSS, JavaScript and JSON-file persistence**. It does not require Python or a separate database server.

## Project folder structure

```text
roadsync-project/
├── backend/
│   └── server.js          # Express server, APIs, authentication and OS coordination logic
├── frontend/
│   ├── index.html         # Main webpage
│   ├── styles.css         # UI styling
│   └── app.js             # Frontend interactions and API calls
├── database/
│   ├── db.json            # Persistent application data
│   └── seed.js            # Creates/resets demo data
├── package.json
├── .gitignore
└── README.md
```

## Requirements
- Node.js 18 or newer (recommended: current LTS)
- VS Code
- Internet only for the optional Google Fonts import; core app functionality does not require it

## Run in VS Code (Windows)
1. Extract the ZIP to a normal folder, for example `Desktop\RoadSync`.
2. Open the extracted `roadsync-project` folder in VS Code (`File → Open Folder`).
3. Open `Terminal → New Terminal`.
4. Install dependencies once:
   ```powershell
   npm install
   ```
5. Seed or reset demo data (optional; this resets local demo data):
   ```powershell
   npm run seed
   ```
6. Start the application:
   ```powershell
   npm run dev
   ```
7. Open **http://localhost:4000** in Chrome or Edge.
8. Keep the terminal running while using the application. Press `Ctrl+C` to stop it.

If port 4000 is already in use, stop the other RoadSync/Node terminal first. Or use another port:
```powershell
$env:PORT=4001; npm run dev
```
Then open `http://localhost:4001`.

## Demo accounts
| Role | Email | Password |
|---|---|---|
| Admin | `admin@roadsync.gov` | `Admin@12345` |
| Electricity | `electricity@road.gov` | `Demo@12345` |
| Water Supply | `water@road.gov` | `Demo@12345` |
| Telecom | `telecom@road.gov` | `Demo@12345` |
| Public Works | `pwd@road.gov` | `Demo@12345` |

The login screen includes demo buttons to fill these credentials.

## How the folders are connected
- `backend/server.js` serves the static frontend from `frontend/` using Express.
- The browser loads `frontend/index.html`, `frontend/styles.css` and `frontend/app.js` from the same server and port.
- `frontend/app.js` calls the Express API routes; no separate frontend development server is required.
- The backend reads and writes `database/db.json` using its `readDB()` and `writeDB()` functions.
- `database/seed.js` initializes the same `database/db.json` file when `npm run seed` is run.

## Implemented
- Session-based login and separate admin/department views.
- Department request submission and request tracking.
- Admin road segment creation and restriction periods; relevant departments receive notifications.
- Admin request approval/rejection, overlap checks on the same road segment, and joint-work proposal grouping.
- Deadline-first automatic scheduling with priority tie-break; it will not schedule overlapping approved work on the same segment.
- Common month calendar with approved work, restrictions and active cooldowns.
- Completion action starts cooldown from actual completion time.
- Notification inbox, mark-as-read, coordination settings, audit trail and CSV export.
- OS concept monitor mapping request statuses to simplified process states.
- JSON persistence in `database/db.json`; data remains after a server restart.

## Important academic/production limitations
- This is an academic MVP, not production-ready municipal software. Do not use real citizen/department credentials or sensitive data.
- JSON persistence is suitable for a single local demo only. For multi-user production deployments, use a database with proper transactions and constraints.
- Login uses local demo accounts and Express's in-memory session store. Configure a strong `SESSION_SECRET`, HTTPS, a production session store, rate limiting and security review before deployment.
- On the first request for a road segment, the system starts a configurable collection window and notifies all departments. After that window closes, new requests for that segment are blocked until the administrator resets/reopens coordination (manual reopening UI is not included yet).
- Merge is a proposal, not an automatic guarantee that two work activities can safely be combined.
- OS process states are educational application-level simulations; Node.js does not spawn an OS process for every request.
- The scheduler checks request deadlines and priority, but this MVP does not implement all classical CPU scheduling algorithms as separate selectable schedulers.

## Troubleshooting
- `npm is not recognized`: install Node.js LTS and restart VS Code.
- `EADDRINUSE` on port 4000: another process is already listening. Stop the old server terminal with `Ctrl+C`, or use the alternate port command above.
- Login fails: run `npm run seed` to reset demo accounts. This also resets demo requests and settings.
- If the page is blank, check the terminal for errors and refresh `http://localhost:4000`.
