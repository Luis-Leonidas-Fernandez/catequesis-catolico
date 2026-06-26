#!/usr/bin/env bash
set -Eeuo pipefail

APP_NAME="${APP_NAME:-catequesis-san-pedro}"
SERVICE_NAME="${SERVICE_NAME:-catequesis-san-pedro}"
PROJECT_DIR="${PROJECT_DIR:-$(pwd)}"
NODE_MAJOR="${NODE_MAJOR:-22}"
PORT="${PORT:-3000}"
APP_BASE_URL="${APP_BASE_URL:-http://localhost:${PORT}}"
RUN_APT_UPGRADE="${RUN_APT_UPGRADE:-true}"
RUN_SEED="${RUN_SEED:-true}"
RUN_MEDIA_MIGRATION="${RUN_MEDIA_MIGRATION:-false}"
ENABLE_SYSTEMD="${ENABLE_SYSTEMD:-true}"
START_SERVICE="${START_SERVICE:-true}"
APP_USER="${APP_USER:-${SUDO_USER:-$(id -un)}}"
ENV_FILE="${ENV_FILE:-${PROJECT_DIR}/.env}"
ENV_EXAMPLE_FILE="${ENV_EXAMPLE_FILE:-${PROJECT_DIR}/.env.example}"

log() {
  printf '\033[1;36m[setup]\033[0m %s\n' "$*"
}

warn() {
  printf '\033[1;33m[setup][warn]\033[0m %s\n' "$*" >&2
}

fail() {
  printf '\033[1;31m[setup][error]\033[0m %s\n' "$*" >&2
  exit 1
}

need_sudo() {
  if [[ "$(id -u)" -eq 0 ]]; then
    "$@"
  else
    sudo "$@"
  fi
}

command_exists() {
  command -v "$1" >/dev/null 2>&1
}

require_project() {
  [[ -f "${PROJECT_DIR}/package.json" ]] || fail "No encontré package.json en PROJECT_DIR=${PROJECT_DIR}"
  [[ -f "${PROJECT_DIR}/src/server.js" ]] || fail "No encontré src/server.js en PROJECT_DIR=${PROJECT_DIR}"
}

install_system_packages() {
  log "Actualizando paquetes del sistema..."
  need_sudo apt-get update -y

  if [[ "${RUN_APT_UPGRADE}" == "true" ]]; then
    need_sudo env DEBIAN_FRONTEND=noninteractive apt-get upgrade -y
  fi

  log "Instalando dependencias del sistema y Ghostscript..."
  need_sudo env DEBIAN_FRONTEND=noninteractive apt-get install -y \
    ca-certificates \
    curl \
    git \
    build-essential \
    python3 \
    make \
    g++ \
    sqlite3 \
    ghostscript \
    openssl
}

install_node_if_needed() {
  if command_exists node && command_exists npm; then
    log "Node detectado: $(node -v)"
    return
  fi

  log "Node.js no está instalado. Instalando Node.js ${NODE_MAJOR}.x desde NodeSource..."
  curl -fsSL "https://deb.nodesource.com/setup_${NODE_MAJOR}.x" | need_sudo bash -
  need_sudo env DEBIAN_FRONTEND=noninteractive apt-get install -y nodejs
  log "Node instalado: $(node -v)"
}

generate_secret() {
  if command_exists openssl; then
    openssl rand -hex 48
  else
    node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
  fi
}

set_env_value() {
  local key="$1"
  local value="$2"
  local escaped_value

  escaped_value=$(printf '%s' "$value" | sed 's/[&|]/\\&/g')

  if grep -q "^${key}=" "${ENV_FILE}"; then
    sed -i "s|^${key}=.*|${key}=${escaped_value}|" "${ENV_FILE}"
  else
    printf '%s=%s\n' "${key}" "${value}" >> "${ENV_FILE}"
  fi
}

create_env_if_missing() {
  if [[ -f "${ENV_FILE}" ]]; then
    log ".env ya existe. No lo piso; solo completo valores operativos seguros."
  else
    log "Creando .env desde .env.example..."
    [[ -f "${ENV_EXAMPLE_FILE}" ]] || fail "No existe ${ENV_EXAMPLE_FILE}"
    cp "${ENV_EXAMPLE_FILE}" "${ENV_FILE}"
    chmod 600 "${ENV_FILE}"
  fi

  local ghostscript_path
  ghostscript_path="$(command -v gs || true)"

  set_env_value "NODE_ENV" "production"
  set_env_value "PORT" "${PORT}"
  set_env_value "APP_BASE_URL" "${APP_BASE_URL}"
  set_env_value "TRUST_PROXY" "true"
  set_env_value "GHOSTSCRIPT_PATH" "${ghostscript_path}"

  if grep -q '^SESSION_SECRET=\(change_me\)\?$' "${ENV_FILE}"; then
    set_env_value "SESSION_SECRET" "$(generate_secret)"
  fi

  if grep -q '^ADMIN_PASSWORD=admin123$' "${ENV_FILE}"; then
    warn "ADMIN_PASSWORD sigue con el default de desarrollo. Cambialo en ${ENV_FILE} antes de exponer producción."
  fi

  if grep -q '^CLOUDINARY_CLOUD_NAME=$' "${ENV_FILE}"; then
    warn "Cloudinary no está configurado. Completá CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY y CLOUDINARY_API_SECRET en ${ENV_FILE}."
  fi

  if [[ -z "${ghostscript_path}" ]]; then
    fail "Ghostscript se instaló pero no encuentro 'gs' en PATH. Configurá GHOSTSCRIPT_PATH manualmente."
  fi
}

prepare_directories() {
  log "Creando directorios persistentes..."
  mkdir -p \
    "${PROJECT_DIR}/logs" \
    "${PROJECT_DIR}/backups" \
    "${PROJECT_DIR}/private" \
    "${PROJECT_DIR}/uploads/tmp/guides" \
    "${PROJECT_DIR}/uploads/private/guides" \
    "${PROJECT_DIR}/uploads/public/images" \
    "${PROJECT_DIR}/src/database"

  if id "${APP_USER}" >/dev/null 2>&1; then
    need_sudo chown -R "${APP_USER}:${APP_USER}" \
      "${PROJECT_DIR}/logs" \
      "${PROJECT_DIR}/backups" \
      "${PROJECT_DIR}/private" \
      "${PROJECT_DIR}/uploads" \
      "${PROJECT_DIR}/src/database"
  else
    warn "APP_USER=${APP_USER} no existe; omito chown."
  fi
}

install_node_dependencies() {
  log "Instalando dependencias npm..."
  cd "${PROJECT_DIR}"

  if [[ -f package-lock.json ]]; then
    npm ci --omit=dev
  else
    npm install --omit=dev
  fi
}

run_database_tasks() {
  cd "${PROJECT_DIR}"

  log "Ejecutando migraciones..."
  npm run migrate

  if [[ "${RUN_SEED}" == "true" ]]; then
    log "Ejecutando seeds idempotentes..."
    npm run seed
  fi

  if [[ "${RUN_MEDIA_MIGRATION}" == "true" ]]; then
    log "Migrando archivos locales a Cloudinary..."
    npm run migrate:media
  fi
}

write_systemd_service() {
  [[ "${ENABLE_SYSTEMD}" == "true" ]] || return

  local node_bin
  node_bin="$(command -v node)"

  log "Creando servicio systemd ${SERVICE_NAME}.service..."
  local service_file="/etc/systemd/system/${SERVICE_NAME}.service"
  local tmp_service
  tmp_service="$(mktemp)"

  cat > "${tmp_service}" <<SERVICE
[Unit]
Description=${APP_NAME}
After=network.target

[Service]
Type=simple
User=${APP_USER}
WorkingDirectory=${PROJECT_DIR}
ExecStart=${node_bin} ${PROJECT_DIR}/src/server.js
Restart=always
RestartSec=5
KillSignal=SIGINT
TimeoutStopSec=30
SyslogIdentifier=${SERVICE_NAME}

# Hardening básico sin romper SQLite/uploads locales
NoNewPrivileges=true
PrivateTmp=true
ProtectSystem=full
ReadWritePaths=${PROJECT_DIR}

[Install]
WantedBy=multi-user.target
SERVICE

  need_sudo mv "${tmp_service}" "${service_file}"
  need_sudo chmod 644 "${service_file}"
  need_sudo systemctl daemon-reload
  need_sudo systemctl enable "${SERVICE_NAME}.service"

  if [[ "${START_SERVICE}" == "true" ]]; then
    need_sudo systemctl restart "${SERVICE_NAME}.service"
  fi
}

print_status() {
  log "Verificando instalación..."
  printf 'Node: %s\n' "$(node -v)"
  printf 'npm: %s\n' "$(npm -v)"
  printf 'Ghostscript: %s\n' "$(gs --version)"
  printf 'Proyecto: %s\n' "${PROJECT_DIR}"
  printf '.env: %s\n' "${ENV_FILE}"

  if [[ "${ENABLE_SYSTEMD}" == "true" ]]; then
    need_sudo systemctl --no-pager --full status "${SERVICE_NAME}.service" || true
    printf '\nLogs:\n  sudo journalctl -u %s -f\n' "${SERVICE_NAME}"
  fi

  printf '\nHealth local:\n  curl -I http://127.0.0.1:%s/health/db\n' "${PORT}"
}

main() {
  require_project
  install_system_packages
  install_node_if_needed
  create_env_if_missing
  prepare_directories
  install_node_dependencies
  run_database_tasks
  write_systemd_service
  print_status

  log "Setup de DigitalOcean finalizado. Revisá ${ENV_FILE} antes de exponer el servidor públicamente."
}

main "$@"
