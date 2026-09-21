import urllib.request
import json

url = "http://localhost:5173/api/opportunities"
print("Fetching opportunities through Vite proxy...", flush=True)
req = urllib.request.Request(url)
with urllib.request.urlopen(req, timeout=35) as r:
    data = json.loads(r.read().decode("utf-8"))
    opps = data.get("opportunities", [])
    print(f"Total opportunities: {len(opps)}", flush=True)
    for idx, o in enumerate(opps):
        print(f"  [{idx}] ID: {o.get('id')} | Title: {o.get('title')} | Type: {o.get('type')} | Size: {o.get('size')} | Confidence: {o.get('confidence')}", flush=True)
