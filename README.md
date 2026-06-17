# FlightApp Angular

FlightApp Angular is a local-first web application for analyzing IGC flight files.

The application runs in the browser, stores imported flights locally using IndexedDB, and provides charts, map visualization, 3D visualization, replay, flight statistics, and detected climb phases.

## Features

* Import `.igc` flight files
* Store flights locally in the browser using IndexedDB
* Duplicate detection using a file hash
* Flight list with import and delete actions
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

* Angular
* TypeScript
* Angular Signals
* NgRx SignalStore
* RxJS
* IndexedDB with `idb`
* ECharts
* Leaflet
* CesiumJS
* Vitest

## Requirements

Make sure the following tools are installed:

```bash
node --version
npm --version
```

Recommended versions:

```bash
Node.js 20 or newer
npm 10 or newer
```

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

```bash
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

Start the local development server:

```bash
ng serve
```

Then open:

```text
http://localhost:4200/
```

The application reloads automatically when source files change.

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
* calculate a file hash
* detect duplicates
* parse the IGC track
* calculate flight statistics
* detect climb phases
* store the flight locally in IndexedDB

Imported flights are shown in the flight list.

### 3. Open a flight

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

### 4. Use the charts

The detail page contains charts for:

* altitude
* vario
* speed

Moving over a chart updates the shared cursor position.
The map and charts are synchronized through the current track index.

### 5. Use the 2D map

The map view shows the flight track on a Leaflet map.

Depending on the current settings, the track can be colored by flight metrics such as vario.

### 6. Use the 3D view

Switch from `Map` to `3D` in the right panel.

The 3D view uses CesiumJS and shows the flight track over terrain.

### 7. Use replay mode

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

### 8. Use climb navigation

Detected climbs can be selected and inspected.

The app can show the selected climb in charts and on the map.
The `Full flight` action resets the view back to the complete flight.

### 9. Use settings

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

## Data Storage

FlightApp Angular stores data locally in the browser using IndexedDB.

Stored data includes:

* flight metadata
* track arrays
* calculated flight statistics
* local settings

The app is local-first. Imported flights are not uploaded to a server by default.

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

Contains domain models such as flights, tracks, stats, climbs, settings, and derived stats.

```text
src/app/features/flights/services
```

Contains parsing, import, statistics, climb detection, track metrics, color calculation, and settings services.

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

Contains reusable UI components such as charts, map, 3D view, summary tags, and climb panel.

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
ng serve
```

On Windows PowerShell:

```powershell
Remove-Item -Recurse -Force node_modules
Remove-Item -Force package-lock.json
npm install
ng serve
```

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

### Duplicate file warning

The app detects duplicate imports using the file hash.
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

## Notes

FlightApp Angular is currently focused on local flight analysis.
The application is designed so that cloud sync or backend storage can be added later without changing the core analysis workflow.
