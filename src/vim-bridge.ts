import { lookupByPath, getWorkDir } from './file-registry';
import { updateFile, createFile } from './drive';
import { setSaveStatus } from './status-bar';
import { register } from './file-registry';

let debounceTimer: ReturnType<typeof setTimeout> | null = null;
let currentFolderId = 'root';

export function setCurrentFolderId(id: string) {
  currentFolderId = id;
}

export function handleFileExport(fullpath: string, contents: ArrayBuffer) {
  // Debounce rapid saves
  if (debounceTimer) clearTimeout(debounceTimer);

  debounceTimer = setTimeout(() => {
    doSave(fullpath, contents);
  }, 500);
}

async function doSave(fullpath: string, contents: ArrayBuffer) {
  const decoder = new TextDecoder();
  const text = decoder.decode(contents);

  // Ignore vimrc saves
  if (fullpath.includes('.vimrc')) return;

  const entry = lookupByPath(fullpath);
  setSaveStatus('saving');

  try {
    if (entry) {
      // Update existing file
      await updateFile(entry.driveId, text);
    } else {
      // New file - create on Drive
      const workDir = getWorkDir();
      const name = fullpath.startsWith(workDir + '/')
        ? fullpath.substring(workDir.length + 1)
        : fullpath.split('/').pop() ?? 'untitled.txt';

      const driveFile = await createFile(name, currentFolderId, text);
      register(driveFile.id, driveFile.name, currentFolderId);
    }
    setSaveStatus('saved');
  } catch (err) {
    console.error('Save failed:', err);
    setSaveStatus('error', err instanceof Error ? err.message : 'Save failed');
  }
}
