import { initAuthRedirect, getClientId, getToken, signIn, getUserInfo, clearToken } from './auth';
import { startVim, resizeVim } from './editor';
import { initFileBrowser } from './file-browser';
import { getVimrc, setVimrc, getDefaultVimrc } from './vimrc';
import { setUser, clearStatus } from './status-bar';
import './styles.css';

// Handle OAuth redirect (if this window is the popup)
initAuthRedirect();

function init() {
  // Check for client ID
  const clientId = getClientId();
  if (!clientId) {
    showSetupGuide();
    return;
  }

  // Check for existing token
  const token = getToken();
  if (token) {
    showApp(token);
  } else {
    showSignIn();
  }
}

function showSetupGuide() {
  const el = document.getElementById('setup-guide')!;
  el.style.display = 'flex';
  el.innerHTML = `
    <div class="setup-container">
      <h1>VimDocs</h1>
      <p class="subtitle">A real Vim editor backed by Google Drive</p>

      <div class="setup-steps">
        <h2>Setup Required</h2>
        <p>To use VimDocs, you need a Google OAuth2 client ID. Follow these steps:</p>

        <ol>
          <li>Go to <a href="https://console.cloud.google.com" target="_blank">console.cloud.google.com</a> and create a new project (or select existing)</li>
          <li>Navigate to <strong>APIs &amp; Services → Library</strong> and enable the <strong>Google Drive API</strong></li>
          <li>Go to <strong>APIs &amp; Services → Credentials</strong></li>
          <li>Click <strong>Create Credentials → OAuth client ID</strong></li>
          <li>Select <strong>Web application</strong> as the type</li>
          <li>Add <code>${window.location.origin}</code> to <strong>Authorized JavaScript origins</strong></li>
          <li>Add <code>${window.location.origin}</code> to <strong>Authorized redirect URIs</strong></li>
          <li>Copy the Client ID</li>
          <li>Create a <code>.env</code> file in the project root:
            <pre>VITE_GOOGLE_CLIENT_ID=your-client-id-here.apps.googleusercontent.com</pre>
          </li>
          <li>Restart the dev server (<code>npm run dev</code>)</li>
        </ol>
      </div>
    </div>
  `;
}

function showSignIn() {
  const el = document.getElementById('sign-in-overlay')!;
  el.style.display = 'flex';
  el.innerHTML = `
    <div class="sign-in-container">
      <h1>VimDocs</h1>
      <p class="subtitle">A real Vim editor backed by Google Drive</p>
      <button id="sign-in-btn">Sign in with Google</button>
      <a class="privacy-link" href="/privacy.html">Privacy and Terms of Service</a>
    </div>
  `;

  document.getElementById('sign-in-btn')!.addEventListener('click', async () => {
    try {
      const token = await signIn();
      el.style.display = 'none';
      showApp(token);
    } catch (err) {
      console.error('Sign-in failed:', err);
      const errMsg = err instanceof Error ? err.message : 'Sign-in failed';
      const existing = el.querySelector('.sign-in-error');
      if (existing) existing.remove();
      const errEl = document.createElement('p');
      errEl.className = 'sign-in-error';
      errEl.textContent = errMsg;
      el.querySelector('.sign-in-container')!.appendChild(errEl);
    }
  });
}

async function showApp(token: string) {
  document.getElementById('setup-guide')!.style.display = 'none';
  document.getElementById('sign-in-overlay')!.style.display = 'none';
  document.getElementById('main-app')!.style.display = 'flex';

  // Load user info
  try {
    const user = await getUserInfo(token);
    setUser(user.email);
  } catch {
    setUser('');
  }

  // Initialize sidebar
  initFileBrowser();

  // Start vim with empty canvas (no file loaded yet)
  await startVim();

  // Sidebar toggle
  document.getElementById('sidebar-toggle')!.addEventListener('click', () => collapseSidebar());
  document.getElementById('sidebar-expand')!.addEventListener('click', () => expandSidebar());

  // Sign out
  document.getElementById('sign-out-btn')!.addEventListener('click', () => {
    clearToken();
    clearStatus();
    document.getElementById('main-app')!.style.display = 'none';
    showSignIn();
  });

  // Vimrc modal
  initVimrcModal();

  // Resize handling
  window.addEventListener('resize', resizeVim);
}

function collapseSidebar() {
  document.getElementById('sidebar')!.classList.add('collapsed');
  document.getElementById('sidebar-expand')!.style.display = 'flex';
  requestAnimationFrame(resizeVim);
}

function expandSidebar() {
  document.getElementById('sidebar')!.classList.remove('collapsed');
  document.getElementById('sidebar-expand')!.style.display = 'none';
  requestAnimationFrame(resizeVim);
}

function initVimrcModal() {
  const modal = document.getElementById('vimrc-modal')!;
  const editor = document.getElementById('vimrc-editor') as HTMLTextAreaElement;
  const closeBtn = document.getElementById('vimrc-close')!;
  const saveBtn = document.getElementById('vimrc-save')!;
  const openBtn = document.getElementById('vimrc-btn')!;

  openBtn.addEventListener('click', () => {
    editor.value = getVimrc();
    modal.style.display = 'flex';
    editor.focus();
  });

  closeBtn.addEventListener('click', () => {
    modal.style.display = 'none';
  });

  saveBtn.addEventListener('click', async () => {
    setVimrc(editor.value);
    modal.style.display = 'none';
    await startVim();
  });

  modal.addEventListener('click', (e) => {
    if (e.target === modal) modal.style.display = 'none';
  });

  void getDefaultVimrc;
}

// Boot
init();
