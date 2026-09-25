# People's Choice Award — Live Voting

Mobile voting + live results screen for the AI Solution Challenge 2026 finals.

- `/vote` — attendees pick up to 3 of the 5 finalist teams (mobile).
- `/display` — live bar-chart-race results for the projector, real-time via Supabase.
- `/mc?key=...` — start/stop the 5-minute voting window.

## Setup

1. **Supabase**: create a project, then run [`supabase/schema.sql`](supabase/schema.sql) in the SQL editor.
   Seed the 5 finalist teams (uncomment/edit the `insert into teams` block at the bottom).
   Seed the `allowed_emails` table with the list of emails allowed to vote (not committed to git, since
   it's real PII — run something like `insert into allowed_emails (email) values ('a@x.com'), ('b@x.com') on conflict do nothing;`
   directly in the SQL editor, e.g. from a CSV export of the registration sheet).
2. **Env vars** (see [`.env.example`](.env.example)):
   - `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` — from Supabase project settings.
   - `SUPABASE_SERVICE_ROLE_KEY` — Supabase service role key, used only by `/api/*` (server-side, never shipped to the browser).
   - `MC_CONTROL_KEY` — any random string; open `/mc?key=<that string>` to control voting.
3. **Local dev**:
   ```bash
   npm install
   npm run dev
   ```
   Serverless functions under `/api` only run on Vercel (`vercel dev`), not with plain `vite dev`.
4. **Deploy**: push to GitHub, import into Vercel, set the env vars above in the Vercel project settings, deploy.

## On event day

1. Open `/mc?key=...` on the MC's laptop/phone.
2. Project `/display` on the big screen.
3. Share the `/vote` link (as a QR code) with the audience.
4. Hit "Bắt đầu (5:00)" — voting opens for 5 minutes and auto-closes; the display freezes and highlights the winner.
