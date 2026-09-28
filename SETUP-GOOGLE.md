# Connecting Citadel to your Google account

This walks you through creating a free Google Cloud OAuth client so Citadel can read your real Gmail, Calendar, Drive, Docs, and Sheets data.

**Time:** ~7 minutes. **Cost:** $0 (Google Cloud OAuth is free for low volume).

Citadel runs entirely on your machine. The Client ID and Secret you create stay in a local `.env.local` file — they are never sent anywhere except directly between your computer and Google.

---

## Step 1 — Create a Google Cloud project

1. Open <https://console.cloud.google.com/>
2. Top bar → project picker → **New Project**
3. Name it anything (e.g. `citadel`) → **Create**

## Step 2 — Enable the APIs

In the search bar at the top, search for each of these and click **Enable** on each:

- **Gmail API**
- **Google Calendar API**
- **Google Drive API**
- **Google Docs API**
- **Google Sheets API**

(You can also visit <https://console.cloud.google.com/apis/library> directly.)

## Step 3 — Configure the OAuth consent screen

1. Left menu → **APIs & Services** → **OAuth consent screen**
2. **User Type**: External → **Create**
3. Fill in:
   - **App name**: `Citadel`
   - **User support email**: your email
   - **Developer contact**: your email
4. Save and continue.
5. **Scopes** screen → Save and continue (we add scopes at request time, so leaving this empty is fine).
6. **Test users** → add your own Gmail address. (In Testing mode you can add up to 100 test users, which is plenty for personal use. You never have to publish or verify the app.)
7. Save and continue → Back to dashboard.

## Step 4 — Create the OAuth Client ID

1. Left menu → **APIs & Services** → **Credentials**
2. **+ Create Credentials** → **OAuth client ID**
3. **Application type**: Web application
4. **Name**: `Citadel local`
5. **Authorized redirect URIs**: click **Add URI** and paste exactly:

   ```
   http://127.0.0.1:3000/api/auth/callback/google
   ```

6. Click **Create**.
7. Copy the **Client ID** and **Client Secret** that appear in the dialog.

## Step 5 — Add credentials to Citadel

In the project root (`D:\Coding\CODING_FILES\VIBE\Citadel\`), copy `.env.local.example` to `.env.local`:

```
copy .env.local.example .env.local
```

Open `.env.local` in your editor and fill in:

```
NEXTAUTH_URL=http://127.0.0.1:3000
NEXTAUTH_SECRET=any-long-random-string-32-chars-or-more
GOOGLE_CLIENT_ID=paste-your-client-id-here
GOOGLE_CLIENT_SECRET=paste-your-client-secret-here
```

For `NEXTAUTH_SECRET`: any random string of 32+ characters works (e.g. mash the keyboard, or run `openssl rand -base64 32` if you have git-bash).

## Step 6 — Restart the dev server

```
npm run dev
```

Open <http://127.0.0.1:3000/settings> and click **Connect Google**. Sign in with the same Gmail you added as a test user.

You'll see a warning screen saying "Google hasn't verified this app" — that's expected because the app is in Testing mode. Click **Advanced → Go to Citadel (unsafe)** to continue. It's only unsafe in the sense that Google can't vouch for you; the app is yours.

After consenting, the Inbox, Calendar, and Reminders pages will show real data.

---

## Troubleshooting

- **`redirect_uri_mismatch`** — the URI in Step 4 must be exactly `http://127.0.0.1:3000/api/auth/callback/google` (no trailing slash).
- **`access_denied`** — make sure your Gmail address is added as a test user in Step 3.
- **`invalid_client`** — Client ID or Secret is wrong; copy them again from the Credentials page.
- **Sign-in works but pages show empty data** — re-sign in after editing scopes so the new permissions are granted.

## Scopes Citadel requests

Read-only, minimal:

- `openid email profile` — your name and avatar
- `gmail.readonly` — read message metadata and content
- `calendar.readonly` — read events
- `drive.metadata.readonly` — list files (titles, types, dates — no content)
- `documents.readonly` — open and read Docs
- `spreadsheets.readonly` — open and read Sheets

You can revoke access at any time from <https://myaccount.google.com/permissions>.
