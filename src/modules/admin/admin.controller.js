const adminRepository = require('./admin.repository');
const escapeHtml = require('../../utils/escape-html');
const { getDashboardCardImageUrl } = require('../../utils/dashboard-media');

const adminCards = [
  {
    title: 'Usuarios',
    description: 'Gestionar usuarios administrativos del sistema.',
    href: '/admin/users',
  },
  {
    title: 'Invitaciones',
    description: 'Enviar tokens seguros para coordinadores.',
    href: '/admin/invitations',
  },
  {
    title: 'Niños',
    description: 'Acceso futuro al seguimiento de niños inscriptos.',
    href: '/admin/children',
  },
  {
    title: 'Grupos',
    description: 'Organizar grupos de catequesis.',
    href: '/admin/groups',
  },
  {
    title: 'Actividades',
    description: 'Preparar actividades y preguntas.',
    href: '/admin/activities',
  },
  {
    title: 'Guías',
    description: 'Administrar guías y materiales.',
    href: '/guides',
  },
  {
    title: 'Reportes',
    description: 'Ver progreso individual y grupal.',
    href: '/progress/groups',
  },
  {
    title: 'Sistema',
    description: 'Revisar configuración y estado general.',
    href: '/admin/system',
  },
  {
    title: 'Backups',
    description: 'Crear y revisar backups manuales de SQLite.',
    href: '/admin/backups',
  },
];

function showAdminDashboard(req, res) {
  return res.render('admin/dashboard', {
    title: 'Panel admin',
    user: res.locals.currentUser,
    cards: adminCards,
    counters: adminRepository.getAdminCounters(),
    dashboardCardImageUrl: getDashboardCardImageUrl(),
    csrfToken: res.locals.csrfToken,
    escapeHtml,
  });
}

module.exports = {
  showAdminDashboard,
};
