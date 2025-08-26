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
  if (track && artist) {
    infoElem.innerHTML = `<strong>${track}</strong><br><span>${artist}</span>`;
    infoElem.style.display = 'block';
  } else {
    infoElem.innerHTML = '';
    infoElem.style.display = 'none';
  }
}

let timerInterval = null;
let trackInterval = null;
let skipBtn = null;
let skipUsedForCurrentGenre = false;

function startRoulette() {
  // Show loading symbol in track-info while waiting for track/artist
  let infoElem = document.getElementById('track-info');
  if (infoElem) {
    infoElem.innerHTML = '<span class="loader"></span>';
    infoElem.style.display = 'block';
  }
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
  document.getElementById('device-select').disabled = true;
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
        // Show loader in track-info when skipping
        let infoElem = document.getElementById('track-info');
        if (infoElem) {
          infoElem.innerHTML = '<span class="loader"></span>';
          infoElem.style.display = 'block';
        }
        const deviceId = selectedDeviceId || window.spotifyAuth.getSpotifyDeviceId();
        window.spotifyAuth.skipCurrentTrack(deviceId);
        skipUsedForCurrentGenre = true;
        skipBtn.disabled = true;
      }
    });
    skipBtn.disabled = false;
  } else {
    skipBtn.style.display = 'inline-block';
    skipBtn.onclick = () => {
      if (!skipUsedForCurrentGenre) {
        // Show loader in track-info when skipping
        let infoElem = document.getElementById('track-info');
        if (infoElem) {
          infoElem.innerHTML = '<span class="loader"></span>';
          infoElem.style.display = 'block';
        }
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
    document.getElementById('device-select').disabled = false;
  }, GENRE_DURATION_MINUTES * 60 * 1000);
}

function pausePlayback() {
  const deviceId = selectedDeviceId || window.spotifyAuth.getSpotifyDeviceId();
  fetch('https://api.spotify.com/v1/me/player/pause?device_id=' + deviceId, {
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
    document.getElementById('spotify-status').insertBefore(container, document.getElementById('reset-auth'));
  }
  container.innerHTML = '<strong>Select playback device:</strong><br>';
  const select = document.createElement('select');
  select.id = 'device-select';
  select.className = 'device-select';
  select.disabled = false;
  // Add Web Player option
  const webPlayerOption = document.createElement('option');
  webPlayerOption.value = 'web-playback-sdk';
  webPlayerOption.textContent = 'Web Player (this browser)';
  select.appendChild(webPlayerOption);
  // Add spotify devices
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
  })
  .then(response => {
      if (!response.ok) {
        alert("Fehler beim Setzen von Shuffle: " + response.status);
      }
    })
    .catch(error => {
      alert("Netzwerk- oder API-Fehler: " + error);
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
  // --- 1. Spotify Auth ---
  await initializeSpotify();
  setupLoginButton();

  const accessToken = await window.spotifyAuth.getAccessToken();
  if (!accessToken) {
    showLoginState();
    return;
  }

  // --- 2. Device Selection ---
  const devices = await window.spotifyAuth.fetchSpotifyDevices();
  showDeviceSelection(devices);
  if (devices.length === 0) {
    showNoDevicesState();
  }

  // --- 3. UI Button Setup ---
  setupRouletteButtons();

  // --- Helper Functions ---
  function showLoginState() {
    document.getElementById('status-text').textContent = 'Login to Spotify';
    const deviceContainer = document.getElementById('device-select-container');
    if (deviceContainer) deviceContainer.style.display = 'none';
  }

  function showNoDevicesState() {
    document.getElementById('status-text').textContent = 'No Spotify devices found. Start playback in your Spotify app or use the Web Player.';
  }

  function setupRouletteButtons() {
    // Start button
    const startBtn = document.getElementById('start-roulette');
    if (startBtn) {
      startBtn.addEventListener('click', () => {
        isPaused = false;
        startRoulette();
      });
    }
    // Next genre button
    let nextBtn = document.getElementById('next-genre');
    if (!nextBtn) {
      nextBtn = document.createElement('button');
      nextBtn.id = 'next-genre';
      nextBtn.textContent = 'Next Genre';
      nextBtn.style.display = 'none';
      document.getElementById('button-row').appendChild(nextBtn);
    }
    nextBtn.addEventListener('click', () => {
      isPaused = false;
      document.getElementById('device-select').disabled = false;
      startRoulette();
    });
  }

  function setupLoginButton() {
    const loginBtn = document.getElementById('reset-auth');
    if (loginBtn) {
      loginBtn.addEventListener('click', () => {
        if (window.spotifyAuth && typeof window.spotifyAuth.redirectToSpotifyAuth === 'function' && typeof window.spotifyAuth.clearStoredTokens === 'function') {
          window.spotifyAuth.clearStoredTokens();
          window.spotifyAuth.redirectToSpotifyAuth();
        } else {
          alert('Spotify Auth function not available. Please reload the page.');
        }
      });
    }
  }
});