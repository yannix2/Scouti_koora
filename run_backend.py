#!/usr/bin/env python3
"""One command to start all backend services (gateway + 2 microservices)."""

import os
import sys
import signal
import subprocess
import time
import webbrowser
from pathlib import Path

sys.stdout.reconfigure(encoding="utf-8")  # cp1252 consoles/pipes can't print ✓ → 🟢

ROOT = Path(__file__).resolve().parent
PYTHON = sys.executable
LOG_DIR = ROOT / "services" / "logs"
LOG_DIR.mkdir(parents=True, exist_ok=True)
os.environ["PYTHONPATH"] = str(ROOT)

SERVICES = [
    {"name": "Player Service",  "port": 8001, "app": "services.player_service.main:app", "reload": False},
    {"name": "Similarity Service", "port": 8002, "app": "services.similarity_service.main:app", "reload": False},
    {"name": "API Gateway",     "port": 8000, "app": "src.api.main:app",                 "reload": True},
]

procs: list[subprocess.Popen] = []

def start_all():
    print("=" * 60)
    print("  ScoutiKoora — Starting Backend Services")
    print("=" * 60)
    for svc in SERVICES:
        log_out = LOG_DIR / f"{svc['name'].lower().replace(' ', '_')}.log"
        log_err = LOG_DIR / f"{svc['name'].lower().replace(' ', '_')}.err"
        with open(log_out, "w") as out, open(log_err, "w") as err:
            cmd = [PYTHON, "-m", "uvicorn", svc["app"], "--host", "0.0.0.0", "--port", str(svc["port"])]
            if svc["reload"]:
                cmd.append("--reload")
            p = subprocess.Popen(cmd, stdout=out, stderr=err, cwd=ROOT)
            procs.append(p)
        print(f"  ✓ {svc['name']:<20} → http://localhost:{svc['port']}/docs")
    print("=" * 60)

def wait_for_startup(timeout=15):
    """Poll /health on gateway until it responds or timeout."""
    import httpx  # type: ignore[import-untyped]
    start = time.time()
    while time.time() - start < timeout:
        try:
            r = httpx.get("http://localhost:8000/health", timeout=2)
            if r.status_code == 200:
                return True
        except Exception:
            pass
        time.sleep(1)
    return False

def stop_all(signum=None, frame=None):
    print("\n  Shutting down services...")
    for p in procs:
        p.terminate()
    for p in procs:
        try:
            p.wait(timeout=5)
        except subprocess.TimeoutExpired:
            p.kill()
    print("  All services stopped.")
    sys.exit(0)

if __name__ == "__main__":
    signal.signal(signal.SIGINT, stop_all)
    signal.signal(signal.SIGTERM, stop_all)

    start_all()

    print("\n  Waiting for gateway to be ready...", end=" ", flush=True)
    ready = wait_for_startup()
    print("ready!" if ready else "timed out (check logs).")

    if ready:
        webbrowser.open("http://localhost:8000/docs")
        print("\n  🟢 All services running")
        print(f"  📘 API docs:    http://localhost:8000/docs")
        print(f"  💚 Player svc:  http://localhost:8001/docs")
        print(f"  🔷 Similarity:  http://localhost:8002/docs")
        print(f"\n  Press Ctrl+C to stop all services.\n")

    # Block until Ctrl+C
    try:
        while True:
            time.sleep(1)
    except KeyboardInterrupt:
        stop_all()
