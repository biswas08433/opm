import { log } from "../utils/logger";
import {
  ODIN_RELEASES_API,
  ODIN_VERSIONS_DIR,
  getVersionDir,
  getCurrentVersionLink,
  ensureOpmDirs,
  OPM_CACHE_DIR,
} from "../utils/paths";
import { loadGlobalConfig, saveGlobalConfig } from "../utils/config";
import { platform, arch } from "os";
import { basename } from "path";

interface GitHubRelease {
  tag_name: string;
  name: string;
  prerelease: boolean;
  draft: boolean;
  published_at: string;
  assets: {
    name: string;
    browser_download_url: string;
    size: number;
  }[];
}

// Detect the correct asset name for the current platform
function getAssetPattern(): string {
  const os = platform();
  const architecture = arch();

  if (os === "linux") {
    return architecture === "arm64" ? "odin-linux-arm64" : "odin-linux-amd64";
  } else if (os === "darwin") {
    return architecture === "arm64" ? "odin-macos-arm64" : "odin-macos-amd64";
  } else if (os === "win32") {
    return "odin-windows-amd64";
  }

  throw new Error(`Unsupported platform: ${os}/${architecture}`);
}

// Fetch all available Odin releases from GitHub
export async function fetchReleases(
  includePrerelease = false,
): Promise<GitHubRelease[]> {
  const response = await fetch(ODIN_RELEASES_API, {
    headers: {
      Accept: "application/vnd.github.v3+json",
      "User-Agent": "opm",
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch releases: ${response.statusText}`);
  }

  const releases: GitHubRelease[] = (await response.json()) as GitHubRelease[];

  return releases.filter(
    (r) => !r.draft && (includePrerelease || !r.prerelease),
  );
}

// List installed versions
export async function listInstalled(): Promise<string[]> {
  await ensureOpmDirs();
  const result =
    await Bun.$`ls -1 ${ODIN_VERSIONS_DIR} 2>/dev/null || true`.quiet();
  const output = result.stdout.toString().trim();
  if (!output) return [];
  return output.split("\n").filter(Boolean);
}

// Get currently active version
export async function getCurrentVersion(): Promise<string | null> {
  const linkPath = getCurrentVersionLink();
  try {
    const result = await Bun.$`readlink ${linkPath} 2>/dev/null`.quiet();
    const target = result.stdout.toString().trim();
    if (target) {
      return basename(target);
    }
  } catch {
    // Link doesn't exist
  }
  return null;
}

// List all versions (remote + installed)
export async function listVersions(): Promise<void> {
  log.header("Odin Compiler Versions");

  const spinner = log.spinner("Fetching available versions...");

  try {
    const [releases, installed, current] = await Promise.all([
      fetchReleases(true),
      listInstalled(),
      getCurrentVersion(),
    ]);
    spinner.stop();

    const installedSet = new Set(installed);

    console.log("  Available versions:\n");

    for (const release of releases.slice(0, 20)) {
      const version = release.tag_name;
      const isInstalled = installedSet.has(version);
      const isCurrent = version === current;

      let marker = "  ";
      if (isCurrent) marker = "→ ";
      else if (isInstalled) marker = "✓ ";

      const status = isCurrent
        ? "\x1b[32m(active)\x1b[0m"
        : isInstalled
          ? "\x1b[33m(installed)\x1b[0m"
          : "";

      console.log(`  ${marker}${version} ${status}`);
    }

    if (releases.length > 20) {
      log.dim(`\n  ... and ${releases.length - 20} more versions`);
    }
  } catch (error) {
    spinner.stop(false);
    throw error;
  }
}

// Install a specific version
export async function installVersion(version: string): Promise<void> {
  await ensureOpmDirs();

  // Resolve "latest" to actual version
  if (version === "latest") {
    const spinner = log.spinner("Fetching latest version...");
    const releases = await fetchReleases(false);
    if (releases.length === 0) {
      spinner.stop(false);
      throw new Error("No releases found");
    }
    version = releases[0]!.tag_name;
    spinner.stop();
    log.info(`Latest version is ${version}`);
  }

  const versionDir = getVersionDir(version);

  // Check if already installed
  const versionExists = await Bun.file(`${versionDir}/odin`).exists();
  if (versionExists) {
    log.success(`Version ${version} is already installed`);
    return;
  }

  // Find the release
  const spinner = log.spinner(`Finding release ${version}...`);
  const releases = await fetchReleases(true);
  const release = releases.find((r) => r.tag_name === version);

  if (!release) {
    spinner.stop(false);
    throw new Error(
      `Version ${version} not found. Use 'opm versions' to see available versions.`,
    );
  }

  // Find the right asset
  const pattern = getAssetPattern();
  const asset = release.assets.find(
    (a) =>
      a.name.includes(pattern) &&
      (a.name.endsWith(".zip") || a.name.endsWith(".tar.gz")),
  );

  if (!asset) {
    spinner.stop(false);
    throw new Error(`No compatible binary found for ${platform()}/${arch()}`);
  }

  spinner.stop();

  // Download the asset with progress
  const downloadPath = `${OPM_CACHE_DIR}/${asset.name}`;
  const totalSize = asset.size;
  const totalMB = (totalSize / 1024 / 1024).toFixed(1);

  const response = await fetch(asset.browser_download_url);
  if (!response.ok) {
    throw new Error(`Failed to download: ${response.statusText}`);
  }

  const reader = response.body?.getReader();
  if (!reader) {
    throw new Error("Failed to get response body reader");
  }

  let receivedBytes = 0;
  const chunks: Uint8Array[] = [];

  process.stdout.write(
    `\x1b[36m⠋\x1b[0m Downloading ${asset.name} (0% of ${totalMB} MB)`,
  );

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    chunks.push(value);
    receivedBytes += value.length;

    const percent = Math.round((receivedBytes / totalSize) * 100);
    const receivedMB = (receivedBytes / 1024 / 1024).toFixed(1);
    process.stdout.write(
      `\r\x1b[36m⠋\x1b[0m Downloading ${asset.name} (${percent}% - ${receivedMB}/${totalMB} MB)  `,
    );
  }

  process.stdout.write(
    `\r\x1b[32m✓\x1b[0m Downloaded ${asset.name} (${totalMB} MB)                    \n`,
  );

  // Combine chunks and write to file
  const allChunks = new Uint8Array(receivedBytes);
  let position = 0;
  for (const chunk of chunks) {
    allChunks.set(chunk, position);
    position += chunk.length;
  }
  await Bun.write(downloadPath, allChunks);

  // Extract the archive
  const extractSpinner = log.spinner(`Extracting to ${versionDir}...`);
  await Bun.$`mkdir -p ${versionDir}`.quiet();

  if (asset.name.endsWith(".zip")) {
    await Bun.$`unzip -q -o ${downloadPath} -d ${versionDir}`.quiet();
    // Move contents from nested directory if exists
    const result = await Bun.$`ls ${versionDir}`.quiet();
    const contents = result.stdout.toString().trim().split("\n");
    if (contents.length === 1 && contents[0] && !contents[0].includes(".")) {
      await Bun.$`mv ${versionDir}/${contents[0]}/* ${versionDir}/ && rmdir ${versionDir}/${contents[0]}`.quiet();
    }
  } else {
    await Bun.$`tar -xzf ${downloadPath} -C ${versionDir} --strip-components=1`.quiet();
  }

  // Make odin executable
  await Bun.$`chmod +x ${versionDir}/odin 2>/dev/null || true`.quiet();

  extractSpinner.stop();

  // Cleanup download
  await Bun.$`rm -f ${downloadPath}`.quiet();

  log.success(`Installed Odin ${version}`);
  log.dim(`  Location: ${versionDir}`);
  log.info(`Run 'opm use ${version}' to activate this version`);
}

// Switch to a specific version
export async function useVersion(version: string): Promise<void> {
  const versionDir = getVersionDir(version);
  const linkPath = getCurrentVersionLink();

  // Check if version is installed
  const odinBinary = Bun.file(`${versionDir}/odin`);
  if (!(await odinBinary.exists())) {
    throw new Error(
      `Version ${version} is not installed. Run 'opm install ${version}' first.`,
    );
  }

  // Update symlink
  await Bun.$`rm -f ${linkPath} && ln -s ${versionDir} ${linkPath}`.quiet();

  // Update global config
  const config = await loadGlobalConfig();
  config.currentVersion = version;
  await saveGlobalConfig(config);

  log.success(`Now using Odin ${version}`);
  log.dim(`  Add '${linkPath}' to your PATH to use 'odin' command`);

  // Show shell config hint
  console.log();
  log.info("Add this to your shell config (~/.bashrc, ~/.zshrc, etc.):");
  console.log(`  export PATH="${linkPath}:\$PATH"`);
}

// Uninstall a version
export async function uninstallVersion(version: string): Promise<void> {
  const versionDir = getVersionDir(version);
  const current = await getCurrentVersion();

  // Check if version is installed
  if (!(await Bun.file(`${versionDir}/odin`).exists())) {
    throw new Error(`Version ${version} is not installed`);
  }

  if (version === current) {
    // Remove the symlink too
    await Bun.$`rm -f ${getCurrentVersionLink()}`.quiet();
    const config = await loadGlobalConfig();
    delete config.currentVersion;
    await saveGlobalConfig(config);
  }

  await Bun.$`rm -rf ${versionDir}`.quiet();
  log.success(`Uninstalled Odin ${version}`);
}

// Show current version info
export async function showCurrent(): Promise<void> {
  const current = await getCurrentVersion();
  const installed = await listInstalled();

  log.header("Odin Version Info");

  if (current) {
    log.success(`Active version: ${current}`);
    log.dim(`  Location: ${getVersionDir(current)}`);

    // Try to get actual version from odin
    try {
      const odinPath = `${getCurrentVersionLink()}/odin`;
      const result = await Bun.$`${odinPath} version 2>&1`.quiet().nothrow();
      if (result.exitCode === 0) {
        log.dim(`  ${result.stdout.toString().trim()}`);
      }
    } catch {
      // Ignore
    }
  } else {
    log.warn("No active version");
  }

  console.log();
  log.info(`Installed versions: ${installed.length}`);
  if (installed.length > 0) {
    log.list(installed);
  }
}
