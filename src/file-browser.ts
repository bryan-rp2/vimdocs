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

  renderDirHeader();
}

function renderDirHeader() {
  const el = document.getElementById('breadcrumbs')!;
  const currentName = breadcrumbs[breadcrumbs.length - 1].name;
  el.textContent = currentName + '/';
}

function goUp() {
  if (breadcrumbs.length <= 1) return;
  breadcrumbs.pop();
  loadFolder(breadcrumbs[breadcrumbs.length - 1].id);
}

function renderFileList(files: DriveFile[]) {
  const el = document.getElementById('file-list')!;
  el.innerHTML = '';

  // Table
  const table = document.createElement('table');
  table.className = 'dir-listing';

  // ".." entry to go up
  if (breadcrumbs.length > 1) {
    const tr = document.createElement('tr');
    tr.className = 'dir-entry dir-entry-up';
    tr.innerHTML = `<td class="dir-name" colspan="3"><button class="dir-link">..</button></td>`;
    tr.querySelector('button')!.addEventListener('click', goUp);
    table.appendChild(tr);
  }

  if (files.length === 0 && breadcrumbs.length <= 1) {
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
    const tr = document.createElement('tr');
    tr.className = 'dir-entry';

    const folder = isFolder(file);
    const displayName = folder ? file.name + '/' : file.name;
    const size = folder ? '-' : formatSize(file.size);
    const date = file.modifiedTime ? formatDate(file.modifiedTime) : '-';

    const tdName = document.createElement('td');
    tdName.className = 'dir-name';
    const btn = document.createElement('button');
    btn.className = folder ? 'dir-link dir-link-folder' : 'dir-link';
    btn.textContent = displayName;
    tdName.appendChild(btn);

    const tdSize = document.createElement('td');
    tdSize.className = 'dir-size';
    tdSize.textContent = size;

    const tdDate = document.createElement('td');
    tdDate.className = 'dir-date';
    tdDate.textContent = date;

    tr.appendChild(tdName);
    tr.appendChild(tdSize);
    tr.appendChild(tdDate);

    if (folder) {
      btn.addEventListener('click', () => {
        breadcrumbs.push({ id: file.id, name: file.name });
        loadFolder(file.id);
      });
    } else {
      btn.addEventListener('click', () => handleFileClick(file));
    }

    table.appendChild(tr);
  }

  el.appendChild(table);
}

function formatSize(sizeStr?: string): string {
  if (!sizeStr) return '-';
  const bytes = parseInt(sizeStr, 10);
  if (isNaN(bytes)) return '-';
  if (bytes < 1024) return bytes + 'B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + 'K';
  return (bytes / (1024 * 1024)).toFixed(1) + 'M';
}

function formatDate(isoStr: string): string {
  const d = new Date(isoStr);
  const now = new Date();
  const month = d.toLocaleString('en', { month: 'short' });
  const day = d.getDate();

  // Show time if same year, otherwise show year
  if (d.getFullYear() === now.getFullYear()) {
    const hours = String(d.getHours()).padStart(2, '0');
    const mins = String(d.getMinutes()).padStart(2, '0');
    return `${month} ${String(day).padStart(2, ' ')} ${hours}:${mins}`;
  }
  return `${month} ${String(day).padStart(2, ' ')}  ${d.getFullYear()}`;
}

async function handleFileClick(file: DriveFile) {
  const existingPath = lookupByDriveId(file.id);
  if (existingPath && isVimStarted()) {
    await switchToBuffer(existingPath);
    setCurrentFile(file.name);
    return;
  }

  // Highlight active row
  const fileList = document.getElementById('file-list')!;
  fileList.querySelectorAll('.dir-entry').forEach((el) => el.classList.remove('active'));
  const rows = fileList.querySelectorAll('.dir-entry');
  for (const row of rows) {
    const link = row.querySelector('.dir-link');
    if (link?.textContent === file.name) {
      row.classList.add('active');
      break;
    }
  }

  try {
    setCurrentFile(`Loading ${file.name}...`);

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

export function refreshCurrentFolder() {
  loadFolder(currentFolderId);
}
