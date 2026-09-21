"""Quick API test script"""
import urllib.request
import urllib.error
import json
import sys

# 1. Test Tavily
print("=" * 50)
print("1. TESTING TAVILY API")
print("=" * 50)
try:
    payload = {
        "api_key": "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",
        "query": "AI travel planner competitors startups",
        "max_results": 3,
        "include_answer": False,
        "search_depth": "basic",
    }
    req = urllib.request.Request(
        "https://api.tavily.com/search",
        data=json.dumps(payload).encode("utf-8"),
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    with urllib.request.urlopen(req, timeout=15) as resp:
        data = json.loads(resp.read())
        results = data.get("results", [])
        print(f"  STATUS: OK")
        print(f"  Results count: {len(results)}")
        for r in results[:3]:
            print(f"  - {r.get('title', '')[:70]}")
except urllib.error.HTTPError as e:
    body = e.read().decode("utf-8", errors="replace")
    print(f"  STATUS: FAILED - HTTP {e.code}")
    print(f"  Body: {body[:300]}")
except Exception as e:
    print(f"  STATUS: FAILED - {e}")

# 2. Test Mistral  
print()
print("=" * 50)
print("2. TESTING MISTRAL API")
print("=" * 50)
try:
    payload = {
        "model": "mistral-small-latest",
        "messages": [{"role": "user", "content": "Say hello"}],
        "max_tokens": 20
    }
    req = urllib.request.Request(
        "https://api.mistral.ai/v1/chat/completions",
        data=json.dumps(payload).encode("utf-8"),
        headers={
            "Content-Type": "application/json",
            "Authorization": "Bearer zHogyL8PcRtQvkE1Uuwnf8arzueUta1j"
        },
        method="POST",
    )
    with urllib.request.urlopen(req, timeout=15) as resp:
        data = json.loads(resp.read())
        content = data["choices"][0]["message"]["content"]
        print(f"  STATUS: OK")
        print(f"  Response: {content}")
except urllib.error.HTTPError as e:
    body = e.read().decode("utf-8", errors="replace")
    print(f"  STATUS: FAILED - HTTP {e.code}")
    print(f"  Body: {body[:500]}")
except Exception as e:
    print(f"  STATUS: FAILED - {e}")

# 3. Check DuckDuckGo (currently disabled)
print()
print("=" * 50)
print("3. DUCKDUCKGO SEARCH STATUS")
print("=" * 50)
print("  STATUS: DISABLED (search_duckduckgo returns empty [])")
print("  The function body is: return []")
