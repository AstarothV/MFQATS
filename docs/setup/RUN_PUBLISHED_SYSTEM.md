# Running the published system

The website is live at https://mfqats-mfqats.vercel.app. This page is for the day-to-day: what to start so that the
Quality Scan tools work. First-time setup is in [YOLO_SERVER_SETUP.md](YOLO_SERVER_SETUP.md).

## What runs where

| Part | Runs on | Do you start it? |
|---|---|---|
| Website | Vercel | No, it is always on |
| Database and logins | Supabase | No, it is always on |
| Detection server (YOLO, 3D model requests) | The laptop | **Yes, every time** |
| Tailscale Funnel (connects the website to the laptop) | The laptop | Stays on by itself; see below |
| Local 3D server | The laptop | Only when the free online 3D models run out |

Without the detection server, people can still use the website, but the Quality Scan tools (Detect Defects and the
3D model) will not work. `npm run dev` is not needed for the published site.

## Start it

1. Turn on the laptop, connect it to the internet and check that Tailscale is running.
2. Open a terminal in the project folder and run:

   ```
   .\.venv\Scripts\activate
   uvicorn src.api.yolo_server:app --port 8000 --env-file .env
   ```

3. Keep that terminal open. Closing it stops the server.

The laptop must not go to sleep while the tools are in use.

## Check that it works

1. On the laptop, open http://localhost:8000/health. If it answers, the detection server is running.
2. Open the funnel address with `/health` at the end. If it answers, the website can reach the laptop. The address is
   the `YOLO_SERVER_URL` value in Vercel (Settings → Environment Variables).
3. Log in to the website as staff and scan a photo in Quality Scan.

## If the free online 3D models run out

Start the local 3D server in a second terminal and keep it open too:

```
.venv-hunyuan\Scripts\python.exe -m uvicorn src.api.hunyuan_local:app --port 8001
```

## When something goes wrong

| What you see | What to do |
|---|---|
| "Could not reach the detection server" in Quality Scan | Do the three checks above to find which part is off |
| `localhost:8000/health` does not open | The detection server is not running. Do "Start it" again |
| The funnel address gives a 502 error | Same: the detection server is not running |
| The funnel address does not open at all | Check that Tailscale is running, then run the command below |
| `uvicorn` is not recognized | The `.venv` is not active. Run `.\.venv\Scripts\activate` first |

To turn the funnel back on:

```
& "C:\Program Files\Tailscale\tailscale.exe" funnel --bg 8000
```

## After a new update

Merging into `main` on GitHub updates the website by itself. The laptop does not update by itself, so when the
detection server changed:

1. Stop the server with Ctrl+C.
2. Run `git switch main`, then `git pull`.
3. Start it again.

## Keep private

- **The funnel address:** anyone who has it can use the detection server, including the free daily 3D models. This
  repository is public, so do not write it in any file here.
- **The `.env` file:** it holds secrets. Never commit it.
