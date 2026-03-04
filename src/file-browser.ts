import { listFiles, readFile, isFolder, createFile, type DriveFile } from './drive';
import { register, lookupByDriveId } from './file-registry';
import { openFileInVim, switchToBuffer, isVimStarted } from './editor';
import { setCurrentFile } from './status-bar';
import { setCurrentFolderId } from './vim-bridge';

interface BreadcrumbEntry {
  id: string;
  name: string;
}

let currentFolderId = 'root';
let breadcrumbs: BreadcrumbEntry[] = [{ id: 'root', name: 'My Drive' }];
let onNewFileCreated: (() => void) | null = null;

export function initFileBrowser(opts?: { onRefresh?: () => void }) {
  onNewFileCreated = opts?.onRefresh ?? null;

  document.getElementById('new-file-btn')!.addEventListener('click', handleNewFile);

  loadFolder('root');
}

async function loadFolder(folderId: string) {
  currentFolderId = folderId;
  setCurrentFolderId(folderId);

  const fileList = document.getElementById('file-list')!;
  fileList.innerHTML = '<div class="loading">Loading...</div>';

  try {
    const files = await listFiles(folderId);
    renderFileList(files);
  } catch (err) {
    fileList.innerHTML = `<div class="error">Failed to load files: ${err instanceof Error ? err.message : 'Unknown error'}</div>`;
  }

  renderBreadcrumbs();
}

function renderBreadcrumbs() {
  const el = document.getElementById('breadcrumbs')!;
  el.innerHTML = '';

  breadcrumbs.forEach((crumb, i) => {
    if (i > 0) {
      const sep = document.createElement('span');
      sep.className = 'breadcrumb-sep';
      sep.textContent = ' / ';
      el.appendChild(sep);
    }

    const link = document.createElement('button');
    link.className = 'breadcrumb';
    link.textContent = crumb.name;
    link.addEventListener('click', () => {
      breadcrumbs = breadcrumbs.slice(0, i + 1);
      loadFolder(crumb.id);
    });
    el.appendChild(link);
  });
}

function renderFileList(files: DriveFile[]) {
  const el = document.getElementById('file-list')!;
  el.innerHTML = '';

  if (files.length === 0) {
    el.innerHTML = '<div class="empty">No files here</div>';
    return;
  }

  // Sort: folders first, then files alphabetically
  const sorted = [...files].sort((a, b) => {
    const aFolder = isFolder(a);
    const bFolder = isFolder(b);
    if (aFolder && !bFolder) return -1;
    if (!aFolder && bFolder) return 1;
    return a.name.localeCompare(b.name);
  });

  for (const file of sorted) {
    const item = document.createElement('button');
    item.className = 'file-item';

    const icon = document.createElement('span');
    icon.className = 'file-icon';
    icon.textContent = isFolder(file) ? '📁' : getFileIcon(file.name);

    const name = document.createElement('span');
    name.className = 'file-name';
    name.textContent = file.name;

    item.appendChild(icon);
    item.appendChild(name);

    if (isFolder(file)) {
      item.addEventListener('click', () => {
        breadcrumbs.push({ id: file.id, name: file.name });
        loadFolder(file.id);
      });
    } else {
      item.addEventListener('click', () => handleFileClick(file));
    }

    el.appendChild(item);
  }
}

async function handleFileClick(file: DriveFile) {
  const existingPath = lookupByDriveId(file.id);
  if (existingPath && isVimStarted()) {
    // Already open, just switch buffer
    await switchToBuffer(existingPath);
    setCurrentFile(file.name);
    return;
  }

  const fileList = document.getElementById('file-list')!;
  const items = fileList.querySelectorAll('.file-item');
  items.forEach((el) => el.classList.remove('active'));

  // Find and highlight the clicked item
  const clickedItem = Array.from(items).find(
    (el) => el.querySelector('.file-name')?.textContent === file.name
  );
  clickedItem?.classList.add('active');

  try {
    setCurrentFile(`Loading ${file.name}...`);

    // Check file size first
    const content = await readFile(file.id);
    if (content.length > 1_000_000) {
      if (!confirm(`${file.name} is ${(content.length / 1_000_000).toFixed(1)}MB. Open anyway?`)) {
        setCurrentFile('');
        return;
      }
    }

    const memfsPath = register(file.id, file.name, currentFolderId);
    await openFileInVim(memfsPath, content);
    setCurrentFile(file.name);
  } catch (err) {
    console.error('Failed to open file:', err);
    setCurrentFile('Error opening file');
  }
}

async function handleNewFile() {
  const name = prompt('New file name:');
  if (!name) return;

  try {
    const driveFile = await createFile(name, currentFolderId, '');
    register(driveFile.id, driveFile.name, currentFolderId);
    await loadFolder(currentFolderId);
    if (onNewFileCreated) onNewFileCreated();
  } catch (err) {
    console.error('Failed to create file:', err);
    alert(`Failed to create file: ${err instanceof Error ? err.message : 'Unknown error'}`);
  }
}

function getFileIcon(name: string): string {
  const ext = name.split('.').pop()?.toLowerCase();
  switch (ext) {
    case 'md': return '📝';
    case 'json': return '📋';
    case 'ts':
    case 'tsx': return '🔷';
    case 'js':
    case 'jsx': return '🟡';
    case 'py': return '🐍';
    case 'rs': return '🦀';
    case 'go': return '🔵';
    case 'html': return '🌐';
    case 'css': return '🎨';
    case 'sh':
    case 'bash': return '💻';
    default: return '📄';
  }
}

export function refreshCurrentFolder() {
  loadFolder(currentFolderId);
}
