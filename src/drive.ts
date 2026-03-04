import { getToken, clearToken } from './auth';

const API = 'https://www.googleapis.com/drive/v3';
const UPLOAD_API = 'https://www.googleapis.com/upload/drive/v3';

export interface DriveFile {
  id: string;
  name: string;
  mimeType: string;
  parents?: string[];
  size?: string;
  modifiedTime?: string;
}

async function driveRequest(url: string, init?: RequestInit): Promise<Response> {
  const token = getToken();
  if (!token) throw new Error('Not authenticated');

  const headers = new Headers(init?.headers);
  headers.set('Authorization', `Bearer ${token}`);

  const res = await fetch(url, { ...init, headers });
  if (res.status === 401) {
    clearToken();
    throw new Error('Token expired');
  }
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Drive API error ${res.status}: ${body}`);
  }
  return res;
}

export async function listFiles(folderId: string = 'root'): Promise<DriveFile[]> {
  const q = `'${folderId}' in parents and trashed = false`;
  const fields = 'files(id, name, mimeType, parents, size, modifiedTime)';
  const orderBy = 'folder,name';
  const params = new URLSearchParams({ q, fields, orderBy, pageSize: '100' });

  const res = await driveRequest(`${API}/files?${params}`);
  const data = await res.json();

  // Filter to folders + text-like files
  return (data.files as DriveFile[]).filter((f) => {
    if (f.mimeType === 'application/vnd.google-apps.folder') return true;
    return isTextFile(f);
  });
}

function isTextFile(file: DriveFile): boolean {
  const textMimes = [
    'text/',
    'application/json',
    'application/xml',
    'application/javascript',
    'application/x-yaml',
    'application/toml',
    'application/x-sh',
  ];
  if (textMimes.some((m) => file.mimeType.startsWith(m))) return true;

  // Also check extension
  const textExts = [
    '.txt', '.md', '.json', '.yaml', '.yml', '.toml', '.xml',
    '.html', '.css', '.js', '.ts', '.jsx', '.tsx', '.py', '.rb',
    '.rs', '.go', '.java', '.c', '.cpp', '.h', '.hpp', '.sh',
    '.bash', '.zsh', '.fish', '.vim', '.lua', '.sql', '.conf',
    '.cfg', '.ini', '.env', '.gitignore', '.dockerfile',
    '.makefile', '.cmake', '.gradle', '.swift', '.kt', '.scala',
    '.ex', '.exs', '.erl', '.hs', '.ml', '.r', '.csv', '.tsv',
    '.log', '.svg', '.tex', '.bib', '.org', '.rst', '.adoc',
  ];
  const name = file.name.toLowerCase();
  return textExts.some((ext) => name.endsWith(ext));
}

export async function readFile(fileId: string): Promise<string> {
  const res = await driveRequest(`${API}/files/${fileId}?alt=media`);
  return res.text();
}

export async function updateFile(fileId: string, content: string): Promise<void> {
  await driveRequest(`${UPLOAD_API}/files/${fileId}?uploadType=media`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'text/plain' },
    body: content,
  });
}

export async function createFile(
  name: string,
  folderId: string,
  content: string
): Promise<DriveFile> {
  const metadata = {
    name,
    parents: [folderId],
    mimeType: 'text/plain',
  };

  const boundary = '---vimdocs-boundary---';
  const body = [
    `--${boundary}`,
    'Content-Type: application/json; charset=UTF-8',
    '',
    JSON.stringify(metadata),
    `--${boundary}`,
    'Content-Type: text/plain',
    '',
    content,
    `--${boundary}--`,
  ].join('\r\n');

  const res = await driveRequest(`${UPLOAD_API}/files?uploadType=multipart`, {
    method: 'POST',
    headers: { 'Content-Type': `multipart/related; boundary=${boundary}` },
    body,
  });

  return res.json();
}

export function isFolder(file: DriveFile): boolean {
  return file.mimeType === 'application/vnd.google-apps.folder';
}
