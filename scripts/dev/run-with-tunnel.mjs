import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import readline from "node:readline";

const projectRoot = process.cwd();
const cloudflaredPath = "C:\\Users\\surya\\.fly\\bin\\cloudflared.exe";

console.log("\n========================================================");
console.log("🐉  Starting Dragon Router + Free Local Tunnel...");
console.log("========================================================\n");

// 1. Ensure .env exists and has required secrets
const envPath = path.join(projectRoot, ".env");
let envContent = "";
if (fs.existsSync(envPath)) {
  envContent = fs.readFileSync(envPath, "utf8");
} else {
  // If no .env, copy from .env.example
  const examplePath = path.join(projectRoot, ".env.example");
  if (fs.existsSync(examplePath)) {
    envContent = fs.readFileSync(examplePath, "utf8");
  }
}

// Check or generate secrets
let modified = false;
if (!envContent.includes("JWT_SECRET=") || envContent.match(/^JWT_SECRET=\s*$/m)) {
  const jwt = Buffer.from(Math.random().toString(36) + Math.random().toString(36)).toString("base64");
  envContent = envContent.replace(/^#?\s*JWT_SECRET=.*$/m, `JWT_SECRET=${jwt}`);
  modified = true;
}
if (!envContent.includes("API_KEY_SECRET=") || envContent.match(/^API_KEY_SECRET=\s*$/m)) {
  const apiKey = Array.from({ length: 64 }, () => Math.floor(Math.random() * 16).toString(16)).join("");
  envContent = envContent.replace(/^#?\s*API_KEY_SECRET=.*$/m, `API_KEY_SECRET=${apiKey}`);
  modified = true;
}
if (!envContent.includes("INITIAL_PASSWORD=") || envContent.match(/^INITIAL_PASSWORD=\s*$/m)) {
  envContent = envContent.replace(/^#?\s*INITIAL_PASSWORD=.*$/m, `INITIAL_PASSWORD=Dragon@12345`);
  modified = true;
}

if (modified || !fs.existsSync(envPath)) {
  fs.writeFileSync(envPath, envContent, "utf8");
  console.log("📝 Generated secure fallback secrets in your local .env file.");
}

// 2. Start next dev server
console.log("🚀 Launching local server (port 20128)...");
const serverProcess = spawn("node", ["--max-old-space-size=8192", "scripts/dev/run-next.mjs", "dev"], {
  cwd: projectRoot,
  stdio: "pipe",
  env: { ...process.env, NODE_ENV: "development" }
});

// Pipe server output to make debugging easy
serverProcess.stdout.on("data", (data) => {
  const line = data.toString().trim();
  if (line.includes("ready") || line.includes("started") || line.includes("Local:")) {
    console.log(`[Server] ${line}`);
  }
});
serverProcess.stderr.on("data", (data) => {
  console.error(`[Server Error] ${data.toString().trim()}`);
});

// 3. Start Cloudflare Tunnel
console.log("🌐 Initializing secure Cloudflare Tunnel...");
const tunnelProcess = spawn(cloudflaredPath, ["tunnel", "--url", "http://localhost:20128"], {
  cwd: projectRoot,
  stdio: "pipe"
});

const rl = readline.createInterface({
  input: tunnelProcess.stderr, // cloudflared writes logs to stderr
  console: false
});

let tunnelUrl = null;

rl.on("line", (line) => {
  if (line.includes(".trycloudflare.com")) {
    const match = line.match(/https:\/\/[a-z0-9-]+\.trycloudflare\.com/i);
    if (match) {
      tunnelUrl = match[0];
      console.log("\n========================================================");
      console.log("🎉  YOUR DRAGON ROUTER IS ONLINE!");
      console.log(`👉  Public Link: \x1b[36m\x1b[4m${tunnelUrl}\x1b[0m`);
      console.log("👉  Local Link:  \x1b[32mhttp://localhost:20128\x1b[0m");
      console.log("🔑  Password:    \x1b[33mDragon@12345\x1b[0m");
      console.log("========================================================\n");
      console.log("Press Ctrl+C to stop both the server and the tunnel.\n");
    }
  }
});

// Handle graceful exits
process.on("SIGINT", () => {
  console.log("\n🛑 Stopping server and tunnel...");
  serverProcess.kill("SIGINT");
  tunnelProcess.kill("SIGINT");
  process.exit();
});
