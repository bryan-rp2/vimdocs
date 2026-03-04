interface RegistryEntry {
  driveId: string;
  driveName: string;
  folderId: string;
}

const WORK_DIR = '/work';
const pathToEntry = new Map<string, RegistryEntry>();
const driveIdToPath = new Map<string, string>();

export function register(driveId: string, driveName: string, folderId: string): string {
  // Check if already registered
  const existing = driveIdToPath.get(driveId);
  if (existing) return existing;

  // Build path, handling collisions
  let memfsPath = `${WORK_DIR}/${driveName}`;
  let counter = 1;
  while (pathToEntry.has(memfsPath)) {
    const ext = driveName.lastIndexOf('.');
    if (ext > 0) {
      memfsPath = `${WORK_DIR}/${driveName.substring(0, ext)} (${counter})${driveName.substring(ext)}`;
    } else {
      memfsPath = `${WORK_DIR}/${driveName} (${counter})`;
    }
    counter++;
  }

  pathToEntry.set(memfsPath, { driveId, driveName, folderId });
  driveIdToPath.set(driveId, memfsPath);
  return memfsPath;
}

export function lookupByPath(path: string): RegistryEntry | undefined {
  return pathToEntry.get(path);
}

export function lookupByDriveId(driveId: string): string | undefined {
  return driveIdToPath.get(driveId);
}

export function unregister(path: string) {
  const entry = pathToEntry.get(path);
  if (entry) {
    driveIdToPath.delete(entry.driveId);
    pathToEntry.delete(path);
  }
}

export function getWorkDir(): string {
  return WORK_DIR;
}
