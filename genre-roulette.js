// genre-roulette.js
const GENRES = window.GENRES;
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

function startRoulette() {
  if (isPaused) return;
  currentGenre = getRandomGenreNoRepeat();
  updateGenreDisplay(currentGenre.name);
  playGenrePlaylist(currentGenre.playlistId);
  document.getElementById('start-roulette').style.display = 'none';
  document.getElementById('next-genre').style.display = 'none';
  if (timer) clearTimeout(timer);
  timer = setTimeout(() => {
    pausePlayback();
    isPaused = true;
    document.getElementById('next-genre').style.display = 'inline-block';
  }, 10 * 60 * 1000); // 10 Minuten
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
      alert('Login-Button wurde geklickt!');
      if (window.spotifyAuth && typeof window.spotifyAuth.redirectToSpotifyAuth === 'function') {
        window.spotifyAuth.redirectToSpotifyAuth();
      } else {
        alert('Spotify Auth Funktion nicht verfügbar. Bitte Seite neu laden.');
      }
    };
  }
});