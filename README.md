# Genre Roulette

A web app for Spotify that lets you play a random genre for a set time, then switch to another genre — perfect for music discovery, parties, or group listening sessions.

## Features
- 🎲 Random genre selection from a curated list
- ⏱️ Adjustable timer for each genre round (default: 15 minutes, can be set via URL)
- 🔄 Prevents immediate genre repeats (remembers last 3 genres)
- 🍪 Genre history is persisted via cookies
- 🎧 Device selection: Play on any available Spotify device or the built-in Web Player
- 🔒 Device selection locks during a round, unlocks after
- 🟢 Spotify authentication with PKCE (no server needed)
- 🕒 Loader and status feedback for user actions
- 📱 Responsive UI for desktop and mobile

## How It Works
1. **Login with Spotify**: Authenticate via the Spotify Web API (OAuth PKCE).
2. **Select Device**: Choose a Spotify device (phone, desktop app, or Web Player). If no other device is found, the Web Player is used by default.
3. **Start Roulette**: The app picks a random genre and starts playback on the selected device.
4. **Timer**: Each round lasts for the set duration. When time is up, you can start the next genre.
5. **Skip Track**: Skip the current track (once per genre round).
6. **No Genre Repeats**: The last 3 genres are remembered and not repeated immediately.

## Setup & Usage

### 1. Clone the Repository

### 2. Create Spotify Developer App
- Go to the [Spotify Developer Dashboard](https://developer.spotify.com/dashboard/applications)
- Create a new app
- Set the Redirect URI to: `https://<your-domain-or-localhost>/`
- Copy your **Client ID**

### 3. Configure the App
- Copy `config.example.js` to `config.js`
- Fill in your Spotify Client ID and Redirect URI in `config.js`

### 4. Start the HTTPS Server (for local testing)
Spotify requires HTTPS for authentication. Use the provided Python script:
```bash
python start_https_server.py
```
- The app will be available at: `https://localhost:5500/`
- Accept the self-signed certificate in your browser

### 5. Open in Browser
Go to `https://localhost:5500/` and follow the instructions.

## Requirements
- Spotify Premium account (required for playback control)
- Browser (Chrome, Firefox, Edge, Safari)
- Python 3 (for local HTTPS server)
- OpenSSL (optional, only needed for generating a self-signed certificate to run the app locally with HTTPS)

## Customization
- Add or edit genres in `genres.js`
- Change timer default or limits in `genre-roulette.js`
- Adjust UI in `genre-roulette.css` and `index.html`

## Troubleshooting
- **No devices found?**
  - Start playback in your Spotify app (phone/desktop) and reload the page.
- **Web Player not working?**
  - Make sure you allow the browser to play audio and accept the HTTPS certificate.
- **Authentication issues?**
  - Double-check your `config.js` and Spotify Developer settings.

---

Made with ❤️ for music lovers. PRs and feedback welcome!
