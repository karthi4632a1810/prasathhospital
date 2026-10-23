# =============================================================================
# NGINX — CIIM 2026 Admin Dashboard
# Host-level reverse proxy → Docker container on port 1009
#
# Place at /etc/nginx/sites-available/ciimadmin.prashanthhospitals.com
# Symlink: ln -s /etc/nginx/sites-available/ciimadmin.prashanthhospitals.com /etc/nginx/sites-enabled/
# =============================================================================

# ---------- HTTP → HTTPS redirect ----------
server {
    listen 80;
    listen [::]:80;
    server_name ciimadmin.prashanthhospitals.com;

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
    server_name ciimadmin.prashanthhospitals.com;

    ssl_certificate     /etc/letsencrypt/live/ciimadmin.prashanthhospitals.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/ciimadmin.prashanthhospitals.com/privkey.pem;
    ssl_protocols       TLSv1.2 TLSv1.3;
    ssl_ciphers         ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256:ECDHE-ECDSA-AES256-GCM-SHA384:ECDHE-RSA-AES256-GCM-SHA384;
    ssl_prefer_server_ciphers off;
    ssl_session_cache   shared:CIIM_ADMIN_SSL:10m;
    ssl_session_timeout 1d;
    ssl_stapling        on;
    ssl_stapling_verify on;

    # Security headers
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
    add_header X-Content-Type-Options    "nosniff" always;
    add_header X-Frame-Options           "SAMEORIGIN" always;
    add_header X-Robots-Tag              "noindex, nofollow" always;

    client_max_body_size 12M;

    gzip on;
    gzip_vary on;
    gzip_min_length 1024;
    gzip_proxied any;
    gzip_types text/plain text/css text/xml application/json application/javascript
               application/xml+rss image/svg+xml font/woff font/woff2;

    # Everything goes to the Docker admin container on port 1009
    location / {
        proxy_pass         http://127.0.0.1:1009;
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

    access_log /var/log/nginx/ciimadmin.access.log;
    error_log  /var/log/nginx/ciimadmin.error.log warn;
}
