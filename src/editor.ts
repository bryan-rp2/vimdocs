import { VimWasm } from 'vim-wasm';
import { getVimrc } from './vimrc';
import { handleFileExport } from './vim-bridge';
import { setCurrentFile } from './status-bar';
import { getWorkDir } from './file-registry';

let vim: VimWasm | null = null;
let started = false;

function getWorkerScriptPath(): string {
  // vim.js, vim.wasm, and vim.data are copied to public/vim-wasm/
  // They must be served from the same directory for emscripten to find them
  return '/vim-wasm/vim.js';
}

export function getVim(): VimWasm | null {
  return vim;
}

export function isVimStarted(): boolean {
  return started;
}

export async function startVim(
  initialFile?: { path: string; content: string }
): Promise<VimWasm> {
  const canvas = document.getElementById('vim-canvas') as HTMLCanvasElement;
  const input = document.getElementById('vim-input') as HTMLInputElement;

  // Clean up previous instance
  if (vim) {
    try { vim.cmdline('qall!'); } catch { /* ignore */ }
    vim = null;
    started = false;
  }

  const workerScriptPath = getWorkerScriptPath();

  vim = new VimWasm({
    canvas,
    input,
    workerScriptPath,
  });

  // Set up export callback for :w saves
  vim.onFileExport = (fullpath: string, contents: ArrayBuffer) => {
    handleFileExport(fullpath, contents);
  };

  vim.onVimInit = () => {
    started = true;
    resizeVim();
  };

  vim.onVimExit = () => {
    started = false;
  };

  vim.onError = (err: Error) => {
    console.error('Vim error:', err);
  };

  // Clipboard integration
  vim.readClipboard = async () => {
    try {
      return await navigator.clipboard.readText();
    } catch {
      return '';
    }
  };

  vim.onWriteClipboard = (text: string) => {
    navigator.clipboard.writeText(text).catch(() => {});
  };

  vim.onTitleUpdate = (title: string) => {
    const fileName = title.split('/').pop() ?? title;
    if (fileName) setCurrentFile(fileName);
  };

  // Build start options
  const files: Record<string, string> = {
    '/home/web_user/.vimrc': getVimrc(),
  };
  const dirs = [getWorkDir()];
  const cmdArgs: string[] = [];

  if (initialFile) {
    files[initialFile.path] = initialFile.content;
    cmdArgs.push(initialFile.path);
  }

  // Set canvas dimensions before starting so Vim renders at the right size
  const container = document.getElementById('editor-container')!;
  const statusBar = document.getElementById('status-bar')!;
  const width = container.clientWidth;
  const height = container.clientHeight - statusBar.offsetHeight;
  canvas.style.width = `${width}px`;
  canvas.style.height = `${height}px`;

  vim.start({
    files,
    dirs,
    cmdArgs: cmdArgs.length ? cmdArgs : undefined,
    clipboard: true,
  });

  return vim;
}

export function resizeVim() {
  if (!vim || !started) return;
  const container = document.getElementById('editor-container')!;
  const statusBar = document.getElementById('status-bar')!;
  const canvas = document.getElementById('vim-canvas') as HTMLCanvasElement;

  const width = container.clientWidth;
  const height = container.clientHeight - statusBar.offsetHeight;

  canvas.style.width = `${width}px`;
  canvas.style.height = `${height}px`;
  vim.resize(width, height);
}

export async function openFileInVim(path: string, content: string) {
  if (!vim) return;

  if (!started) {
    // First file - restart vim with this file
    await startVim({ path, content });
    return;
  }

  // Load file content into MEMFS and open it
  const encoder = new TextEncoder();
  const buffer = encoder.encode(content).buffer as ArrayBuffer;
  await vim.dropFile(path, buffer);
  await vim.cmdline(`edit ${path}`);
  setCurrentFile(path.split('/').pop() ?? path);
}

export async function switchToBuffer(path: string) {
  if (!vim || !started) return;
  await vim.cmdline(`buffer ${path}`);
  setCurrentFile(path.split('/').pop() ?? path);
}
