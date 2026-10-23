# =============================================================================
# NGINX — CIIM 2026 Admin Dashboard
# Host-level reverse proxy → Docker container on port 1009
#
# Place at /etc/nginx/sites-available/ciimadmin.prashanthhospitals.com
# Symlink: ln -s /etc/nginx/sites-available/ciimadmin.prashanthhospitals.com /etc/nginx/sites-enabled/
# =============================================================================

server {
    listen 80;
    listen [::]:80;
    server_name ciimadmin.prashanthhospitals.com;

    client_max_body_size 12M;

    # Certbot challenge directory
    location /.well-known/acme-challenge/ {
        root /var/www/certbot;
    }

    # Proxy to Docker container on port 1009
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
