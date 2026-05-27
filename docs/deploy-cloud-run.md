# BLEP Cloud Run Deploy

Required build checks:

```sh
npm run check
npm run build
```

Required env vars:

```sh
GEMINI_API_KEY=
FIRECRAWL_API_KEY=
FIREBASE_PROJECT_ID=
GOOGLE_APPLICATION_CREDENTIALS=
BLEP_DAILY_LIMIT=2
BLEP_USE_MOCK=false
BLEP_DEMO_MODE=false
GEMINI_MODEL_MAIN=gemini-3.1-flash-lite
GEMINI_MODEL_BACKUP=gemini-2.5-flash-lite
GEMINI_MODEL_DEMO=gemini-3.5-flash
```

Firebase auth/quota uses Firebase Admin on server only.
Cloud Run should use Application Default Credentials via service account IAM.
Local dev may use `GOOGLE_APPLICATION_CREDENTIALS`.

Store Gemini and Firecrawl keys in Secret Manager or Cloud Run env/secrets.
Never commit `.env`.

Deploy placeholder:

```sh
gcloud run deploy blep --source . --region asia-southeast2 --allow-unauthenticated
```
