# MFQATS

**MVCA Furniture Quality Assurance and Tracking System**: a capstone project (BSIT, National Teachers College) built
for MVCA Furniture's workshop in Caloocan City.

MFQATS follows each furniture order through a five-stage inspection before it is delivered:

**Upload → 3D Reconstruction → Detect Defects → Results → Recommendation**

Along the way it finds surface defects in photos (YOLOv12), measures the piece with a printed marker, checks surfaces
for dents and warping in 3D, and estimates delivery dates from past stage times (PERT and WMA).

## Who uses it

| Role | What they do |
|---|---|
| **Admin** (supervisor) | Approves orders, watches inspection progress and quality, handles rework, manages users, catalog and inventory, exports reports |
| **Staff** (worker) | Moves orders through the stages and inspects each piece on the Quality Scan page |
| **Customer** | Shops, places orders, follows their order's progress, asks questions |

## Get started

You need **Node.js 18+**, **Python 3.12+** and **Git**, plus two private files from the group (`.env` and the trained
model files). Full instructions: **[docs/setup/YOLO_SERVER_SETUP.md](docs/setup/YOLO_SERVER_SETUP.md)**.

The short version, once set up:

```powershell
# Terminal 1: detection server (defect detection, measuring, 3D)
.\.venv\Scripts\activate
uvicorn src.api.yolo_server:app --reload --port 8000 --env-file .env

# Terminal 2: website
npm run dev
```

Then open **http://localhost:4028**.

## Documentation

| I want to… | Read |
|---|---|
| Install and run the system | [docs/setup/YOLO_SERVER_SETUP.md](docs/setup/YOLO_SERVER_SETUP.md) |
| Test it on a laptop, phone or tablet | [docs/setup/DEVICE_TESTING.md](docs/setup/DEVICE_TESTING.md) |
| Understand how an order goes from purchase to delivery | [docs/project/SYSTEM_FLOW.md](docs/project/SYSTEM_FLOW.md) |
| Add a page or change the menu | [docs/navigation/NAVIGATION.md](docs/navigation/NAVIGATION.md) |
| See every document | [docs/README.md](docs/README.md) |

## Project layout

```
MFQATS/
├── src/
│   ├── app/            Pages, one folder per role: (admin), (staff), (customer)
│   ├── components/     Shared parts: top bar, sidebar, charts, buttons, cards
│   ├── lib/            Shared logic: order stages, defect rate, peso formatting, Supabase client
│   ├── styles/         Theme and the shared glass styles (tailwind.css)
│   └── api/            Python detection server: YOLO, marker measurement, 3D reconstruction, surface check
├── supabase/
│   ├── migrations/     Database setup, applied by hand in the Supabase SQL Editor (in order)
│   └── checks/         Read-only queries for checking the live database
├── public/assets/      Logo and the printable measuring marker
├── docs/               All project documents
└── train_yolov12n_wood.ipynb   Google Colab notebook for training the defect models
```

## Commands

| Command | What it does |
|---|---|
| `npm run dev` | Start the website at http://localhost:4028 (`npm start` does the same) |
| `npm run build` | Build the website for production |
| `npm run serve` | Run the production build |
| `npm run lint` | Check the code for mistakes |
| `npm run format` | Format the code with Prettier |

## Built with

Next.js 15, React 19, TypeScript, Tailwind CSS and Supabase (database and logins) for the website. Python with FastAPI,
Ultralytics YOLOv12 and OpenCV for the detection server.

## Team

Diaz, Dugenio, Mangaring, Rubia and Sy. Adviser: Jay Vee L. Capiral.
