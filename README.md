# CMP Flow Tracker

Tracks every CMP user persona → workflow → screen → notification, with **screen versions per client release** so change requests stay traceable.

```
npm install
npm run dev        # http://localhost:5180
```

## Model
- **Release** — a client version (v1.0, v1.1 …). The release pills in the top bar switch the whole app to "as of that release".
- **Persona → Workflow → Screen → Notification** — the hierarchy from the CMP flow diagram.
- **Screen version** — each change to a screen is a new version (`v1 → v2 → v3`) with release, change type (added / modified / removed), summary, details, CR id, author and screenshot.
- Workflows and notifications carry `addedIn` / `removedIn` releases; notifications also keep a change history and an optional type (success / warning / error / info — guessed from the wording when not set).

## Persona board (opening page, where you edit)
One persona per screen: avatars on top, a column per workflow with its screens stacked in flow order (thumbnail, version, notifications), and a left rail with the **CR inbox** and a release timeline (one dot per change; hover a dot to spot the card).

- **+ Workflow** / **+ New screen** add items; click a card to open its panel (new version, notifications, edit, history).
- New client request → **+ New** in the inbox. Then drag the CR onto a screen (new version), a notification (notification change) or a column's **+ New screen** slot. You can also click the CR, then click the target. The form opens pre-filled with the CR id and text, and saving marks the CR as placed.

## User flow (read-only map)
The whole product as one map of **Persona → Workflow → Screen → Notification**, built from the same data as the board ([src/userflow/adapter.ts](src/userflow/adapter.ts)) for the release selected in the top bar. Every node shows what happened to it in that release: new, modified, existing or deprecated.

- Opens with personas and their workflows. Click a workflow to show its screens, click a screen to show its notifications; click it again to hide them.
- Selecting a node highlights its path and dims the rest; the right panel shows changes, screenshot, version history, counts, and **Edit on Persona board**.
- Search (`/` to focus), filters (persona, level, status, notification type), Expand all / Collapse all, zoom and fit.

## Changelog
Every change in the selected release, grouped by persona, with a before/after swipe compare for screens. **Copy as Markdown** produces release notes for the client. The crosshair on a card jumps to it in User flow.

## Data
Stored in this browser only (IndexedDB, screenshots as blobs).
