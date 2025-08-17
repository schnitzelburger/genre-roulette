// --- Spotify OAuth ---
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

async function redirectToSpotifyAuth() {
    console.log('redirectToSpotifyAuth wird ausgeführt');
    alert('redirectToSpotifyAuth wird ausgeführt!');
    if (!SPOTIFY_CLIENT_ID || !REDIRECT_URI || !SCOPES) {
        alert('Spotify Konfiguration fehlt! Bitte prüfe config.js.');
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
        alert('Fehler beim Erstellen der Spotify Auth URL!');
        return;
    }
    console.log('Redirect zu:', authUrl);
    alert('Redirect zu: ' + authUrl);
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

// --- Spotify Player ---
let spotifyAccessToken = null;
let spotifyDeviceId = null;
let spotifyPlayer = null;
let isPlaying = false;
let currentTrackUri = null;

function initializeSpotifyPlayer(accessToken) {
    spotifyPlayer = new Spotify.Player({
        name: 'Genre Roulette Player',
        getOAuthToken: cb => { cb(accessToken); },
        volume: 1.0
    });
    spotifyPlayer.connect();
}

window.onSpotifyWebPlaybackSDKReady = () => {
    window.dispatchEvent(new CustomEvent('SpotifySDKReady'));
};

// Exportiere Funktionen global
window.spotifyAuth = {
    getAccessToken,
    redirectToSpotifyAuth,
    initializeSpotifyPlayer,
    getSpotifyPlayer: () => spotifyPlayer,
    getSpotifyDeviceId: () => spotifyDeviceId,
    getSpotifyAccessToken: () => spotifyAccessToken,
    getIsPlaying: () => isPlaying,
    getCurrentTrackUri: () => currentTrackUri,
    setSpotifyDeviceId: (id) => { spotifyDeviceId = id; },
    setIsPlaying: (val) => { isPlaying = val; },
    setCurrentTrackUri: (uri) => { currentTrackUri = uri; }
};
