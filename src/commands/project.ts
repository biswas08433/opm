import { log } from "../utils/logger";
import {
  loadProjectConfig,
  saveProjectConfig,
  projectConfigExists,
  type ProjectConfig,
} from "../utils/config";
import { PROJECT_CONFIG_FILE, getCurrentVersionLink } from "../utils/paths";
import { getCurrentVersion } from "./version";
import { basename, join } from "path";
import { mkdir } from "fs/promises";

// Initialize a new Odin project
export async function initProject(name?: string): Promise<void> {
  let projectDir = process.cwd();
  let projectName: string;

  if (name) {
    // Create a new folder with the given name
    projectName = name;
    projectDir = join(process.cwd(), name);

    // Create the project directory
    await mkdir(projectDir, { recursive: true });
    log.info(`Created directory: ${name}/`);
  } else {
    // Use current directory
    projectName = basename(projectDir);
  }

  // Check if already initialized
  if (await projectConfigExists(projectDir)) {
    throw new Error(`Project already initialized. See ${PROJECT_CONFIG_FILE}`);
  }

  log.header(`Creating new Odin project: ${projectName}`);

  // Get current Odin version if available
  const currentVersion = await getCurrentVersion();

  const config: ProjectConfig = {
    $schema:
      "https://raw.githubusercontent.com/biswas08433/opm/main/schema/opm.schema.json",
    name: projectName,
    version: "0.1.0",
    description: "",
    author: "",
    license: "MIT",
    odinVersion: currentVersion || undefined,
    collections: {},
    dependencies: {},
    devDependencies: {},
    scripts: {},
    build: {
      src: "src",
      out: "bin",
      flags: [],
    },
  };

  // Save project config
  await saveProjectConfig(config, projectDir);

  // Create directory structure
  await mkdir(join(projectDir, "src"), { recursive: true });
  await mkdir(join(projectDir, "bin"), { recursive: true });
  await mkdir(join(projectDir, "tests"), { recursive: true });

  // Create a basic main.odin file
  const mainFile = Bun.file(join(projectDir, "src/main.odin"));
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
  const gitignore = Bun.file(join(projectDir, ".gitignore"));
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
  if (name) {
    console.log(`  cd ${name}`);
  }
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

// Reserved command names that are dynamically generated
const RESERVED_COMMANDS = ["build", "run", "test", "check"] as const;
type ReservedCommand = (typeof RESERVED_COMMANDS)[number];

// Generate command based on build config
function generateCommand(
  command: ReservedCommand,
  config: ProjectConfig,
): string {
  const src = config.build?.src || "src";
  const out = config.build?.out || "bin";
  const flags = config.build?.flags?.join(" ") || "";
  const name = config.name;

  switch (command) {
    case "build":
      return `odin build ${src} -out:${out}/${name}${flags ? " " + flags : ""}`;
    case "run":
      return `odin run ${src}${flags ? " " + flags : ""}`;
    case "test":
      return `odin test tests${flags ? " " + flags : ""}`;
    case "check":
      return `odin check ${src}${flags ? " " + flags : ""}`;
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

  let command: string;

  // Check if it's a reserved command
  if (RESERVED_COMMANDS.includes(scriptName as ReservedCommand)) {
    command = generateCommand(scriptName as ReservedCommand, config);

    // Create output directory for build command
    if (scriptName === "build") {
      const outDir = config.build?.out || "bin";
      await Bun.$`mkdir -p ${outDir}`.quiet();
    }
  } else {
    // Look for user-defined script
    const script = config.scripts?.[scriptName];

    if (!script) {
      throw new Error(
        `Script '${scriptName}' not found in ${PROJECT_CONFIG_FILE}`,
      );
    }

    // Replace variables in user-defined scripts
    const variables: Record<string, string> = {
      name: config.name,
      version: config.version,
      src: config.build?.src || "src",
      out: config.build?.out || "bin",
    };

    command = script;
    for (const [key, value] of Object.entries(variables)) {
      command = command.replaceAll(`\${${key}}`, value);
    }
  }

  log.info(`Running: ${scriptName}`);
  log.dim(`  ${command}`);
  console.log();

  // Append extra args if provided
  const fullCommand =
    args.length > 0 ? `${command} ${args.join(" ")}` : command;

  // Run the command
  const result = await Bun.$`bash -c ${fullCommand}`
    .env({ ...process.env })
    .nothrow();

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
