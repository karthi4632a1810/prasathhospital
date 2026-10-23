# =============================================================================
# NGINX — CIIM 2026 Public Website
# Host-level reverse proxy → Docker container on port 1008
#
# Place at /etc/nginx/sites-available/ciim.prashanthhospitals.com
# Symlink: ln -s /etc/nginx/sites-available/ciim.prashanthhospitals.com /etc/nginx/sites-enabled/
# =============================================================================

# Rate limit zone
limit_req_zone $binary_remote_addr zone=ciim_api:10m rate=30r/s;

# ---------- HTTP → HTTPS redirect ----------
server {
    listen 80;
    listen [::]:80;
    server_name ciim.prashanthhospitals.com;

    # Certbot renewal
    location /.well-known/acme-challenge/ {
        root /var/www/certbot;
    }

    location / {
        return 301 https://$host$request_uri;
    }
}

# ---------- HTTPS ----------
server {
    listen 443 ssl;
    listen [::]:443 ssl;
    http2 on;
    server_name ciim.prashanthhospitals.com;

    # TLS — certbot will populate these
    ssl_certificate     /etc/letsencrypt/live/ciim.prashanthhospitals.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/ciim.prashanthhospitals.com/privkey.pem;
    ssl_protocols       TLSv1.2 TLSv1.3;
    ssl_ciphers         ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256:ECDHE-ECDSA-AES256-GCM-SHA384:ECDHE-RSA-AES256-GCM-SHA384;
    ssl_prefer_server_ciphers off;
    ssl_session_cache   shared:CIIM_SSL:10m;
    ssl_session_timeout 1d;
    ssl_stapling        on;
    ssl_stapling_verify on;

    # Security headers
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
    add_header X-Content-Type-Options    "nosniff" always;
    add_header X-Frame-Options           "SAMEORIGIN" always;
    add_header Referrer-Policy           "strict-origin-when-cross-origin" always;

    client_max_body_size 12M;

    # Gzip
    gzip on;
    gzip_vary on;
    gzip_min_length 1024;
    gzip_proxied any;
    gzip_types text/plain text/css text/xml application/json application/javascript
               application/xml+rss image/svg+xml font/woff font/woff2;

    # Everything goes to the Docker web container on port 1008
    # (which internally proxies /api/ to the api container)
    location / {
        proxy_pass         http://127.0.0.1:1008;
        proxy_http_version 1.1;
        proxy_set_header   Upgrade           $http_upgrade;
        proxy_set_header   Connection        "upgrade";
        proxy_set_header   Host              $host;
        proxy_set_header   X-Real-IP         $remote_addr;
        proxy_set_header   X-Forwarded-For   $proxy_add_x_forwarded_for;
        proxy_set_header   X-Forwarded-Proto $scheme;

        proxy_connect_timeout 10s;
        proxy_send_timeout    60s;
        proxy_read_timeout    60s;
    }

    access_log /var/log/nginx/ciim.access.log;
    error_log  /var/log/nginx/ciim.error.log warn;
}
