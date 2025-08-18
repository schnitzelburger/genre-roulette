const GENRES = window.GENRES;

let GENRE_DURATION_MINUTES = 15;
// Check for URL parameter to override default duration
const urlGenreDuration = getDurationFromUrl();
if (urlGenreDuration) GENRE_DURATION_MINUTES = urlGenreDuration;

let currentGenre = null;
let timer = null;
let previousGenre = null;
let isPaused = false;
let selectedDeviceId = null;
let wakeLock = null;

function requestWakeLock() {
  if ('wakeLock' in navigator) {
    navigator.wakeLock.request('screen').then(lock => {
      wakeLock = lock;
      lock.addEventListener('release', () => { wakeLock = null; });
    }).catch(() => {});
  }
}

function releaseWakeLock() {
  if (wakeLock) {
    wakeLock.release();
    wakeLock = null;
  }
}

function getDurationFromUrl() {
    const params = new URLSearchParams(window.location.search);
    const timerParam = params.get('timer');
    const minutes = parseInt(timerParam, 10);
    return (!isNaN(minutes) && minutes > 0) ? minutes : null;
}

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
  // Do NOT initialize Web Playback SDK automatically
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
  timerElem.textContent = `Time left: ${min}:${sec.toString().padStart(2, '0')}`;
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
let skipUsedForCurrentGenre = false;

function startRoulette() {
  if (isPaused) return;
  const deviceId = selectedDeviceId || window.spotifyAuth.getSpotifyDeviceId();
  if (!deviceId) {
    alert('No Spotify device selected or ready. Please select a device and try again.');
    return;
  }
  currentGenre = getRandomGenreNoRepeat();
  skipUsedForCurrentGenre = false;
  updateGenreDisplay(currentGenre.name);
  playGenrePlaylist(currentGenre.playlistId);
  document.getElementById('start-roulette').style.display = 'none';
  document.getElementById('next-genre').style.display = 'none';
  // Show skip button
  let skipBtn = document.getElementById('skip-track');
  if (!skipBtn) {
    skipBtn = document.createElement('button');
    skipBtn.id = 'skip-track';
    skipBtn.textContent = 'Skip Track';
    const skipNote = document.createElement('div');
    skipNote.textContent = '(only once per genre)';
    skipNote.style.fontSize = '0.7em';
    skipBtn.appendChild(skipNote);
    skipBtn.style.display = 'inline-block';
    skipBtn.style.marginTop = '10px';
    const buttonRow = document.querySelector('.button-row');
    if (buttonRow) buttonRow.appendChild(skipBtn);
    skipBtn.addEventListener('click', () => {
      if (!skipUsedForCurrentGenre) {
        window.spotifyAuth.skipCurrentTrack();
        skipUsedForCurrentGenre = true;
        skipBtn.disabled = true;
      }
    });
    skipBtn.disabled = false;
  } else {
    skipBtn.style.display = 'inline-block';
    skipBtn.onclick = () => {
      if (!skipUsedForCurrentGenre) {
        window.spotifyAuth.skipCurrentTrack();
        skipUsedForCurrentGenre = true;
        skipBtn.disabled = true;
      }
    };
    skipBtn.disabled = false;
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
  // Track info interval
  if (trackInterval) clearInterval(trackInterval);
  trackInterval = setInterval(() => window.spotifyAuth.fetchCurrentTrack(updateTrackInfo), 3000);
  // Timer for genre end
  timer = setTimeout(() => {
    pausePlayback();
    isPaused = true;
    document.getElementById('next-genre').style.display = 'inline-block';
    updateTimerDisplay(0);
    clearInterval(timerInterval);
    clearInterval(trackInterval);
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
    releaseWakeLock();
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

function showDeviceSelection(devices) {
  let container = document.getElementById('device-select-container');
  if (!container) {
    container = document.createElement('div');
    container.id = 'device-select-container';
    container.style.margin = '8px 0';
    document.getElementById('spotify-status').appendChild(container);
  }
  container.innerHTML = '<strong>Select playback device:</strong><br>';
  const select = document.createElement('select');
  select.id = 'device-select';
  select.className = 'device-select';
  // Add Web Player option
  const webPlayerOption = document.createElement('option');
  webPlayerOption.value = 'web-playback-sdk';
  webPlayerOption.textContent = 'Web Player (this browser)';
  select.appendChild(webPlayerOption);
  devices.forEach(device => {
    console.log('Device:', device);
    const option = document.createElement('option');
    option.value = device.id;
    option.textContent = `${device.name} (${device.type}${device.is_active ? ', active' : ''})`;
    select.appendChild(option);
  });
  // Default selection logic
  let defaultDevice = devices.find(d => d.is_active);
  if (!defaultDevice) {
    defaultDevice = devices.find(d => d.type === 'Smartphone');
  }
  if (!defaultDevice && devices.length > 0) {
    defaultDevice = devices[0];
  }
  // If no device, default to web player
  if (!defaultDevice) {
    select.value = 'web-playback-sdk';
    selectedDeviceId = null;
    document.getElementById('status-text').textContent = 'Selected device: Web Player (this browser)';
  } else {
    select.value = defaultDevice.id;
    selectedDeviceId = defaultDevice.id;
    document.getElementById('status-text').textContent = 'Selected device: ' + defaultDevice.name;
  }
  select.onchange = async () => {
    if (select.value === 'web-playback-sdk') {
      // Initialize Web Playback SDK only when selected
      await window.spotifyAuth.initializeSpotifyPlayer(await window.spotifyAuth.getAccessToken());
      // Wait for SDK ready and set deviceId
      window.addEventListener('SpotifySDKReady', () => {
        const player = window.spotifyAuth.getSpotifyPlayer();
        if (player) {
          player.addListener('ready', ({ device_id }) => {
            window.spotifyAuth.setSpotifyDeviceId(device_id);
            selectedDeviceId = device_id;
            document.getElementById('status-text').textContent = 'Selected device: Web Player (this browser)';
          });
        }
      });
    } else {
      selectedDeviceId = select.value;
      document.getElementById('status-text').textContent = 'Selected device: ' + select.options[select.selectedIndex].text;
    }
  };
  container.appendChild(select);
}

function setShuffle(deviceId, state = true) {
  return fetch(`https://api.spotify.com/v1/me/player/shuffle?state=${state}&device_id=${deviceId}`, {
    method: 'PUT',
    headers: {
      'Authorization': `Bearer ${window.spotifyAuth.getSpotifyAccessToken()}`
    }
  });
}

function playGenrePlaylist(playlistId) {
  const deviceId = selectedDeviceId || window.spotifyAuth.getSpotifyDeviceId();
  if (!deviceId) {
    alert('No Spotify device selected or ready. Please select a device and try again.');
    return;
  }
  requestWakeLock();
  // Enable shuffle mode
  setShuffle(deviceId, true);
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

// UI setup
document.addEventListener('DOMContentLoaded', async () => {
  await initializeSpotify();
  // Fetch and show devices
  const devices = await window.spotifyAuth.fetchSpotifyDevices();
  if (devices.length > 0) {
    showDeviceSelection(devices);
  } else {
    document.getElementById('status-text').textContent = 'No Spotify devices found. Please start playback in your Spotify app.';
  }
  document.getElementById('start-roulette').addEventListener('click', () => {
    isPaused = false;
    startRoulette();
  });
  // Button for next genre
  let nextBtn = document.getElementById('next-genre');
  if (!nextBtn) {
    nextBtn = document.createElement('button');
    nextBtn.id = 'next-genre';
    nextBtn.textContent = 'Next Genre';
    nextBtn.style.display = 'none';
    document.getElementById('genre-display').appendChild(nextBtn);
  }
  nextBtn.addEventListener('click', () => {
    isPaused = false;
    startRoulette();
  });
  const loginBtn = document.getElementById('reset-auth');
  if (loginBtn) {
    loginBtn.onclick = () => {
      if (window.spotifyAuth && typeof window.spotifyAuth.redirectToSpotifyAuth === 'function') {
        window.spotifyAuth.redirectToSpotifyAuth();
      } else {
        alert('Spotify Auth function not available. Please reload the page.');
      }
    };
  }
});