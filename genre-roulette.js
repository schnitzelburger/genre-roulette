// genre-roulette.js
const GENRES = window.GENRES;
function getDurationFromUrl() {
  const params = new URLSearchParams(window.location.search);
  const timerParam = params.get('timer');
  const minutes = parseInt(timerParam, 10);
  return (!isNaN(minutes) && minutes > 0) ? minutes : null;
}

let GENRE_DURATION_MINUTES = 15;
const urlMinutes = getDurationFromUrl();
if (urlMinutes) GENRE_DURATION_MINUTES = urlMinutes;

let currentGenre = null;
let timer = null;
let previousGenre = null;
let isPaused = false;

function getRandomGenre() {
  return GENRES[Math.floor(Math.random() * GENRES.length)];
}

async function initializeSpotify() {
  document.getElementById('status-text').textContent = 'Authenticating...';
  const accessToken = await window.spotifyAuth.getAccessToken();
  if (!accessToken) {
    document.getElementById('status-text').textContent = 'Not logged in';
    document.getElementById('reset-auth').style.display = 'inline-block';
    return;
  }
  document.getElementById('status-text').textContent = 'Logged in';
  document.getElementById('reset-auth').style.display = 'none';

  // Player-Init erst wenn SDK bereit ist
  window.addEventListener('SpotifySDKReady', () => {
    window.spotifyAuth.initializeSpotifyPlayer(accessToken);
    const player = window.spotifyAuth.getSpotifyPlayer();
    if (player) {
      player.addListener('ready', ({ device_id }) => {
        window.spotifyAuth.setSpotifyDeviceId(device_id);
        document.getElementById('status-text').textContent = 'Player bereit';
      });
    }
  });
}

function getRandomGenreNoRepeat() {
  if (GENRES.length < 2) return getRandomGenre();
  let genre;
  do {
    genre = getRandomGenre();
  } while (previousGenre && genre.name === previousGenre.name);
  previousGenre = genre;
  return genre;
}

// Zeitanzeige ergänzen
function updateTimerDisplay(secondsLeft) {
  let timerElem = document.getElementById('timer-display');
  if (!timerElem) {
    timerElem = document.createElement('div');
    timerElem.id = 'timer-display';
    timerElem.style.fontWeight = 'bold';
    timerElem.style.marginTop = '10px';
    document.getElementById('genre-display').appendChild(timerElem);
  }
  const min = Math.floor(secondsLeft / 60);
  const sec = secondsLeft % 60;
  timerElem.textContent = `Verbleibende Zeit: ${min}:${sec.toString().padStart(2, '0')}`;
}

function updateTrackInfo(track, artist) {
  let infoElem = document.getElementById('track-info');
  if (!infoElem) {
    infoElem = document.createElement('div');
    infoElem.id = 'track-info';
    infoElem.style.marginTop = '18px';
    document.getElementById('genre-display').appendChild(infoElem);
  }
  infoElem.innerHTML = track && artist
    ? `<strong>${track}</strong><br><span>${artist}</span>`
    : '';
}

let timerInterval = null;
let trackInterval = null;
let skipBtn = null;

function startRoulette() {
  if (isPaused) return;
  const deviceId = window.spotifyAuth.getSpotifyDeviceId();
  if (!deviceId) {
    alert('Spotify Player ist noch nicht bereit. Bitte kurz warten und erneut versuchen.');
    return;
  }
  currentGenre = getRandomGenreNoRepeat();
  updateGenreDisplay(currentGenre.name);
  playGenrePlaylist(currentGenre.playlistId);
  document.getElementById('start-roulette').style.display = 'none';
  document.getElementById('next-genre').style.display = 'none';
  // Skip-Button anzeigen
  if (!skipBtn) {
    skipBtn = document.createElement('button');
    skipBtn.id = 'skip-genre';
    skipBtn.textContent = 'Skip';
    skipBtn.style.display = 'inline-block';
    skipBtn.style.marginTop = '10px';
    document.getElementById('genre-display').appendChild(skipBtn);
    skipBtn.addEventListener('click', () => {
      isPaused = false;
      clearTimeout(timer);
      clearInterval(timerInterval);
      clearInterval(trackInterval);
      startRoulette();
    });
  } else {
    skipBtn.style.display = 'inline-block';
  }
  if (timer) clearTimeout(timer);
  if (timerInterval) clearInterval(timerInterval);
  let secondsLeft = GENRE_DURATION_MINUTES * 60;
  updateTimerDisplay(secondsLeft);
  timerInterval = setInterval(() => {
    secondsLeft--;
    updateTimerDisplay(secondsLeft);
    if (secondsLeft <= 0) {
      clearInterval(timerInterval);
    }
  }, 1000);
  // Track-Info Intervall
  if (trackInterval) clearInterval(trackInterval);
  trackInterval = setInterval(() => window.spotifyAuth.fetchCurrentTrack(updateTrackInfo), 3000);
  timer = setTimeout(() => {
    pausePlayback();
    isPaused = true;
    document.getElementById('next-genre').style.display = 'inline-block';
    updateTimerDisplay(0);
    clearInterval(timerInterval);
    clearInterval(trackInterval);
    // Skip-Button ausblenden
    if (skipBtn) skipBtn.style.display = 'none';
  }, GENRE_DURATION_MINUTES * 60 * 1000);
}

function pausePlayback() {
  fetch('https://api.spotify.com/v1/me/player/pause?device_id=' + window.spotifyAuth.getSpotifyDeviceId(), {
    method: 'PUT',
    headers: {
      'Authorization': `Bearer ${window.spotifyAuth.getSpotifyAccessToken()}`,
      'Content-Type': 'application/json'
    }
  }).then(res => {
    if (res.ok) {
      document.getElementById('status-text').textContent = 'Paused';
    } else {
      res.json().then(data => {
        alert('Error pausing playback: ' + (data.error?.message || 'Unknown error'));
      });
    }
  });
}

function updateGenreDisplay(genreName) {
  document.getElementById('genre-name').textContent = genreName;
}

function playGenrePlaylist(playlistId) {
  const deviceId = window.spotifyAuth.getSpotifyDeviceId();
  if (!deviceId) {
    alert('Spotify Player ist noch nicht bereit. Bitte kurz warten und erneut versuchen.');
    return;
  }
  fetch(`https://api.spotify.com/v1/me/player/play?device_id=${deviceId}`, {
    method: 'PUT',
    headers: {
      'Authorization': `Bearer ${window.spotifyAuth.getSpotifyAccessToken()}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ context_uri: `spotify:playlist:${playlistId}` })
  }).then(res => {
    if (res.ok) {
      document.getElementById('status-text').textContent = 'Playing';
      console.log('Playing playlist:', playlistId);
    } else {
      res.json().then(data => {
        alert('Error playing playlist: ' + (data.error?.message || 'Unknown error'));
      });
    }
  });
}

// UI-Setup
document.addEventListener('DOMContentLoaded', () => {
  initializeSpotify();
  document.getElementById('start-roulette').addEventListener('click', () => {
    isPaused = false;
    startRoulette();
  });
  // Button für nächstes Genre
  let nextBtn = document.getElementById('next-genre');
  if (!nextBtn) {
    nextBtn = document.createElement('button');
    nextBtn.id = 'next-genre';
    nextBtn.textContent = 'Nächstes Genre';
    nextBtn.style.display = 'none';
    document.getElementById('genre-display').appendChild(nextBtn);
  }
  nextBtn.addEventListener('click', () => {
    isPaused = false;
    startRoulette();
  });
  // Button für Login immer korrekt setzen
  const loginBtn = document.getElementById('reset-auth');
  if (loginBtn) {
    loginBtn.onclick = () => {
      console.log('Login-Button wurde geklickt');
      if (window.spotifyAuth && typeof window.spotifyAuth.redirectToSpotifyAuth === 'function') {
        window.spotifyAuth.redirectToSpotifyAuth();
      } else {
        alert('Spotify Auth Funktion nicht verfügbar. Bitte Seite neu laden.');
      }
    };
  }
});