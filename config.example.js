// Example configuration file for openbeatster Web App
// Copy this file to config.js and fill in your actual values

window.SPOTIFY_CLIENT_ID = 'your_spotify_client_id_here';
window.REDIRECT_URI = 'https://your-server-ip:5500';

window.CONFIG = {
    SPOTIFY_SCOPES: 'streaming user-read-email user-read-private user-modify-playback-state user-read-playback-state',
    SERVER_IP: '192.168.178.100',  // Replace with your actual IP
    SERVER_PORT: 5500
};
