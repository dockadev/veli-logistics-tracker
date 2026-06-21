# Veli Logistics Tracker (v0.1.0)

An advanced, high-performance desktop application for tracking Foxhole stockpiles, inventory, and logistics requests.

## App Features

* **Cross-Search with Autocomplete:** Search for items with auto-suggestions. View stock availability across all depots immediately, sorted from highest to lowest.
* **Dual Import Methods:** 
  * **Manual Import:** Paste copied CSV logs directly.
  * **Auto-Capturer:** Capture clipboard logs automatically in the background when copying depots in-game.
* **Logistics Request System:** Create supply requests, claim pending requests to indicate delivery, and update fulfillment progress.
* **Coalition Chat:** Real-time logistics coordination chat.
* **Officer Portal & Audit Logs:** Detailed tracking of logistics imports and actions for officer oversight.
* **Regiment Authentication Gate:** Access security verification for member profiles.
* **Theme Support:** Fully responsive dark/light mode toggle with readable stock levels.

---

## Installation & Download

To get started, navigate to the **[Releases](https://github.com/dockadev/veli-logistics-tracker/releases)** page of this repository and download the appropriate package for your system:

* **Windows:** Download the standalone `Veli_Logistics_Tracker.exe` (portable) or run the setup installer `.msi`.
* **Linux (Universal):** Download `Veli_Logistics_Tracker.AppImage`. Run `chmod +x Veli_Logistics_Tracker.AppImage` in the terminal to grant run permissions, then execute it directly.
* **Linux (Debian/Ubuntu):** Download and install the `.deb` package.

---

## Pre-Release Tester Guidelines

Please focus on testing the following features based on your assigned role:

### 1. For Members (Standard Players)
* **Logi Imports:** Pin a depot in-game, copy the CSV, and import it using the manual "CSV Import" or the background "Auto-Capturer" (using the window pin icon).
* **Cross-Search:** Search for items (e.g., "Soldier Supplies") using autocomplete and verify that the stockpile bars are clearly visible in both light/dark themes and sorted correctly.
* **Supply Requests:** Create new requests, claim/assign a request to yourself, and check if it syncs with other users.
* **Chat:** Test real-time message sending and delivery.

### 2. For Officers (Subaylar)
* **Audit Logs:** Verify that all logi imports, request creations, and administrative updates are logged correctly in the "Officer Portal & Audit Logs" tab.
* **Security:** Ensure that access keys and gate permissions enforce the proper boundary.

### 3. Feedback Submission
Please report any bugs or suggestions using the **Feedback** tab inside the application.
