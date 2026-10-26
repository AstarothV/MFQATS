# MFQATS documents

**New to the project?** Read them in this order:

1. [setup/YOLO_SERVER_SETUP.md](setup/YOLO_SERVER_SETUP.md): install and run the system on your computer
2. [project/SYSTEM_FLOW.md](project/SYSTEM_FLOW.md): how an order goes from purchase to delivery
3. [setup/DEVICE_TESTING.md](setup/DEVICE_TESTING.md): how to test it on a laptop, phone or tablet

## All documents

| Folder | File | What it's for |
|---|---|---|
| `setup/` | [YOLO_SERVER_SETUP.md](setup/YOLO_SERVER_SETUP.md) | One-time setup and starting the system: tools, private files, the website and the detection server, adding a trained model, fixing common problems, retraining on Google Colab |
| `setup/` | [DEVICE_TESTING.md](setup/DEVICE_TESTING.md) | Every test session: start-up order, checks, step-by-step tests per device, the optional local 3D server, and a test log |
| `project/` | [SYSTEM_FLOW.md](project/SYSTEM_FLOW.md) | How the system works: each order stage, who does it, what each Quality Scan panel does, what happens automatically |
| `navigation/` | [NAVIGATION.md](navigation/NAVIGATION.md) | Each role's menu and pages, who can open what, and how to add a page |
| `project/archive/` | [README.md](project/archive/README.md) | Old September 2026 plans, kept for the record only |

Outside this folder: [../README.md](../README.md) (project front page) and [../PRODUCT.md](../PRODUCT.md) (who the product
is for and its design principles, used when designing screens).

## Adding a document

| It explains… | Put it in |
|---|---|
| How to install or run something | `setup/` |
| How a feature works | `project/`, or a new folder named after the feature |
| A plan or decision | `project/`, named `YYYY-MM-DD-topic.md` |

Write for a classmate who hasn't seen the code: short sentences, numbered steps for anything they have to do, and a
table when comparing things. Add the new file to the table above.
