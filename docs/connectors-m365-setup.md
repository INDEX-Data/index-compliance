# Microsoft 365 Connector — one-time Azure setup (admin-consent OAuth)

The M365 connector uses **one multi-tenant Entra app** that ATLAS owns. A customer's
Global Admin consents to it once; ATLAS then mints app-only tokens for that tenant using
**our** server-side secret. The customer never enters or sees a secret.

This is the one-time setup required to activate the OAuth flow. Until it's done, the
"Connect with Microsoft" button will land on a Microsoft error page (app not found /
unverified) rather than a consent screen. The rest of the app keeps working on the legacy
per-customer secret via the resolver fallback — nothing breaks while this is pending.

## 1. Register the multi-tenant app (ATLAS's own tenant)

Entra admin center → **App registrations → New registration**:

- **Name:** `INDEX ATLAS` (shown on the customer consent screen).
- **Supported account types:** *Accounts in any organizational directory (multitenant)*.
- **Redirect URI** (type **Web**): `https://<your-atlas-domain>/api/connectors/m365/callback`
  - Add one per environment you run (production + preview). Must match exactly.

## 2. Graph **application** permissions — split read vs. write

Under **API permissions → Add a permission → Microsoft Graph → Application permissions**.

- **Read set** (consented first, `tier=read`) — least privilege for assessment, e.g.:
  `Organization.Read.All`, `Policy.Read.All`, `Directory.Read.All`,
  `DeviceManagementConfiguration.Read.All`, `SecurityEvents.Read.All`,
  `AuditLog.Read.All`, `Reports.Read.All`, `RoleManagement.Read.Directory`.
- **Write set** (consented separately, `tier=write`, only when remediation is enabled), e.g.:
  `Policy.ReadWrite.ConditionalAccess`, `Policy.ReadWrite.AuthenticationMethod`,
  `Policy.ReadWrite.AuthorizationPolicy`.

> The two tiers map to the two "Connect" / "Enable remediation" buttons in Integrations.
> Keep write permissions out of the default (read) consent so customers can adopt
> read-only first — this enforces the human-approve-every-change stance: no write grant →
> the copilot is given no write tools.

## 3. Client secret (ours, server-side only)

**Certificates & secrets → New client secret.** Copy the **Value**. This is ATLAS's secret,
not the customer's — it lives only in our server env and is never sent to the browser or
stored per customer.

Set in the deployment (Vercel → Settings → Environment Variables):

```
AZURE_CLIENT_ID=<the multi-tenant app's Application (client) ID>
AZURE_CLIENT_SECRET=<the secret Value>
```

(`ENCRYPTION_KEY`, Supabase keys, etc. are already configured.)

## 4. Publisher verification (avoid the "unverified" warning)

Complete **Publisher verification** on the app so the consent screen shows a verified
publisher instead of an "unverified app" warning. Requires a verified Microsoft Partner
Network (MPN) account associated with the tenant.

## 5. Apply the database migration

`supabase/migrations/006_connector_grants.sql` adds `connector_grants` + `oauth_states`.
Apply it to the project (Supabase migration / SQL editor). It is additive — no existing
columns are touched.

## How it runs after setup

1. Admin clicks **Connect with Microsoft** → `/api/connectors/m365/authorize` → Microsoft
   admin-consent screen for the read set.
2. On consent, Microsoft redirects to `/api/connectors/m365/callback?tenant=…&admin_consent=True`.
   We validate the CSRF `state`, confirm a token mints against the tenant, and write a
   `connector_grants` row storing **only the tenant id**.
3. `resolveM365Session()` now prefers that grant; assessments and copilot run app-only with
   no per-customer secret. **Enable remediation** repeats consent for the write set
   (`tier=write`).

### Notes / gotchas
- **Global Admin required** to grant application permissions. If the user isn't an admin,
  send them the same authorize URL to forward to their admin.
- **Legacy tenants** keep working on the stored secret until they click Reconnect; the
  `client_secret` column is intentionally left in place during this slice.
