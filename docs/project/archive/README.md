# Archive: September 2026 planning documents

These are kept for the record. **They no longer describe the system**, so don't follow them.

| File | What it was |
|---|---|
| [2026-09-25-current-state.md](2026-09-25-current-state.md) | A review of the code on 25 September 2026: what existed, what was missing, security findings |
| [2026-09-25-roadmap.md](2026-09-25-roadmap.md) | A plan to rebuild the system with Flutter and Laravel |
| [2026-09-25-plan-01-security.md](2026-09-25-plan-01-security.md) | The first step of that plan: security fixes and test setup |

**What changed since:** the team kept the Next.js website and Supabase instead of moving to Flutter and Laravel. Most
of what the review lists as missing now exists: the Python detection server (YOLOv12), 3D reconstruction (SfM), the
RANSAC surface check, marker measurement (PnP), the five-stage order rules (FSM) and PERT/WMA delivery estimates.

For how the system works now, read [../SYSTEM_FLOW.md](../SYSTEM_FLOW.md). These files mention their old locations
(`docs/project/plans/…`); the links inside them are not updated.
