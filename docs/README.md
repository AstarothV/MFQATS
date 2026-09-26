# MFQATS Documentation

All project documents live in this folder, grouped by topic. **New to the project? Start with the Setup section.**

```
docs/
├── setup/        How to install and run the system
├── navigation/   How the app's role-based navigation works
└── project/      Project status, decisions, and implementation plans
```

---

## 🛠️ `setup/`: install and run

| File | What it's for |
|---|---|
| [YOLO_SERVER_SETUP.md](setup/YOLO_SERVER_SETUP.md) | **Start here.** One-time setup (Node, Python, `.env`, model files), running the website + YOLOv12n AI server (multiple models), adding models, troubleshooting, and retraining on Google Colab |
| [DEVICE_TESTING.md](setup/DEVICE_TESTING.md) | **Every test session.** Start-up order, health check, and step-by-step tests on laptop, Android, iPhone and tablet (https tunnel for phone cameras), fixes, and a test log |

## 🧭 `navigation/`: role-based navigation (Admin / Staff / Customer)

| File | What it's for |
|---|---|
| [START_HERE.md](navigation/START_HERE.md) | Overview of the navigation system: read this first |
| [MASTER_INDEX.md](navigation/MASTER_INDEX.md) | Index of all the navigation documents |
| [NAVIGATION_QUICKREF.md](navigation/NAVIGATION_QUICKREF.md) | One-page cheat sheet of the navigation functions |
| [NAVIGATION_GUIDE.md](navigation/NAVIGATION_GUIDE.md) | Full documentation of the navigation functions |
| [ROLE_BASED_NAVIGATION.md](navigation/ROLE_BASED_NAVIGATION.md) | How routes differ per role |
| [ROLE_NAVIGATION_REFERENCE.md](navigation/ROLE_NAVIGATION_REFERENCE.md) | Complete route reference per role |
| [VISUAL_GUIDE.md](navigation/VISUAL_GUIDE.md) | Diagrams of the navigation flow |
| [NAVIGATION_INDEX.md](navigation/NAVIGATION_INDEX.md) | Detailed index of the navigation code |
| [README_NAVIGATION.md](navigation/README_NAVIGATION.md) | Completion summary |
| [IMPLEMENTATION_SUMMARY.md](navigation/IMPLEMENTATION_SUMMARY.md) | What was implemented |
| [DELIVERY_SUMMARY.md](navigation/DELIVERY_SUMMARY.md) | Delivery report |

## 📋 `project/`: status and plans

| File | What it's for |
|---|---|
| [mfqats-current-state.md](project/mfqats-current-state.md) | What exists vs what the capstone paper requires, known issues (security, missing modules), and the team's decisions |
| [plans/2026-09-25-mfqats-roadmap.md](project/plans/2026-09-25-mfqats-roadmap.md) | Roadmap: the order the remaining modules will be built in |
| [plans/2026-09-25-plan-01-security-truthfulness-foundation.md](project/plans/2026-09-25-plan-01-security-truthfulness-foundation.md) | Plan 01: security fixes and removing fake data |

---

### Where to put new documents

- How to install/run something → `setup/`
- How a feature works → a new folder named after it (e.g. `yolo/`, `3d-reconstruction/`)
- Status reports, decisions, plans → `project/` (plans in `project/plans/`, named `YYYY-MM-DD-topic.md`)
