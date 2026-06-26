# MVP Checklist — Catequesis San Pedro

Última revisión: 2026-06-22

## Estado general

**Estado:** funcionando como MVP local.

El flujo mínimo fue verificado de punta a punta sin ejecutar build:

1. Admin entra al sistema.
2. Admin crea catequista.
3. Admin crea grupo.
4. Catequista crea niño en un grupo asignado y obtiene código seguro.
5. Catequista crea actividad con pregunta/respuestas.
6. Niño entra con código.
7. Niño juega y guarda progreso.
8. Niño ve progreso individual.
9. Catequista descarga CSV.
10. Admin sube guía ZIP con PDF.
11. Catequista descarga guía.
12. Admin genera backup.
13. Admin revisa auditoría/sistema.

## Comandos de verificación usados

> Nota: `better-sqlite3` instalado está compilado para Node ABI 127. Para pruebas con SQLite se usó `/usr/local/bin/node` v22.12.0.

```bash
# Sintaxis JS propia
find src -type f -name '*.js' -print0 | xargs -0 -n1 /usr/local/bin/node --check

# Compilación de vistas EJS
/usr/local/bin/node -e "const ejs=require('ejs'), fs=require('fs'); const files=fs.readdirSync('src/views',{recursive:true}).filter(f=>String(f).endsWith('.ejs')).map(f=>'src/views/'+f); for (const f of files) ejs.compile(fs.readFileSync(f,'utf8'),{filename:f}); console.log('compiled views', files.length);"

# Migraciones
npm run migrate

# Seeds
npm run seed
```

No se ejecutó build porque el proyecto no tiene script de build y la regla del proyecto indica no build after changes.

## Variables de entorno necesarias

Archivo base: `.env.example`

```env
PORT=3000
NODE_ENV=development
SESSION_SECRET=change_me
DATABASE_PATH=./src/database/catequesis.sqlite
ADMIN_EMAIL=admin@sanpedro.local
ADMIN_PASSWORD=admin123
```

Recomendación mínima para entorno real:

- Cambiar `SESSION_SECRET`.
- Cambiar `ADMIN_EMAIL` y `ADMIN_PASSWORD` antes de seed inicial.
- Usar `NODE_ENV=production` para cookies `secure` si hay HTTPS.
- Respaldar `DATABASE_PATH` y carpeta `uploads/private`.

## Rutas principales verificadas

### Público / niño

- `GET /`
- `GET /acceso-nino`
- `POST /acceso-nino`
- `GET /perfil-nino`
- `GET /nino/actividades`
- `GET /nino/actividades/:id/jugar`
- `POST /nino/actividades/:id/responder`
- `GET /nino/progreso`
- `POST /salir-nino`

### Autenticación administrativa

- `GET /login`
- `POST /login`
- `POST /logout`
- `GET /dashboard`

### Admin

- `GET /admin/dashboard`
- `GET /admin/users`
- `GET /admin/users/new`
- `POST /admin/users`
- `GET /admin/users/:id/edit`
- `POST /admin/users/:id`
- `POST /admin/users/:id/deactivate`
- `GET /admin/groups`
- `GET /admin/groups/new`
- `POST /admin/groups`
- `GET /admin/groups/:id/edit`
- `POST /admin/groups/:id`
- `POST /admin/groups/:id/deactivate`
- `GET /admin/children`
- `GET /admin/children/new`
- `POST /admin/children`
- `GET /admin/children/:id/edit`
- `POST /admin/children/:id`
- `POST /admin/children/:id/deactivate`
- `POST /children/:id/regenerate-code`
- `GET /admin/activities`
- `GET /admin/activities/new`
- `POST /admin/activities`
- `GET /admin/activities/:id/edit`
- `POST /admin/activities/:id`
- `POST /admin/activities/:id/deactivate`
- `GET /admin/system`
- `GET /admin/backups`
- `POST /admin/backups`

### Catequista

- `GET /groups/my`
- `GET /children/my`
- `GET /children/my/new`
- `POST /children/my`
- `GET /progress/groups`
- `GET /reports/progress.csv`
- `GET /guides`
- `GET /guides/:id/download`

### Guías

- `GET /guides`
- `POST /guides` — admin/coordinador parroquial
- `GET /guides/:id/download`

## Checklist funcional

| Área | Estado | Evidencia |
| --- | --- | --- |
| Login admin | OK | Login con admin seed redirige a `/dashboard`. |
| CRUD usuarios administrativos | OK | Admin crea catequista con password hasheado. |
| CRUD grupos | OK | Admin crea grupo y asigna catequista. |
| CRUD niños | OK | Admin crea niño; catequista crea niño solo en sus grupos asignados y genera código seguro. |
| Acceso niño | OK | Niño entra con código y ve perfil. |
| CRUD actividades | OK | Catequista crea actividad con preguntas/respuestas para su nivel; admin también puede. |
| Juego niño | OK | Niño responde actividad. |
| Persistencia progreso | OK | Se crean `activity_attempts` y `question_attempts`. |
| Progreso individual | OK | Niño ve porcentaje, estrellas y actividades completadas. |
| Progreso grupal | OK | Catequista ve solo sus grupos; admin ve todo. |
| CSV progreso | OK | Exporta CSV filtrado por alcance. |
| Subida imágenes | OK | JPG/PNG/WebP, 3 MB, MIME + magic bytes, UUID. |
| Guías ZIP/PDF | OK | ZIP único con PDF válido, rutas peligrosas rechazadas. |
| Logs/auditoría | OK | `/admin/system`, `audit_logs`, `logs/app.log`. |
| Backup manual | OK | `db.backup()` crea `backups/catequesis_YYYY-MM-DD_HH-mm-ss.sqlite`. |
| Seguridad base | OK | Helmet, CSRF, rate limits, sesiones httpOnly. |
| Diseño responsive | OK | EJS + Bootstrap + tokens CSS mobile-first. |

## Seguridad revisada

- Passwords con bcrypt.
- Códigos de niño hasheados.
- Sesiones con `httpOnly`, `sameSite=lax`, `secure` solo en producción.
- CSRF aplicado a formularios administrativos.
- Rate limit en login/acceso niño/upload.
- Helmet activo con CSP.
- Subida de imágenes restringida por extensión, MIME, tamaño y magic bytes.
- ZIP de guía valida rutas internas para bloquear zip slip.
- PDFs de guías guardados fuera de público.
- Backups no se sirven estáticamente.
- Errores 500 no exponen stack traces al usuario.

## Pendientes / recomendaciones

### Alta prioridad antes de producción

- Cambiar secretos y credenciales seed.
- Definir política de backups fuera del servidor local.
- Configurar HTTPS si `NODE_ENV=production`.
- Revisar `npm audit`; hay vulnerabilidades low severity reportadas por npm.
- Agregar tests automatizados persistentes en el repo. Hoy las verificaciones fueron scripts temporales de revisión.

### Producto

- Implementar modelo real de zonas si `coordinador_zonal` debe tener alcance territorial.
- Agregar filtros/paginación en `/admin/system`.
- Agregar descarga protegida de backups si se requiere, con validación de path.
- Implementar restore solo con confirmación fuerte y validación de integridad.
- Agregar limpieza/garbage collection de imágenes reemplazadas y PDFs antiguos.

### UX

- Hacer QA visual en dispositivo real o DevTools 390px/768px/desktop.
- Agregar estados vacíos más específicos por módulo.
- Agregar mensajes de éxito/error consistentes en todas las pantallas.

## Resultado final

El MVP queda **funcionando** para uso local/controlado y cubre el flujo catequístico completo:

- administración
- catequistas
- niños
- actividades
- progreso
- reportes
- guías
- auditoría
- backups

No está listo para producción pública sin hardening operacional, secretos reales, HTTPS, política de backups externa y tests automatizados permanentes.
