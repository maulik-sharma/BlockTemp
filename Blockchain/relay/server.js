/**
 * relay/server.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Acts as the bridge between the Raspberry Pi Pico W (IoT device) and the
 * Hardhat local blockchain.
 *
 * Endpoints:
 *   POST /reading      — Pico W posts temperature here; relay records it on-chain
 *   GET  /readings     — Dashboard polls this to get all on-chain readings
 *   GET  /status       — Health-check / contract info
 *   GET  /             — Serves the live dashboard HTML
 *
 * Start order:
 *   1. npx hardhat node           (terminal 1)
 *   2. npm run deploy              (terminal 2, once)
 *   3. node relay/server.js        (terminal 2, keep running)
 *   4. Flash pico_uploader.py to Pico W
 */

const express = require("express");
const cors    = require("cors");
const { ethers } = require("ethers");
const path    = require("path");
const fs      = require("fs");

// ─── Config ───────────────────────────────────────────────────────────────────

const PORT            = 3000;
const HARDHAT_RPC_URL = "http://127.0.0.1:8545";
const ACCOUNT_INDEX   = 0;   // Hardhat test account index to use as signer

// ─── Load deploy info ─────────────────────────────────────────────────────────

const deployInfoPath = path.join(__dirname, "..", "deploy-info.json");

if (!fs.existsSync(deployInfoPath)) {
  console.error("❌  deploy-info.json not found.");
  console.error("   Run: npm run deploy");
  process.exit(1);
}

const { contractAddress, deviceId } = JSON.parse(
  fs.readFileSync(deployInfoPath, "utf-8")
);

// Minimal ABI — only what we need
const CONTRACT_ABI = [
  "function recordTemperature(int256 temperatureC100, string deviceId) external",
  "function getAllReadings() external view returns (tuple(uint256 timestamp, int256 temperatureC, string deviceId)[])",
  "function getTotalReadings() external view returns (uint256)",
  "event TemperatureRecorded(uint256 indexed index, string indexed deviceId, int256 tempC100, uint256 timestamp)",
];

// ─── Ethers setup ────────────────────────────────────────────────────────────

const provider = new ethers.JsonRpcProvider(HARDHAT_RPC_URL);
let contract;
let signer;

async function initEthers() {
  signer   = await provider.getSigner(ACCOUNT_INDEX);
  contract = new ethers.Contract(contractAddress, CONTRACT_ABI, signer);
  console.log("⛓  Connected to contract:", contractAddress);
  console.log("🔑  Signer:", await signer.getAddress());
}

// ─── In-memory event log for SSE ─────────────────────────────────────────────

const recentEvents = [];   // last 50 events, newest first

// ─── Express app ─────────────────────────────────────────────────────────────

const app = express();
app.use(cors());
app.use(express.json());

// Serve dashboard
app.use(express.static(path.join(__dirname, "public")));

// ── POST /reading ─────────────────────────────────────────────────────────────
// Body: { temperature: 25.67, unit: "C", device_id: "pico-w-001" }
app.post("/reading", async (req, res) => {
  try {
    const { temperature, unit, device_id } = req.body;

    if (temperature === undefined) {
      return res.status(400).json({ error: "Missing temperature field" });
    }

    const tempC = unit === "F"
      ? ((parseFloat(temperature) - 32) * 5) / 9
      : parseFloat(temperature);

    const tempC100 = Math.round(tempC * 100);   // store as integer × 100
    const usedDeviceId = device_id || deviceId;

    console.log(`\n📥  Reading received: ${tempC.toFixed(2)}°C from ${usedDeviceId}`);
    console.log(`    Submitting to blockchain...`);

    const tx = await contract.recordTemperature(tempC100, usedDeviceId);
    const receipt = await tx.wait();

    console.log(`    ✅  Tx: ${receipt.hash}  |  Block: #${receipt.blockNumber}`);

    const entry = {
      txHash:     receipt.hash,
      block:      receipt.blockNumber,
      tempC:      tempC.toFixed(2),
      tempF:      ((tempC * 9) / 5 + 32).toFixed(2),
      tempC100,
      deviceId:   usedDeviceId,
      timestamp:  Math.floor(Date.now() / 1000),
      receivedAt: new Date().toISOString(),
    };

    recentEvents.unshift(entry);
    if (recentEvents.length > 50) recentEvents.pop();

    // Notify SSE clients
    sseClients.forEach((client) =>
      client.res.write(`data: ${JSON.stringify(entry)}\n\n`)
    );

    return res.json({ success: true, ...entry });
  } catch (err) {
    console.error("❌  Error recording temperature:", err.message);
    return res.status(500).json({ error: err.message });
  }
});

// ── GET /readings ─────────────────────────────────────────────────────────────
app.get("/readings", async (req, res) => {
  try {
    const raw = await contract.getAllReadings();
    const readings = raw.map((r, i) => ({
      index:    i,
      timestamp: Number(r.timestamp),
      tempC:    (Number(r.temperatureC) / 100).toFixed(2),
      tempF:    ((Number(r.temperatureC) / 100 * 9) / 5 + 32).toFixed(2),
      deviceId: r.deviceId,
    }));
    return res.json({ count: readings.length, readings });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// ── GET /status ───────────────────────────────────────────────────────────────
app.get("/status", async (req, res) => {
  try {
    const total  = await contract.getTotalReadings();
    const block  = await provider.getBlockNumber();
    const sAddr  = await signer.getAddress();
    return res.json({
      contract:      contractAddress,
      deviceId,
      totalReadings: Number(total),
      currentBlock:  block,
      signer:        sAddr,
      relayVersion:  "1.0.0",
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// ── GET /events  (Server-Sent Events for live updates) ────────────────────────
const sseClients = new Set();

app.get("/events", (req, res) => {
  res.setHeader("Content-Type",  "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection",    "keep-alive");
  res.flushHeaders();

  const client = { id: Date.now(), res };
  sseClients.add(client);

  // Send recent history immediately
  recentEvents.forEach((e) => res.write(`data: ${JSON.stringify(e)}\n\n`));

  req.on("close", () => sseClients.delete(client));
});

// ─── Start ─────────────────────────────────────────────────────────────────────

initEthers().then(() => {
  app.listen(PORT, () => {
    console.log("\n═══════════════════════════════════════════════════════");
    console.log(`  🚀  Relay server running at http://localhost:${PORT}`);
    console.log(`  📊  Dashboard:  http://localhost:${PORT}/`);
    console.log(`  📡  POST /reading  ← Pico W sends readings here`);
    console.log("═══════════════════════════════════════════════════════\n");
  });
}).catch((err) => {
  console.error("Failed to initialize ethers:", err.message);
  process.exit(1);
});
