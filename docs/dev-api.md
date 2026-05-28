# BLEP Dev API Test Guide

Run dev server:

```sh
npm run dev
```

Manual scan:

```sh
curl -X POST http://localhost:5173/api/scan \
  -H "Content-Type: application/json" \
  -d "{\"query\":\"ThinkPad T480 used laptop\",\"urls\":[\"https://example.com/listing\"]}"
```

PowerShell scan:

```powershell
Invoke-RestMethod -Method Post -Uri "http://localhost:5173/api/scan" -ContentType "application/json" -Body '{"query":"ThinkPad T480 used laptop"}'
```

Optional auth:

```sh
curl -X POST http://localhost:5173/api/scan \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $FIREBASE_ID_TOKEN" \
  -d "{\"query\":\"MacBook Air M1 8GB used\"}"
```
