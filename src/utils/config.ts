import {
  OPM_CONFIG_FILE,
  PROJECT_CONFIG_FILE,
  LOCKFILE,
  ensureOpmDirs,
} from "./paths";

// Global OPM configuration
export interface OpmConfig {
  currentVersion?: string;
  defaultRegistry?: string;
  autoUpdate?: boolean;
}

// Lockfile entry for a single package
export interface LockfileEntry {
  specifier: string; // Original specifier from opm.json (e.g., "user/repo@v1.0.0")
  resolved: string; // Resolved URL (e.g., "https://github.com/user/repo")
  commit: string; // Exact commit hash
  integrity?: string; // Optional SHA256 hash of the content
}

// Lockfile structure (opm.lock)
export interface Lockfile {
  version: 1; // Lockfile format version
  packages: Record<string, LockfileEntry>; // package name -> entry
}

// Project configuration (opm.json)
export interface ProjectConfig {
  $schema?: string;
  name: string;
  version: string;
  description?: string;
  author?: string;
  license?: string;
  odinVersion?: string;
  collections?: Record<string, string>;
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  scripts?: Record<string, string>;
  build?: {
    src?: string;
    out?: string;
    flags?: string[];
  };
}

export async function loadGlobalConfig(): Promise<OpmConfig> {
  await ensureOpmDirs();
  const file = Bun.file(OPM_CONFIG_FILE);
  if (await file.exists()) {
    return await file.json();
  }
  return {};
}

export async function saveGlobalConfig(config: OpmConfig): Promise<void> {
  await ensureOpmDirs();
  await Bun.write(OPM_CONFIG_FILE, JSON.stringify(config, null, 2));
}

export async function loadProjectConfig(
  dir: string = process.cwd(),
): Promise<ProjectConfig | null> {
  const configPath = `${dir}/${PROJECT_CONFIG_FILE}`;
  const file = Bun.file(configPath);
  if (await file.exists()) {
    return await file.json();
  }
  return null;
}

export async function saveProjectConfig(
  config: ProjectConfig,
  dir: string = process.cwd(),
): Promise<void> {
  const configPath = `${dir}/${PROJECT_CONFIG_FILE}`;
  await Bun.write(configPath, JSON.stringify(config, null, 2));
}

export async function projectConfigExists(
  dir: string = process.cwd(),
): Promise<boolean> {
  const file = Bun.file(`${dir}/${PROJECT_CONFIG_FILE}`);
  return await file.exists();
}

// Lockfile functions
export async function loadLockfile(
  dir: string = process.cwd(),
): Promise<Lockfile> {
  const lockPath = `${dir}/${LOCKFILE}`;
  const file = Bun.file(lockPath);
  if (await file.exists()) {
    return await file.json();
  }
  return { version: 1, packages: {} };
}

export async function saveLockfile(
  lockfile: Lockfile,
  dir: string = process.cwd(),
): Promise<void> {
  const lockPath = `${dir}/${LOCKFILE}`;
  // Sort packages alphabetically for deterministic output
  const sortedPackages: Record<string, LockfileEntry> = {};
  for (const key of Object.keys(lockfile.packages).sort()) {
    sortedPackages[key] = lockfile.packages[key]!;
  }
  lockfile.packages = sortedPackages;
  await Bun.write(lockPath, JSON.stringify(lockfile, null, 2) + "\n");
}

export function getLockfileEntry(
  lockfile: Lockfile,
  name: string,
): LockfileEntry | undefined {
  return lockfile.packages[name];
}

export function setLockfileEntry(
  lockfile: Lockfile,
  name: string,
  entry: LockfileEntry,
): void {
  lockfile.packages[name] = entry;
}

export function removeLockfileEntry(lockfile: Lockfile, name: string): void {
  delete lockfile.packages[name];
}
