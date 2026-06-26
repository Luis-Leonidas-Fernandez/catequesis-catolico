document.addEventListener('DOMContentLoaded', () => {
  const splash = document.querySelector('[data-splash]');
  const loginVideo = document.querySelector('.login-bg-video');
  const loginModeButtons = document.querySelectorAll('[data-login-mode]');
  const loginPanels = document.querySelectorAll('[data-login-panel]');
  const loginTitle = document.querySelector('[data-login-title]');
  const loginSubtitle = document.querySelector('[data-login-subtitle]');
  const routeBackButton = document.querySelector('[data-route-back]');


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
