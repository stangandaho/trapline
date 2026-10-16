# Trapline

Offline mobile app for managing camera trap deployments. Its `deployments.csv`
export follows the **Camtrap DP 1.0** deployments table.

## The app

| Screen | What it does |
|---|---|
| **Projects** | Create projects, restore a backup |
| **Cameras** | Register cameras (ID, make, model, serial), or add a series at once (CT01…CT20). Filter by status: available / deployed / maintenance / lost |
| **Deploy** | Averages GPS fixes (accuracy shown, warning above your target), proposes a new station ID (S001…) or reuses a nearby free station, lists **only available cameras**, then the form: height, tilt, heading (with compass), detection range, field of view, delay, bait, camera clock check, habitat, feature type, the project's environmental variables, groups, comments. ID = `<CAMERA>_YYMMDD_HHMMSS` |
| **Stations** | Active stations sorted by days since the last visit (green / due / overdue), trap-days, closed deployments |
| **Check** | Status (active, inactive, damaged, stolen) + action (leave, remove), battery, SD card, image count, notes |
| **Map** | Offline base map, stations, your position, **Go to** a station (distance, bearing, compass arrow), **measure** distances, download an area for offline use |
| **Settings** | Export or Share one zip with `deployments.csv` (Camtrap DP), `checks.csv`, `cameras.csv` and `trapline_backup.json`; Export (download) or Share. Restore accepts the zip. Project settings, including environmental variables (Integer, Float or Text with optional choices) |

### Rules

- A deployed camera disappears from the Deploy list until a check removes it.
- **Remove** → the deployment ends at the check time; the camera is *available* again
  (or *maintenance* if it was damaged; put it back in service from Cameras).
- **Stolen** → no "remove" action. The deployment ends at the **last check that
  confirmed the camera working** (or at deployment start); the camera becomes *lost*.
- Deleting the check that closed a deployment reopens the deployment, unless
  the camera has been deployed somewhere else since then.
- Every multi-record change (check + deployment + camera) is a single atomic
  IndexedDB transaction.

### Run locally

```bash
python -m http.server 5173 --directory app
```

Open http://localhost:5173. GPS, compass and installation need **HTTPS** (or localhost).

### Put it on phones

Every push to `main` runs the tests and publishes `app/` to GitHub Pages
(`.github/workflows/pages.yml`). One-time setup on GitHub: **Settings → Pages → Source:
GitHub Actions**. The app is then at `https://<user>.github.io/<repository>/`. Any other
static HTTPS host works too (Netlify, Cloudflare Pages). Open the URL once on the phone while online, then use **Add to Home screen**
(Chrome on Android) or **Share → Add to Home Screen** (Safari on iOS). From then on it
opens and works with no network. Data stays on the phone; **export a backup after each
field day**.

When you change files in `app/`, bump `VERSION` in `app/sw.js` (and add any new file
to `SHELL`). Phones pick up the new version the next time they open the app while online.

### Offline base map

- Tiles you look at while online are stored automatically.
- On the Map tab, ⬇ downloads the visible area for a zoom range (up to 20,000 tiles).
- OpenStreetMap's tile policy forbids bulk downloads, so for whole-area downloads choose
  *OpenTopoMap*, *Esri World Imagery* or your own tile server in Export → Settings, and
  check that provider's terms.

## Tests

```bash
node --test "app/tests/*.test.mjs"
```

## Possible next steps

Photos of each setup, QR code scanning of camera labels, planned station grid
import, French interface, PMTiles/MBTiles import for offline maps, merging
backups from several phones.
