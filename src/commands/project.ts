import { log } from "../utils/logger";
import {
  loadProjectConfig,
  saveProjectConfig,
  projectConfigExists,
  type ProjectConfig,
} from "../utils/config";
import { PROJECT_CONFIG_FILE, getCurrentVersionLink } from "../utils/paths";
import { getCurrentVersion } from "./version";
import { basename } from "path";

// Initialize a new Odin project
export async function initProject(name?: string): Promise<void> {
  const cwd = process.cwd();
  const projectName = name || basename(cwd);

  // Check if already initialized
  if (await projectConfigExists(cwd)) {
    throw new Error(`Project already initialized. See ${PROJECT_CONFIG_FILE}`);
  }

  log.header(`Creating new Odin project: ${projectName}`);

  // Get current Odin version if available
  const currentVersion = await getCurrentVersion();

  const config: ProjectConfig = {
    name: projectName,
    version: "0.1.0",
    description: "",
    author: "",
    license: "MIT",
    odinVersion: currentVersion || undefined,
    collections: {},
    dependencies: {},
    devDependencies: {},
    scripts: {
      build: "odin build src -out:bin/${name}",
      run: "odin run src",
      test: "odin test tests",
      check: "odin check src",
    },
    build: {
      src: "src",
      out: "bin",
      flags: [],
    },
  };

  // Save project config
  await saveProjectConfig(config, cwd);

  // Create directory structure
  await Bun.$`mkdir -p src bin tests`.quiet();

  // Create a basic main.odin file
  const mainFile = Bun.file(`${cwd}/src/main.odin`);
  if (!(await mainFile.exists())) {
    await Bun.write(
      mainFile,
      `package main

import "core:fmt"

main :: proc() {
    fmt.println("Hello, ${projectName}!")
}
`,
    );
  }

  // Create .gitignore
  const gitignore = Bun.file(`${cwd}/.gitignore`);
  if (!(await gitignore.exists())) {
    await Bun.write(
      gitignore,
      `# Build output
bin/
*.o
*.obj
*.exe

# Odin packages
odin_packages/

# OS files
.DS_Store
Thumbs.db

# IDE
.vscode/
.idea/
*.swp
*.swo
`,
    );
  }

  log.success(`Created ${PROJECT_CONFIG_FILE}`);
  log.success("Created project structure");

  console.log();
  log.info("Project structure:");
  console.log("  ├── src/");
  console.log("  │   └── main.odin");
  console.log("  ├── bin/");
  console.log("  ├── tests/");
  console.log("  ├── .gitignore");
  console.log(`  └── ${PROJECT_CONFIG_FILE}`);

  console.log();
  log.info("Get started:");
  console.log("  opm run        # Run the project");
  console.log("  opm build      # Build the project");
  console.log("  opm add <pkg>  # Add a dependency");
}

// Show project info
export async function showProject(): Promise<void> {
  const config = await loadProjectConfig();

  if (!config) {
    throw new Error(
      `No ${PROJECT_CONFIG_FILE} found. Run 'opm init' to create one.`,
    );
  }

  log.header(`Project: ${config.name}`);

  log.table([
    ["Name", config.name],
    ["Version", config.version],
    ["Description", config.description || "(none)"],
    ["Author", config.author || "(none)"],
    ["License", config.license || "(none)"],
    ["Odin Version", config.odinVersion || "(any)"],
  ]);

  if (config.dependencies && Object.keys(config.dependencies).length > 0) {
    console.log();
    log.info("Dependencies:");
    log.table(Object.entries(config.dependencies));
  }

  if (
    config.devDependencies &&
    Object.keys(config.devDependencies).length > 0
  ) {
    console.log();
    log.info("Dev Dependencies:");
    log.table(Object.entries(config.devDependencies));
  }

  if (config.scripts && Object.keys(config.scripts).length > 0) {
    console.log();
    log.info("Scripts:");
    log.table(Object.entries(config.scripts));
  }
}

// Run a project script
export async function runScript(
  scriptName: string,
  args: string[] = [],
): Promise<void> {
  const config = await loadProjectConfig();

  if (!config) {
    throw new Error(
      `No ${PROJECT_CONFIG_FILE} found. Run 'opm init' to create one.`,
    );
  }

  // Check for built-in commands first
  if (
    scriptName === "build" ||
    scriptName === "run" ||
    scriptName === "test" ||
    scriptName === "check"
  ) {
    await runOdinCommand(scriptName, config, args);
    return;
  }

  // Look for custom script
  const script = config.scripts?.[scriptName];

  if (!script) {
    throw new Error(
      `Script '${scriptName}' not found in ${PROJECT_CONFIG_FILE}`,
    );
  }

  log.info(`Running script: ${scriptName}`);
  log.dim(`  ${script}`);
  console.log();

  // Replace variables in script
  let command = script
    .replace(/\$\{name\}/g, config.name)
    .replace(/\$\{version\}/g, config.version);

  // Run the script
  const result = await Bun.$`bash -c ${command} ${args}`.nothrow();

  if (result.exitCode !== 0) {
    process.exit(result.exitCode);
  }
}

// Run odin commands directly
async function runOdinCommand(
  command: "build" | "run" | "test" | "check",
  config: ProjectConfig,
  args: string[],
): Promise<void> {
  const odinPath = `${getCurrentVersionLink()}/odin`;

  // Check if odin is available
  const odinExists = await Bun.file(odinPath).exists();
  let odinCommand = odinExists ? odinPath : "odin";

  const srcDir = config.build?.src || "src";
  const outDir = config.build?.out || "bin";
  const flags = config.build?.flags || [];

  let cmdArgs: string[] = [];

  switch (command) {
    case "build":
      await Bun.$`mkdir -p ${outDir}`.quiet();
      cmdArgs = [
        command,
        srcDir,
        `-out:${outDir}/${config.name}`,
        ...flags,
        ...args,
      ];
      break;
    case "run":
      cmdArgs = [command, srcDir, ...flags, ...args];
      break;
    case "test":
      cmdArgs = [command, "tests", ...flags, ...args];
      break;
    case "check":
      cmdArgs = [command, srcDir, ...flags, ...args];
      break;
  }

  log.info(`odin ${cmdArgs.join(" ")}`);
  console.log();

  const result = await Bun.$`${odinCommand} ${cmdArgs}`.nothrow();

  if (result.exitCode !== 0) {
    process.exit(result.exitCode);
  }
}

// Clean build artifacts
export async function cleanProject(): Promise<void> {
  const config = await loadProjectConfig();

  if (!config) {
    throw new Error(`No ${PROJECT_CONFIG_FILE} found.`);
  }

  const outDir = config.build?.out || "bin";

  const spinner = log.spinner("Cleaning build artifacts...");
  await Bun.$`rm -rf ${outDir}/*`.quiet().nothrow();
  spinner.stop();

  log.success("Cleaned build artifacts");
}
