# Deploy en DigitalOcean

Este proyecto puede levantarse en un droplet Ubuntu usando el script:

```bash
cd /ruta/al/proyecto/san-pedro
sudo PROJECT_DIR="$(pwd)" APP_BASE_URL="https://tu-dominio.com" ./scripts/setup-digitalocean.sh
```

## Qué instala

- Actualizaciones del sistema con `apt-get update` y `apt-get upgrade`.
- Dependencias del sistema para módulos nativos Node/SQLite.
- Node.js si no está instalado.
- Ghostscript para optimizar PDFs antes de subir guías.
- Dependencias npm en modo producción.
- `.env` si no existe.
- Migraciones y seeds.
- Servicio `systemd` para levantar la app automáticamente.

## Variables útiles

Podés configurar el script con variables de entorno:

```bash
sudo \
  PROJECT_DIR="/var/www/san-pedro" \
  APP_USER="www-data" \
  APP_BASE_URL="https://catequesis.tudominio.com" \
  PORT="3000" \
  NODE_MAJOR="22" \
  RUN_SEED="true" \
  RUN_MEDIA_MIGRATION="false" \
  ./scripts/setup-digitalocean.sh
```

| Variable | Default | Uso |
| --- | --- | --- |
| `PROJECT_DIR` | directorio actual | Ruta del proyecto en el droplet. |
| `APP_USER` | usuario sudo actual | Usuario Linux que ejecutará el servicio. |
| `APP_BASE_URL` | `http://localhost:3000` | URL pública de la app. |
| `PORT` | `3000` | Puerto interno Express. |
| `NODE_MAJOR` | `22` | Versión mayor de Node a instalar si falta. |
| `RUN_APT_UPGRADE` | `true` | Ejecuta upgrade del sistema. |
| `RUN_SEED` | `true` | Ejecuta seeds idempotentes. |
| `RUN_MEDIA_MIGRATION` | `false` | Migra archivos locales a Cloudinary. |
| `ENABLE_SYSTEMD` | `true` | Crea servicio systemd. |
| `START_SERVICE` | `true` | Reinicia el servicio al final. |

## Después del setup

Editá `.env` y completá secretos reales:

```bash
sudo nano /ruta/al/proyecto/san-pedro/.env
```

Revisá especialmente:

```env
SESSION_SECRET=...
ADMIN_EMAIL=...
ADMIN_PASSWORD=...
APP_BASE_URL=https://tu-dominio.com
TRUST_PROXY=true
SMTP_HOST=...
SMTP_USER=...
SMTP_PASS=...
CLOUDINARY_CLOUD_NAME=...
CLOUDINARY_API_KEY=...
CLOUDINARY_API_SECRET=...
GHOSTSCRIPT_PATH=/usr/bin/gs
```

La app lee `.env` con `dotenv` desde el directorio del proyecto; el servicio systemd no parsea `.env`, para evitar problemas con valores que contienen espacios.

Luego reiniciá:

```bash
sudo systemctl restart catequesis-san-pedro
sudo journalctl -u catequesis-san-pedro -f
```

## Verificación

```bash
curl -I http://127.0.0.1:3000/health/db
systemctl status catequesis-san-pedro
```

## Nota sobre Nginx/HTTPS

Este script levanta Express con systemd. Para producción real, lo recomendable es poner Nginx/Caddy delante con HTTPS y proxy hacia `127.0.0.1:3000`.

Ejemplo conceptual Nginx:

```nginx
server {
  listen 80;
  server_name catequesis.tudominio.com;

  location / {
    proxy_pass http://127.0.0.1:3000;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
  }
}
```
