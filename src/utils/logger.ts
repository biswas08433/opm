// ANSI color codes for terminal output
const colors = {
  reset: "\x1b[0m",
  bold: "\x1b[1m",
  dim: "\x1b[2m",
  red: "\x1b[31m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  blue: "\x1b[34m",
  magenta: "\x1b[35m",
  cyan: "\x1b[36m",
  white: "\x1b[37m",
};

export const log = {
  info: (msg: string) => console.log(`${colors.blue}ℹ${colors.reset} ${msg}`),
  success: (msg: string) =>
    console.log(`${colors.green}✓${colors.reset} ${msg}`),
  warn: (msg: string) => console.log(`${colors.yellow}⚠${colors.reset} ${msg}`),
  error: (msg: string) => console.error(`${colors.red}✗${colors.reset} ${msg}`),
  dim: (msg: string) => console.log(`${colors.dim}${msg}${colors.reset}`),

  header: (msg: string) => {
    console.log();
    console.log(`${colors.bold}${colors.cyan}${msg}${colors.reset}`);
    console.log();
  },

  list: (items: string[]) => {
    items.forEach((item) =>
      console.log(`  ${colors.dim}•${colors.reset} ${item}`),
    );
  },

  table: (rows: [string, string][]) => {
    const maxKey = Math.max(...rows.map(([k]) => k.length));
    rows.forEach(([key, value]) => {
      console.log(
        `  ${colors.dim}${key.padEnd(maxKey)}${colors.reset}  ${value}`,
      );
    });
  },

  spinner: (msg: string) => {
    const frames = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"];
    let i = 0;
    process.stdout.write(`${colors.cyan}${frames[0]}${colors.reset} ${msg}`);

    const interval = setInterval(() => {
      i = (i + 1) % frames.length;
      process.stdout.write(
        `\r${colors.cyan}${frames[i]}${colors.reset} ${msg}`,
      );
    }, 80);

    return {
      stop: (success = true) => {
        clearInterval(interval);
        const icon = success
          ? `${colors.green}✓${colors.reset}`
          : `${colors.red}✗${colors.reset}`;
        process.stdout.write(`\r${icon} ${msg}\n`);
      },
      update: (newMsg: string) => {
        msg = newMsg;
      },
    };
  },
};
