import { homedir } from "os";
import { join } from "path";

// Base directories for opm
export const OPM_HOME = join(homedir(), ".opm");
export const ODIN_VERSIONS_DIR = join(OPM_HOME, "versions");
export const OPM_CACHE_DIR = join(OPM_HOME, "cache");
export const OPM_CONFIG_FILE = join(OPM_HOME, "config.json");

// Project-specific paths
export const PROJECT_CONFIG_FILE = "opm.json";
export const PACKAGES_DIR = "odin_packages";

// GitHub API endpoints
export const ODIN_REPO_API = "https://api.github.com/repos/odin-lang/Odin";
export const ODIN_RELEASES_API = `${ODIN_REPO_API}/releases`;

// Ensure directories exist
export async function ensureOpmDirs(): Promise<void> {
  await Bun.$`mkdir -p ${ODIN_VERSIONS_DIR} ${OPM_CACHE_DIR}`.quiet();
}

export function getVersionDir(version: string): string {
  return join(ODIN_VERSIONS_DIR, version);
}

export function getCurrentVersionLink(): string {
  return join(OPM_HOME, "current");
}
