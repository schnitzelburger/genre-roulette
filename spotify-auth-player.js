const SPOTIFY_CLIENT_ID = window.CONFIG?.SPOTIFY_CLIENT_ID;
const REDIRECT_URI = window.CONFIG?.REDIRECT_URI;
const SCOPES = window.CONFIG?.SPOTIFY_SCOPES;

function generateCodeVerifier() {
    const array = new Uint8Array(32);
    crypto.getRandomValues(array);
    return btoa(String.fromCharCode.apply(null, array))
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=/g, '');
}

async function generateCodeChallenge(verifier) {
    const encoder = new TextEncoder();
    const data = encoder.encode(verifier);
    const digest = await crypto.subtle.digest('SHA-256', data);
    return btoa(String.fromCharCode.apply(null, new Uint8Array(digest)))
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=/g, '');
}

function getAuthorizationCode() {
    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.get('code');
}

async function exchangeCodeForToken(authCode) {
    const codeVerifier = localStorage.getItem('spotify_code_verifier');
    if (!codeVerifier) {
        throw new Error('Code verifier not found');
    }
    const response = await fetch('https://accounts.spotify.com/api/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
            grant_type: 'authorization_code',
            code: authCode,
            redirect_uri: REDIRECT_URI,
            client_id: SPOTIFY_CLIENT_ID,
            code_verifier: codeVerifier,
        }),
    });
    if (!response.ok) {
        throw new Error(`Token exchange failed: ${response.status}`);
    }
    const data = await response.json();
    return data.access_token;
}

function clearStoredTokens() {
    localStorage.removeItem('spotifyAccessToken');
    localStorage.removeItem('spotify_code_verifier');
    spotifyAccessToken = null;
    console.log('Cleared stored Spotify tokens');
}

async function redirectToSpotifyAuth() {
    console.log('redirectToSpotifyAuth is running');
    if (!SPOTIFY_CLIENT_ID || !REDIRECT_URI || !SCOPES) {
        alert('Spotify configuration missing! Please check config.js.');
        return;
    }
    const codeVerifier = generateCodeVerifier();
    const codeChallenge = await generateCodeChallenge(codeVerifier);
    localStorage.setItem('spotify_code_verifier', codeVerifier);
    const authUrl = `https://accounts.spotify.com/authorize?` +
        `client_id=${SPOTIFY_CLIENT_ID}` +
        `&response_type=code` +
        `&redirect_uri=${encodeURIComponent(REDIRECT_URI)}` +
        `&code_challenge_method=S256` +
        `&code_challenge=${codeChallenge}` +
        `&scope=${encodeURIComponent(SCOPES)}`;
    if (!authUrl || authUrl.length < 10) {
        alert('Error creating Spotify Auth URL!');
        return;
    }
    console.log('Redirecting to:', authUrl);
    window.location.href = authUrl;
}

async function getAccessToken() {
    let token = localStorage.getItem('spotifyAccessToken');
    if (token) {
        spotifyAccessToken = token;
        return token;
    }
    const authCode = getAuthorizationCode();
    if (authCode) {
        try {
            token = await exchangeCodeForToken(authCode);
            localStorage.setItem('spotifyAccessToken', token);
            localStorage.removeItem('spotify_code_verifier');
            window.history.replaceState({}, document.title, window.location.pathname);
            spotifyAccessToken = token;
            return token;
        } catch (error) {
            console.error('Token exchange failed:', error);
            localStorage.removeItem('spotify_code_verifier');
            return null;
        }
    }
    return null;
}

async function validateAccessToken(token) {
    if (!token) return false;
    try {
        const response = await fetch('https://api.spotify.com/v1/me', {
            headers: { Authorization: `Bearer ${token}` }
        });
        if (response.ok) {
            return true;
        } else if (response.status === 401) {
            localStorage.removeItem('spotifyAccessToken');
            spotifyAccessToken = null;
            return false;
        } else {
            return false;
        }
    } catch (error) {
        return false;
    }
}

// --- Spotify Player ---
let spotifyAccessToken = null;
let spotifyDeviceId = null;
let spotifyPlayer = null;
let isPlaying = false;
let currentTrackUri = null;

async function initializeSpotifyPlayer(accessToken) {
    // Validate token before connect
    let validToken = await window.spotifyAuth.getAccessToken();
    const isValid = await window.spotifyAuth.validateAccessToken(validToken);
    if (!isValid) {
        if (document.getElementById('status-text')) {
            document.getElementById('status-text').textContent = 'Spotify token invalid. Please log in again.';
        }
        if (document.getElementById('reset-auth')) {
            document.getElementById('reset-auth').style.display = 'inline-block';
        }
        return;
    }
    
    spotifyPlayer = new Spotify.Player({
        name: 'Genre Roulette Player',
        getOAuthToken: cb => { cb(validToken); },
        volume: 1.0
    });

    // Catch error and status events
    spotifyPlayer.addListener('initialization_error', ({ message }) => {
        if (document.getElementById('status-text')) {
            document.getElementById('status-text').textContent = 'Player error: ' + message;
        }
        if (document.getElementById('reset-auth')) {
            document.getElementById('reset-auth').style.display = 'inline-block';
        }
    });

    spotifyPlayer.addListener('authentication_error', ({ message }) => {
        if (document.getElementById('status-text')) {
            document.getElementById('status-text').textContent = 'Authentication error: ' + message;
        }
        if (document.getElementById('reset-auth')) {
            document.getElementById('reset-auth').style.display = 'inline-block';
        }
    });

    spotifyPlayer.addListener('account_error', ({ message }) => {
        if (document.getElementById('status-text')) {
            document.getElementById('status-text').textContent = 'Account error: ' + message;
        }
        if (document.getElementById('reset-auth')) {
            document.getElementById('reset-auth').style.display = 'inline-block';
        }
    });

    spotifyPlayer.addListener('playback_error', ({ message }) => {
        if (document.getElementById('status-text')) {
            document.getElementById('status-text').textContent = 'Playback error: ' + message;
        }
    });

    spotifyPlayer.addListener('ready', ({ device_id }) => {
        spotifyDeviceId = device_id;
        console.log('Spotify Player ready, device_id:', device_id);
        if (document.getElementById('status-text')) {
            document.getElementById('status-text').textContent = 'Player ready';
        }
    });

    console.log('Connecting Spotify Player...');
    spotifyPlayer.connect().then(success => {
        if (success) {
            console.log('Spotify Player successfully connected');
        } else {
            console.error('Spotify Player connection failed');
        }
    });
}

window.onSpotifyWebPlaybackSDKReady = () => {
    window.dispatchEvent(new CustomEvent('SpotifySDKReady'));
};

// Exportiere Funktionen global
window.spotifyAuth = {
    getAccessToken,
    redirectToSpotifyAuth,
    clearStoredTokens,
    initializeSpotifyPlayer,
    getSpotifyPlayer: () => spotifyPlayer,
    getSpotifyDeviceId: () => spotifyDeviceId,
    getSpotifyAccessToken: () => spotifyAccessToken,
    getIsPlaying: () => isPlaying,
    getCurrentTrackUri: () => currentTrackUri,
    setSpotifyDeviceId: (id) => { spotifyDeviceId = id; },
    setIsPlaying: (val) => { isPlaying = val; },
    setCurrentTrackUri: (uri) => { currentTrackUri = uri; },
    validateAccessToken,
    async fetchCurrentTrack(updateTrackInfo) {
        const token = window.spotifyAuth.getSpotifyAccessToken();
        const res = await fetch('https://api.spotify.com/v1/me/player/currently-playing', {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (res.ok) {
            const data = await res.json();
            if (data && data.item) {
                const track = data.item.name;
                const artist = data.item.artists.map(a => a.name).join(', ');
                updateTrackInfo(track, artist);
            } else {
                updateTrackInfo('', '');
            }
        } else {
            updateTrackInfo('', '');
        }
    },
    async skipCurrentTrack(deviceId) {
        if (!deviceId) {
            alert('No Spotify device selected or ready. Please select a device and try again.');
            return;
        }
        const res = await fetch(`https://api.spotify.com/v1/me/player/next?device_id=${deviceId}`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${window.spotifyAuth.getSpotifyAccessToken()}`,
                'Content-Type': 'application/json'
            }
        });
        if (!res.ok) {
            try {
                const data = await res.json();
                alert('Error skipping track: ' + (data.error?.message || 'Unknown error'));
            } catch {
                alert('Error skipping track: Unknown error');
            }
        }
    },
    async fetchSpotifyDevices() {
        const token = window.spotifyAuth.getSpotifyAccessToken();
        const res = await fetch('https://api.spotify.com/v1/me/player/devices', {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        if (!res.ok) {
          if (document.getElementById('status-text')) {
            document.getElementById('status-text').textContent = 'Error fetching devices';
          }
          return [];
        }
        const data = await res.json();
        return data.devices || [];
      },
};
