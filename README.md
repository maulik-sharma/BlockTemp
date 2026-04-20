# ⛓️ Blockchain in IoT — Demo

A real-time demo of a **Raspberry Pi Pico W** publishing LM35 temperature
readings to a **Hardhat local blockchain**, with a live web dashboard showing
every reading as it lands on-chain.

---

## Architecture

```
┌─────────────────────┐      HTTP POST       ┌─────────────────────────┐
│  Raspberry Pi Pico W│  ────────────────►  │   Relay Server          │
│  (LM35 + MicroPy)  │  /reading            │   relay/server.js       │
└─────────────────────┘                      │   localhost:3000        │
                                             └──────────┬──────────────┘
                                                        │  ethers.js
                                                        ▼
                                             ┌─────────────────────────┐
                                             │   Hardhat Local Node    │
                                             │   localhost:8545        │
                                             │   TemperatureLogger.sol │
                                             └──────────┬──────────────┘
                                                        │  SSE events
                                                        ▼
                                             ┌─────────────────────────┐
                                             │   Live Dashboard        │
                                             │   localhost:3000/       │
                                             └─────────────────────────┘
```

---

## 🚀 Demo Setup (3 terminals)

### Terminal 1 — Start Hardhat node
```bash
cd Blockchain
npx hardhat node
```
Keep this running. Copy any of the printed account private keys if needed.

---

### Terminal 2 — Deploy contract (once)
```bash
cd Blockchain
npm run deploy
```
This deploys `TemperatureLogger.sol` and writes `deploy-info.json`.

---

### Terminal 3 — Start relay server + dashboard
```bash
cd Blockchain
npm run relay
```
Open **http://localhost:3000** in a browser to see the dashboard.

---

## 🥧 Pico W Setup

1. Open `IOT/pico_uploader.py` and edit these lines:
   ```python
   SSID     = "YOUR_WIFI_SSID"
   PASSWORD = "YOUR_WIFI_PASSWORD"
   RELAY_URL = "http://192.168.1.XXX:3000/reading"  # your PC's IP
   ```
   > Find your PC's IP: run `ipconfig` in PowerShell, look for IPv4 Address

2. Flash `pico_uploader.py` to the Pico W using **Thonny** or `mpremote`:
   ```bash
   mpremote connect COM3 cp IOT/pico_uploader.py :main.py
   ```

3. The Pico W will:
   - Connect to WiFi (LED blinks slowly)
   - Read temp every 10 seconds
   - POST to relay → relay calls contract → dashboard updates live

---

## 🎮 Demo without Physical Pico W

Click **"▶ Simulate Pico W"** on the dashboard to generate synthetic readings
every 5 seconds — perfect for presenting without the hardware.

---

## 📂 File Structure

```
Blockchain/
├── contracts/
│   └── TemperatureLogger.sol   ← Smart contract
├── ignition/modules/
│   └── deploy.js               ← Deployment + device auth script
├── relay/
│   ├── server.js               ← Relay server (Express + ethers.js)
│   └── public/
│       └── index.html          ← Live dashboard
├── hardhat.config.js
├── package.json
└── deploy-info.json            ← Generated after `npm run deploy`

IOT/
├── lm35_temperature.py         ← Standalone sensor test script
└── pico_uploader.py            ← Blockchain-connected uploader
```

---

## Smart Contract

`TemperatureLogger.sol` stores readings with:
- `timestamp` — block timestamp
- `temperatureC` — temperature × 100 (preserves 2 decimal places)
- `deviceId` — which device sent it

Only **authorized devices** can write. The deploy script pre-authorizes `pico-w-001`.

Key functions:
| Function | Description |
|---|---|
| `recordTemperature(int256, string)` | Write a reading on-chain |
| `getAllReadings()` | Fetch all readings |
| `getLatestReading()` | Fetch the most recent |
| `authorizeDevice(string)` | Owner: add a device |

---

## Dashboard Features

| Feature | Description |
|---|---|
| 🌡️ Live thermometer | Visual gauge that fills based on temperature |
| 📈 Chart | Rolling 30-point temperature history |
| ⛓️ Chain visualizer | Each reading shown as a block in the chain |
| 📡 TX feed | Live transaction log with block numbers |
| 🔔 Toast notifications | Pop-up on every new on-chain reading |
| 🎮 Simulator | Generates readings without physical hardware |
