# Instagram API Setup (Long-term)

This project can load real Instagram posts (image, caption, permalink) from Instagram Graph API.

## 1) Requirements
- Instagram Professional account (Creator or Business)
- A Facebook Page linked to that Instagram account
- A Meta developer app

## 2) Create and prepare the app
1. Go to Meta for Developers and create an app.
2. Add Instagram Graph API related product(s) in the app dashboard.
3. Connect your Facebook Page and Instagram account in app/test setup.

## 3) Configure app secrets
You need these env vars first:
- `META_APP_ID`
- `META_APP_SECRET`
- `INSTAGRAM_OAUTH_REDIRECT_URI` (default: `http://localhost:3000/`)

Meta Dashboard > Business Login settings must include `http://localhost:3000/` in valid OAuth redirect URIs.

## 4) Add local env
Create `.env.local` in project root:

```bash
INSTAGRAM_GRAPH_VERSION=v24.0
META_APP_ID=your_meta_app_id
META_APP_SECRET=your_meta_app_secret
INSTAGRAM_OAUTH_REDIRECT_URI=http://localhost:3000/
INSTAGRAM_IG_USER_ID=
INSTAGRAM_ACCESS_TOKEN=
```

## 5) One-click OAuth connect (recommended)
1. Run dev server.
2. Open `/topics`.
3. Click `連接 Instagram（自動設定）`.
4. Complete Meta permission flow.
5. The app writes `INSTAGRAM_IG_USER_ID` + `INSTAGRAM_ACCESS_TOKEN` into `.env.local` automatically.
6. Restart dev server.

## 6) Verify
1. Open `/topics`.
2. If connected, the page shows `資料來源: Instagram API`.
3. API test endpoint: `/api/instagram/posts`

## 7) Production (Vercel)
Add the same env vars in Vercel Project Settings > Environment Variables.

## 8) Long-term maintenance notes
- Access tokens expire. You must refresh/re-issue token before expiry.
- If token expires, the site automatically falls back to local dataset and shows a connection warning.
- For zero-downtime, renew token in advance and update env var.
