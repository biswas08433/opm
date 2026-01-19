import { log } from "../utils/logger";
import { loadProjectConfig, saveProjectConfig } from "../utils/config";
import {
  PACKAGES_DIR,
  PROJECT_CONFIG_FILE,
  OPM_CACHE_DIR,
} from "../utils/paths";

interface PackageSource {
  type: "github" | "git" | "local";
  url: string;
  ref?: string; // branch, tag, or commit
  path?: string; // subpath within the repo
}

// Parse package specifier into source info
// Formats:
//   github:user/repo
//   github:user/repo@tag
//   github:user/repo#branch
//   git:https://example.com/repo.git
//   path:/local/path
//   user/repo (shorthand for github)
function parsePackageSpec(spec: string): {
  name: string;
  source: PackageSource;
} {
  // GitHub shorthand: user/repo or user/repo@version
  if (/^[\w-]+\/[\w-]+(@[\w.-]+)?(#[\w.-]+)?$/.test(spec)) {
    const [fullPath, ref] = spec.includes("@")
      ? spec.split("@")
      : spec.includes("#")
        ? spec.split("#")
        : [spec, undefined];

    const [user, repo] = fullPath.split("/");

    return {
      name: repo || "package",
      source: {
        type: "github",
        url: `https://github.com/${user}/${repo}`,
        ref: ref,
      },
    };
  }

  // Explicit type prefix
  if (spec.startsWith("github:")) {
    const rest = spec.slice(7);
    const [fullPath, ref] = rest.includes("@")
      ? rest.split("@")
      : rest.includes("#")
        ? rest.split("#")
        : [rest, undefined];

    const [user, repo] = fullPath.split("/");

    return {
      name: repo || "package",
      source: {
        type: "github",
        url: `https://github.com/${user}/${repo}`,
        ref: ref,
      },
    };
  }

  if (spec.startsWith("git:")) {
    const url = spec.slice(4);
    const name = url.split("/").pop()?.replace(".git", "") || "package";

    return {
      name,
      source: {
        type: "git",
        url,
      },
    };
  }

  if (spec.startsWith("path:")) {
    const path = spec.slice(5);
    const name = path.split("/").pop() || "package";

    return {
      name,
      source: {
        type: "local",
        url: path,
      },
    };
  }

  throw new Error(`Invalid package specifier: ${spec}`);
}

// Install a package
export async function addPackage(spec: string, isDev = false): Promise<void> {
  const config = await loadProjectConfig();

  if (!config) {
    throw new Error(`No ${PROJECT_CONFIG_FILE} found. Run 'opm init' first.`);
  }

  const { name, source } = parsePackageSpec(spec);
  const packageDir = `${PACKAGES_DIR}/${name}`;

  log.header(`Adding package: ${name}`);

  // Check if already installed
  const exists = await Bun.file(`${packageDir}/.git/config`).exists();
  if (exists) {
    log.info(`Package ${name} already exists, updating...`);
    await updatePackage(name);
    return;
  }

  const spinner = log.spinner(`Fetching ${name}...`);

  try {
    await Bun.$`mkdir -p ${PACKAGES_DIR}`.quiet();

    switch (source.type) {
      case "github":
      case "git": {
        const refArgs = source.ref ? ["--branch", source.ref] : [];
        await Bun.$`git clone --depth 1 ${refArgs} ${source.url} ${packageDir}`.quiet();
        break;
      }
      case "local": {
        await Bun.$`ln -s ${source.url} ${packageDir}`.quiet();
        break;
      }
    }

    spinner.stop();

    // Update project config
    const deps = isDev ? config.devDependencies : config.dependencies;
    const newDeps = { ...deps, [name]: spec };

    if (isDev) {
      config.devDependencies = newDeps;
    } else {
      config.dependencies = newDeps;
    }

    // Add to collections for Odin
    config.collections = config.collections || {};
    config.collections[name] = packageDir;

    await saveProjectConfig(config);

    log.success(
      `Added ${name} to ${isDev ? "devDependencies" : "dependencies"}`,
    );

    // Show usage hint
    console.log();
    log.info("Usage in your Odin code:");
    console.log(`  import "${name}:..."`);

    // Remind about collection flag
    console.log();
    log.dim(`Note: Run with -collection:${name}=${packageDir}`);
  } catch (error) {
    spinner.stop(false);
    throw error;
  }
}

// Remove a package
export async function removePackage(name: string): Promise<void> {
  const config = await loadProjectConfig();

  if (!config) {
    throw new Error(`No ${PROJECT_CONFIG_FILE} found.`);
  }

  const packageDir = `${PACKAGES_DIR}/${name}`;

  // Check if package exists
  const exists =
    (await Bun.file(`${packageDir}/.git/config`).exists()) ||
    (await Bun.$`test -L ${packageDir}`
      .quiet()
      .nothrow()
      .then((r) => r.exitCode === 0));

  if (!exists) {
    throw new Error(`Package ${name} is not installed`);
  }

  const spinner = log.spinner(`Removing ${name}...`);

  await Bun.$`rm -rf ${packageDir}`.quiet();

  // Update project config
  if (config.dependencies?.[name]) {
    delete config.dependencies[name];
  }
  if (config.devDependencies?.[name]) {
    delete config.devDependencies[name];
  }
  if (config.collections?.[name]) {
    delete config.collections[name];
  }

  await saveProjectConfig(config);

  spinner.stop();
  log.success(`Removed ${name}`);
}

// Update a specific package or all packages
export async function updatePackage(name?: string): Promise<void> {
  const config = await loadProjectConfig();

  if (!config) {
    throw new Error(`No ${PROJECT_CONFIG_FILE} found.`);
  }

  const allDeps = {
    ...config.dependencies,
    ...config.devDependencies,
  };

  const packagesToUpdate = name ? { [name]: allDeps[name] } : allDeps;

  if (Object.keys(packagesToUpdate).length === 0) {
    log.info("No packages to update");
    return;
  }

  log.header("Updating packages");

  for (const [pkgName] of Object.entries(packagesToUpdate)) {
    const packageDir = `${PACKAGES_DIR}/${pkgName}`;
    const isGit = await Bun.file(`${packageDir}/.git/config`).exists();

    if (!isGit) {
      log.dim(`  Skipping ${pkgName} (not a git repo)`);
      continue;
    }

    const spinner = log.spinner(`Updating ${pkgName}...`);

    try {
      await Bun.$`cd ${packageDir} && git pull --ff-only`.quiet();
      spinner.stop();
    } catch {
      spinner.stop(false);
      log.warn(`  Failed to update ${pkgName}`);
    }
  }
}

// Install all dependencies from opm.json
export async function installPackages(): Promise<void> {
  const config = await loadProjectConfig();

  if (!config) {
    throw new Error(`No ${PROJECT_CONFIG_FILE} found.`);
  }

  const allDeps = {
    ...config.dependencies,
    ...config.devDependencies,
  };

  const depCount = Object.keys(allDeps).length;

  if (depCount === 0) {
    log.info("No dependencies to install");
    return;
  }

  log.header(`Installing ${depCount} package${depCount > 1 ? "s" : ""}`);

  for (const [name, spec] of Object.entries(allDeps)) {
    const packageDir = `${PACKAGES_DIR}/${name}`;
    const exists = await Bun.file(`${packageDir}/.git/config`).exists();

    if (exists) {
      log.dim(`  ${name} already installed`);
      continue;
    }

    try {
      const { source } = parsePackageSpec(spec);
      const spinner = log.spinner(`Installing ${name}...`);

      await Bun.$`mkdir -p ${PACKAGES_DIR}`.quiet();

      switch (source.type) {
        case "github":
        case "git": {
          const refArgs = source.ref ? ["--branch", source.ref] : [];
          await Bun.$`git clone --depth 1 ${refArgs} ${source.url} ${packageDir}`.quiet();
          break;
        }
        case "local": {
          await Bun.$`ln -s ${source.url} ${packageDir}`.quiet();
          break;
        }
      }

      // Update collections
      config.collections = config.collections || {};
      config.collections[name] = packageDir;

      spinner.stop();
    } catch (error) {
      log.error(`  Failed to install ${name}`);
    }
  }

  // Save updated collections
  await saveProjectConfig(config);

  log.success("All packages installed");
}

// List installed packages
export async function listPackages(): Promise<void> {
  const config = await loadProjectConfig();

  if (!config) {
    throw new Error(`No ${PROJECT_CONFIG_FILE} found.`);
  }

  log.header("Installed Packages");

  const deps = config.dependencies || {};
  const devDeps = config.devDependencies || {};

  if (Object.keys(deps).length === 0 && Object.keys(devDeps).length === 0) {
    log.info("No packages installed");
    return;
  }

  if (Object.keys(deps).length > 0) {
    log.info("Dependencies:");
    for (const [name, spec] of Object.entries(deps)) {
      const packageDir = `${PACKAGES_DIR}/${name}`;
      const installed = await Bun.file(`${packageDir}/.git/config`).exists();
      const status = installed ? "\x1b[32m✓\x1b[0m" : "\x1b[31m✗\x1b[0m";
      console.log(`  ${status} ${name} (${spec})`);
    }
  }

  if (Object.keys(devDeps).length > 0) {
    console.log();
    log.info("Dev Dependencies:");
    for (const [name, spec] of Object.entries(devDeps)) {
      const packageDir = `${PACKAGES_DIR}/${name}`;
      const installed = await Bun.file(`${packageDir}/.git/config`).exists();
      const status = installed ? "\x1b[32m✓\x1b[0m" : "\x1b[31m✗\x1b[0m";
      console.log(`  ${status} ${name} (${spec})`);
    }
  }
}

// Search for packages (searches GitHub)
export async function searchPackages(query: string): Promise<void> {
  log.header(`Searching for "${query}"`);

  const spinner = log.spinner("Searching GitHub...");

  try {
    const response = await fetch(
      `https://api.github.com/search/repositories?q=${encodeURIComponent(query + " language:odin")}&sort=stars&per_page=10`,
      {
        headers: {
          Accept: "application/vnd.github.v3+json",
          "User-Agent": "opm",
        },
      },
    );

    if (!response.ok) {
      spinner.stop(false);
      throw new Error(`GitHub API error: ${response.statusText}`);
    }

    const data = (await response.json()) as {
      items: Array<{
        full_name: string;
        description?: string;
        stargazers_count: number;
      }>;
    };
    spinner.stop();

    if (data.items.length === 0) {
      log.info("No packages found");
      return;
    }

    console.log();
    for (const repo of data.items) {
      console.log(`  \x1b[1m${repo.full_name}\x1b[0m`);
      if (repo.description) {
        console.log(`  \x1b[2m${repo.description}\x1b[0m`);
      }
      console.log(
        `  ⭐ ${repo.stargazers_count}  |  Install: opm add ${repo.full_name}`,
      );
      console.log();
    }
  } catch (error) {
    spinner.stop(false);
    throw error;
  }
}
