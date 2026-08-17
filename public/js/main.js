document.addEventListener('DOMContentLoaded', () => {
  const splash = document.querySelector('[data-splash]');
  const loginVideo = document.querySelector('.login-bg-video');
  const loginModeButtons = document.querySelectorAll('[data-login-mode]');
  const loginPanels = document.querySelectorAll('[data-login-panel]');
  const loginTitle = document.querySelector('[data-login-title]');
  const loginSubtitle = document.querySelector('[data-login-subtitle]');
  const routeBackButton = document.querySelector('[data-route-back]');
  const childGroupSelect = document.querySelector('[data-child-group-select]');
  const baptismalGuardians = document.querySelector('[data-baptismal-guardians]');
  const noteModal = document.querySelector('[data-note-modal-container]');
  const noteModalForm = document.querySelector('[data-note-modal-form]');
  const noteModalInput = document.querySelector('#child-note-modal-input');
  const noteModalChild = document.querySelector('[data-note-modal-child]');
  const noteModalTitle = document.querySelector('#child-note-modal-title');
  const noteModalActive = document.querySelector('[data-note-modal-active]');
  const noteModalHistory = document.querySelector('[data-note-history]');

  if (noteModal && noteModalForm && noteModalInput) {
    const openNoteModal = (button) => {
      noteModalForm.action = `${button.dataset.actionPrefix || '/children/'}${button.dataset.childId}/notes`;
      noteModalInput.value = '';
      noteModalActive.value = button.dataset.active || '0';
      noteModalChild.textContent = button.dataset.childName || '';
      noteModalTitle.textContent = 'Nueva nota';
      noteModalHistory.hidden = true;
      noteModalForm.hidden = false;
      noteModal.hidden = false;
      document.body.classList.add('note-modal-open');
      window.setTimeout(() => noteModalInput.focus(), 0);
    };

    const openNoteHistory = async (button) => {
      noteModalChild.textContent = button.dataset.childName || '';
      noteModalTitle.textContent = 'Notas de seguimiento';
      noteModalForm.hidden = true;
      noteModalHistory.hidden = false;
      noteModalHistory.innerHTML = '<p class="child-note-history__loading">Cargando notas...</p>';
      noteModal.hidden = false;
      document.body.classList.add('note-modal-open');

      try {
        const response = await fetch(`${button.dataset.actionPrefix || '/children/'}${button.dataset.childId}/notes`, {
          headers: { Accept: 'application/json' },
        });
        if (!response.ok) throw new Error('notes-request-failed');
        const payload = await response.json();
        noteModalHistory.replaceChildren();

        if (!payload.notes.length) {
          noteModalHistory.textContent = 'Todavía no hay notas registradas.';
          return;
        }

        payload.notes.forEach((note) => {
          const article = document.createElement('article');
          article.className = 'child-note-history__item';
          const meta = document.createElement('small');
          meta.textContent = `${note.created_at}${note.author_name ? ` · ${note.author_name}` : ''}`;
          const content = document.createElement('p');
          content.textContent = note.note;
          article.append(meta, content);
          noteModalHistory.appendChild(article);
        });
      } catch (error) {
        noteModalHistory.textContent = 'No se pudieron cargar las notas. Intentá nuevamente.';
      }
    };

    const closeNoteModal = () => {
      noteModal.hidden = true;
      document.body.classList.remove('note-modal-open');
    };

    document.querySelectorAll('[data-note-modal]').forEach((button) => {
      button.addEventListener('click', () => openNoteModal(button));
    });
    document.querySelectorAll('[data-notes-view]').forEach((button) => {
      button.addEventListener('click', () => openNoteHistory(button));
    });
    noteModal.querySelectorAll('[data-note-modal-close]').forEach((button) => {
      button.addEventListener('click', closeNoteModal);
    });
    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape' && !noteModal.hidden) closeNoteModal();
    });
  }

  if (childGroupSelect && baptismalGuardians) {
    const guardianInputs = baptismalGuardians.querySelectorAll('[data-baptismal-guardian-input]');

    const syncBaptismalFields = () => {
      const selected = childGroupSelect.options[childGroupSelect.selectedIndex];
      const isBaptismal = selected?.dataset.catechesisLevel === 'catequesis_bautismal';

      baptismalGuardians.hidden = !isBaptismal;
      guardianInputs.forEach((input) => {
        input.required = isBaptismal;
        if (!isBaptismal) input.value = '';
      });
    };

    childGroupSelect.addEventListener('change', syncBaptismalFields);
    syncBaptismalFields();
  }


  if (routeBackButton) {
    routeBackButton.addEventListener('click', () => {
      const fallbackUrl = routeBackButton.dataset.fallbackUrl || '/dashboard';

      if (window.history.length > 1) {
        window.history.back();
        return;
      }

      window.location.href = fallbackUrl;
    });
  }

  if (splash) {
    const loginUrl = splash.dataset.loginUrl || '/login';
    const imageUrl = splash.dataset.preloadImage || '';
    const minDelay = Number(splash.dataset.minDelay) || 900;
    const maxDelay = Number(splash.dataset.maxDelay) || 2500;
    const startedAt = Date.now();
    let redirectStarted = false;

    const goToLogin = () => {
      if (redirectStarted) {
        return;
      }

      redirectStarted = true;
      const elapsed = Date.now() - startedAt;
      const remaining = Math.max(0, minDelay - elapsed);

      window.setTimeout(() => {
        window.location.href = loginUrl;
      }, remaining);
    };

    const maxTimer = window.setTimeout(goToLogin, maxDelay);

    if (imageUrl) {
      const image = new Image();

      image.onload = () => {
        window.clearTimeout(maxTimer);
        goToLogin();
      };

      image.onerror = () => {
        window.clearTimeout(maxTimer);
        goToLogin();
      };

      image.src = imageUrl;
    } else {
      window.clearTimeout(maxTimer);
      goToLogin();
    }
  }

  if (loginModeButtons.length && loginPanels.length) {
    loginModeButtons.forEach((button) => {
      button.addEventListener('click', () => {
        const targetPanel = button.dataset.targetPanel;

        loginModeButtons.forEach((modeButton) => {
          const isActive = modeButton === button;
          modeButton.classList.toggle('is-active', isActive);
          modeButton.setAttribute('aria-pressed', String(isActive));
        });

        loginPanels.forEach((panel) => {
          const isActive = panel.dataset.loginPanel === targetPanel;
          panel.hidden = !isActive;
          panel.classList.toggle('is-active', isActive);
        });

        if (loginTitle && button.dataset.loginTitle) {
          loginTitle.textContent = button.dataset.loginTitle;
        }

        if (loginSubtitle && button.dataset.loginSubtitle) {
          loginSubtitle.textContent = button.dataset.loginSubtitle;
        }

        const activePanel = document.querySelector(`[data-login-panel="${targetPanel}"]`);
        const firstInput = activePanel?.querySelector('input:not([type="hidden"])');

        if (firstInput) {
          firstInput.focus();
        }
      });
    });
  }


  const submitForms = document.querySelectorAll('form[method="post"], form[method="POST"]');

  submitForms.forEach((form) => {
    form.addEventListener('submit', (event) => {
      if (form.dataset.submitting === 'true') {
        event.preventDefault();
        return;
      }

      if (typeof form.checkValidity === 'function' && !form.checkValidity()) {
        return;
      }

      form.dataset.submitting = 'true';
      form.setAttribute('aria-busy', 'true');

      const submitButtons = form.querySelectorAll('button[type="submit"], input[type="submit"]');

      submitButtons.forEach((button) => {
        const loadingText = button.dataset.loadingText || 'Procesando...';

        if (button.tagName === 'INPUT') {
          button.dataset.originalValue = button.value;
          button.value = loadingText;
        } else {
          button.dataset.originalHtml = button.innerHTML;
          button.innerHTML = `
            <span class="submit-loading-spinner" aria-hidden="true"></span>
            <span>${loadingText}</span>
          `;
        }

        button.disabled = true;
        button.classList.add('is-submitting');
      });
    });
  });

  if (loginVideo) {
    loginVideo.addEventListener('error', () => {
      loginVideo.classList.add('is-hidden');
    });
  }
});
