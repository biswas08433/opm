import { OPM_CONFIG_FILE, PROJECT_CONFIG_FILE, ensureOpmDirs } from "./paths";

// Global OPM configuration
export interface OpmConfig {
  currentVersion?: string;
  defaultRegistry?: string;
  autoUpdate?: boolean;
}

// Project configuration (opm.json)
export interface ProjectConfig {
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
