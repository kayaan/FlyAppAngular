# FlightApp Angular

FlightApp Angular is a local-first web application for analyzing IGC flight files.

The application runs in the browser, stores imported flights locally using IndexedDB, and provides charts, map visualization, 3D visualization, replay, flight statistics, and detected climb phases.

The app also supports backend synchronization for multi-device usage. Flights can be uploaded to the backend, downloaded on another device, deleted locally or remotely, and synchronized live across open browser tabs or devices using Server-Sent Events.

## Features

* Import `.igc` flight files
* Store flights locally in the browser using IndexedDB
* Duplicate detection using SHA-256 hash of the original IGC file
* Stable global flight IDs based on the original IGC file hash
* Flight list with import, upload, download, local delete, and remote delete actions
* Backend sync for multi-device usage
* Remote-only flights can be downloaded into local IndexedDB
* Local-only flights can be uploaded to the backend
* Soft delete support for backend flights
* Live sync updates across browser tabs/devices using Server-Sent Events
* Visibility controls for backend flights:

  * Private
  * Unlisted
  * Public
* Flight detail view
* Altitude, vario, and speed charts
* 2D map view using Leaflet
* 3D view using CesiumJS
* 3D replay mode
* Flight statistics overview
* Climb detection
* Map / 3D view toggle
* Local settings for chart visibility and chart smoothing resolution

## Tech Stack

* Angular 21
* TypeScript
* Angular Signals
* NgRx SignalStore
* RxJS
* IndexedDB with `idb`
* ECharts
* Leaflet
* CesiumJS
* Server-Sent Events
* REST API integration
* Vitest

## Requirements

Make sure the following tools are installed:

```bash
node --version
npm --version
```

Recommended versions:

```text
Node.js 20 or newer
npm 10 or newer
```

A running FlightApp backend is required for authentication, backend sync, remote delete, visibility changes, and live SSE updates.

## Installation

Clone the repository:

```bash
git clone <repository-url>
cd flight-app-angular
```

Install dependencies:

```bash
npm install
```

## Cesium Access Token

The 3D view uses CesiumJS.
You need a Cesium access token for terrain and imagery.

Create or update your local environment file:

```text
src/environments/environment.development.ts
```

Example:

```ts
export const environment = {
  production: false,
  cesiumAccessToken: 'YOUR_LOCAL_CESIUM_TOKEN'
};
```

For production deployment, configure the production environment accordingly.

Do not commit private access tokens to the repository.

## Development Server

Start the local development server with backend proxy support:

```bash
ng serve --proxy-config proxy.conf.json
```

Then open:

```text
http://localhost:4200/
```

The application reloads automatically when source files change.

The frontend uses relative API paths such as:

```text
/api
```

During local development, the Angular dev server proxy forwards these requests to the backend.

## Build

Create a production build:

```bash
ng build
```

The build output is written to:

```text
dist/
```

## Tests

Run unit tests:

```bash
ng test
```

The project uses Vitest as the test runner.

## Basic Usage

### 1. Open the application

Start the app locally and open it in the browser:

```text
http://localhost:4200/
```

The app opens the flight list view.

### 2. Import IGC files

Click the import button and select one or more `.igc` files.

The app will:

* read the file
* calculate the SHA-256 file hash
* use the hash as stable global flight ID
* detect duplicates
* parse the IGC track
* calculate flight statistics
* detect climb phases
* store the flight locally in IndexedDB

Imported flights are shown in the flight list.

### 3. Upload a local flight

A local-only flight can be uploaded to the backend.

The upload includes:

* flight metadata
* calculated flight statistics
* track data
* original IGC file

After upload, the flight becomes synced.

### 4. Download a remote-only flight

Flights uploaded from another device appear as remote-only flights.

A remote-only flight can be downloaded into local IndexedDB.

The download stores:

* flight metadata
* calculated flight statistics
* track arrays
* original IGC content

After download, the flight becomes synced and can be opened locally.

### 5. Delete flights locally or remotely

Flights can be deleted independently on the local device or on the backend.

Possible states:

* local-only flight + local delete: removed locally
* remote-only flight + remote delete: removed remotely
* synced flight + local delete: becomes remote-only
* synced flight + remote delete: becomes local-only

Remote delete uses backend soft delete.

### 6. Change visibility

Backend flights support visibility settings:

* `PRIVATE`
* `UNLISTED`
* `PUBLIC`

Visibility changes are synchronized through the backend and propagated to other open sessions using Server-Sent Events.

### 7. Open a flight

Click a flight in the list to open the flight detail page.

The detail page shows:

* flight metadata
* flight statistics
* altitude chart
* vario chart
* speed chart
* 2D map or 3D view
* detected climbs
* replay controls in 3D mode

### 8. Use the charts

The detail page contains charts for:

* altitude
* vario
* speed

Moving over a chart updates the shared cursor position.
The map and charts are synchronized through the current track index.

### 9. Use the 2D map

The map view shows the flight track on a Leaflet map.

Depending on the current settings, the track can be colored by flight metrics such as vario.

### 10. Use the 3D view

Switch from `Map` to `3D` in the right panel.

The 3D view uses CesiumJS and shows the flight track over terrain.

### 11. Use replay mode

Replay controls are available in 3D mode.

You can:

* play forward
* play backward
* pause
* stop
* change replay speed
* move through the flight using the slider
* optionally follow the aircraft with the camera

During replay, the app shows current values such as:

* time
* altitude
* vario
* speed
* track index

### 12. Use climb navigation

Detected climbs can be selected and inspected.

The app can show the selected climb in charts and on the map.
The `Full flight` action resets the view back to the complete flight.

### 13. Use settings

Open the settings drawer using the settings icon in the flight detail header.

Available settings include:

* show or hide altitude chart
* show or hide vario chart
* show or hide speed chart
* change altitude chart smoothing resolution
* change vario chart smoothing resolution
* change speed chart smoothing resolution
* show or hide statistics panel
* show or hide climbs on charts

Settings are stored locally in the browser.

## Sync Overview

FlightApp Angular uses a local-first sync model.

Imported flights are stored locally in IndexedDB. The original IGC file hash is used as the global flight ID, so the same flight can be matched across devices without an additional ID mapping table.

### Local to Backend

A locally imported flight can be uploaded to the backend.

The upload request sends:

* flight metadata
* calculated statistics
* track data
* original IGC file

### Backend to Local

A remote-only flight can be downloaded into the local browser database.

The download package contains:

* flight metadata
* calculated statistics
* track data
* original IGC content

The frontend rebuilds local IndexedDB entries for:

* `flights`
* `stats`
* `tracks`
* `igcFiles`

### Live Sync

The frontend opens a Server-Sent Events connection to the backend.

When a flight changes in another tab or on another device, the backend emits a sync event.
The frontend reloads local and backend flight data so the flight list stays up to date.

Supported live sync events include:

* upload
* remote delete
* visibility change

## Data Storage

FlightApp Angular stores data locally in the browser using IndexedDB.

Stored data includes:

* flight metadata
* track arrays
* calculated flight statistics
* original IGC file content
* local settings

The app is local-first. Imported flights are stored locally first and are only uploaded to the backend when the user triggers sync.

To reset all locally stored data, clear the browser site data for the application.

## Project Structure

Typical structure:

```text
src/
  app/
    core/
      layout/
    features/
      flights/
        components/
        data-access/
        models/
        pages/
        services/
        store/
  environments/
```

Important areas:

```text
src/app/features/flights/models
```

Contains domain models such as flights, tracks, stats, climbs, settings, sync models, and derived stats.

```text
src/app/features/flights/services
```

Contains parsing, import, statistics, climb detection, track metrics, color calculation, settings, backend sync, and SSE services.

```text
src/app/features/flights/data-access
```

Contains the IndexedDB storage implementation.

```text
src/app/features/flights/store
```

Contains SignalStore-based application state.

```text
src/app/features/flights/pages
```

Contains route-level pages such as the flight list and flight detail page.

```text
src/app/features/flights/components
```

Contains reusable UI components such as charts, map, 3D view, summary tags, replay controls, and climb panel.

## Available Scripts

Depending on the project setup, the following commands are commonly used:

```bash
npm install
npm start
npm run build
npm test
```

Equivalent Angular CLI commands:

```bash
ng serve
ng serve --proxy-config proxy.conf.json
ng build
ng test
```

## Troubleshooting

### The app does not start

Reinstall dependencies:

```bash
rm -rf node_modules package-lock.json
npm install
```

Then start again:

```bash
ng serve --proxy-config proxy.conf.json
```

On Windows PowerShell:

```powershell
Remove-Item -Recurse -Force node_modules
Remove-Item -Force package-lock.json
npm install
ng serve --proxy-config proxy.conf.json
```

### Backend sync does not work

Check that the backend is running and that the Angular proxy is configured.

Start the frontend with:

```bash
ng serve --proxy-config proxy.conf.json
```

Also check the browser network tab for failing requests under:

```text
/api
```

### Live sync does not update another tab

Check the browser network tab and confirm that the SSE connection is open:

```text
/api/flights/sync/events
```

If the connection is missing or failing, check:

* backend is running
* user is logged in
* cookies are sent correctly
* Angular proxy is active
* browser console for EventSource errors

### The 3D view does not load

Check that a valid Cesium access token is configured.

Also check:

* the token is not expired
* the token allows the current domain
* `localhost` is allowed for local development
* the deployed domain is allowed for production

### The map is empty

Check the browser console and network tab.

Possible causes:

* tile provider blocked the request
* internet connection unavailable
* browser blocked third-party requests
* map container has no height

### Imported flights disappeared

The app stores data in browser IndexedDB.

Flights may disappear if:

* browser site data was cleared
* another browser profile is used
* private/incognito mode is used
* the application origin changed

If backend sync is enabled and the flight was uploaded, it can be downloaded again as a remote-only flight.

### Duplicate file warning

The app detects duplicate imports using the SHA-256 hash of the original IGC file.
If the same IGC file was already imported, it will not be imported again.

## Deployment

Build the application:

```bash
ng build
```

Deploy the generated output from the `dist/` folder to your static hosting provider.

For Azure Static Web Apps, make sure:

* the correct build command is configured
* the correct output folder is configured
* the production Cesium token is configured
* the production domain is allowed in Cesium
* the production backend/API routing is configured correctly
* authentication and cookies work correctly in the deployed environment

## Notes

FlightApp Angular is currently focused on local-first flight analysis with optional backend synchronization.

The application is designed so that imported flights remain usable locally, while backend sync enables multi-device usage, remote backup, visibility settings, and live updates across sessions.
