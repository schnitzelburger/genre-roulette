#!/usr/bin/env python3
"""
HTTPS Development Server for openbeatster Web App
Starts a local HTTPS server with self-signed certificate
for camera access in browsers.
"""

import http.server
import ssl
import socketserver
import os
import subprocess
import sys
from pathlib import Path

def create_self_signed_cert():
    """Creates a self-signed SSL certificate"""
    cert_file = "server.crt"
    key_file = "server.key"
    
    if os.path.exists(cert_file) and os.path.exists(key_file):
        print("SSL certificate already exists")
        return cert_file, key_file
    
    print("Creating self-signed SSL certificate...")
    
    # Get local IP for certificate
    local_ip = get_local_ip()
    
    # OpenSSL command to create a self-signed certificate with IP SAN
    cmd = [
        "openssl", "req", "-x509", "-newkey", "rsa:4096", 
        "-keyout", key_file, "-out", cert_file, "-days", "365", 
        "-nodes", "-subj", f"/C=DE/ST=State/L=City/O=Dev/CN={local_ip}",
        "-addext", f"subjectAltName=DNS:localhost,IP:127.0.0.1,IP:{local_ip}"
    ]
    
    try:
        subprocess.run(cmd, check=True, capture_output=True)
        print(f"Certificate created: {cert_file}, {key_file}")
        print(f"Certificate valid for: localhost, 127.0.0.1, {local_ip}")
        return cert_file, key_file
    except subprocess.CalledProcessError as e:
        print(f"Error creating certificate: {e}")
        print("OpenSSL must be installed. Install it with:")
        print("sudo apt-get install openssl")
        sys.exit(1)
    except FileNotFoundError:
        print("OpenSSL not found. Install it with:")
        print("sudo apt-get install openssl")
        sys.exit(1)

def get_local_ip():
    """Gets the local IP address"""
    try:
        import socket
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.connect(("8.8.8.8", 80))
        local_ip = s.getsockname()[0]
        s.close()
        return local_ip
    except:
        return "127.0.0.1"

def start_https_server(port=5500):
    """Starts the HTTPS server"""
    # Change to the app directory
    os.chdir(Path(__file__).parent)
    
    # Create SSL certificate
    cert_file, key_file = create_self_signed_cert()
    
    # HTTP handler for static files
    handler = http.server.SimpleHTTPRequestHandler
    
    # Create server
    with socketserver.TCPServer(("0.0.0.0", port), handler) as httpd:
        # Configure SSL context
        context = ssl.SSLContext(ssl.PROTOCOL_TLS_SERVER)
        context.load_cert_chain(cert_file, key_file)
        
        # Wrap SSL socket
        httpd.socket = context.wrap_socket(httpd.socket, server_side=True)
        
        local_ip = get_local_ip()
        
        print("="*60)
        print("🚀 HTTPS Development Server started!")
        print("="*60)
        print(f"📱 Local:        https://localhost:{port}")
        print(f"🌐 Network:      https://{local_ip}:{port}")
        print("="*60)
        print("📋 Setup steps:")
        print(f"1. Open https://{local_ip}:{port} in browser")
        print("2. Accept the self-signed certificate")
        print(f"3. Spotify Redirect URI: https://{local_ip}:{port}/")
        print("="*60)
        print("⏹️  To stop: Ctrl+C")
        print("="*60)
        
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            httpd.shutdown()
            print("\n🛑 Server stopped!")

if __name__ == "__main__":
    import argparse
    
    parser = argparse.ArgumentParser(description="HTTPS Development Server for openbeatster Web App")
    parser.add_argument("--port", "-p", type=int, default=5500, help="Port (default: 5500)")
    
    args = parser.parse_args()
    
    start_https_server(args.port)
