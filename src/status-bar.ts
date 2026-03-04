const fileEl = () => document.getElementById('status-file')!;
const saveEl = () => document.getElementById('status-save')!;
const userEl = () => document.getElementById('status-user')!;

let saveTimeout: ReturnType<typeof setTimeout> | null = null;

export function setCurrentFile(name: string) {
  fileEl().textContent = name;
}

export function setSaveStatus(status: 'saving' | 'saved' | 'error', message?: string) {
  const el = saveEl();
  if (saveTimeout) clearTimeout(saveTimeout);

  switch (status) {
    case 'saving':
      el.textContent = 'Saving...';
      el.className = 'status-saving';
      break;
    case 'saved':
      el.textContent = 'Saved';
      el.className = 'status-saved';
      saveTimeout = setTimeout(() => {
        el.textContent = '';
        el.className = '';
      }, 3000);
      break;
    case 'error':
      el.textContent = message ?? 'Save failed';
      el.className = 'status-error';
      saveTimeout = setTimeout(() => {
        el.textContent = '';
        el.className = '';
      }, 5000);
      break;
  }
}

export function setUser(email: string) {
  userEl().textContent = email;
}

export function clearStatus() {
  fileEl().textContent = '';
  saveEl().textContent = '';
  saveEl().className = '';
  userEl().textContent = '';
}
