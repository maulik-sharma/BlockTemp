"""
pico_uploader.py — Raspberry Pi Pico W
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Reads LM35 temperature sensor and POSTs readings to the
relay server which records them on the Hardhat blockchain.

Wiring:
  LM35 VCC → 3.3V pin
  LM35 OUT → GP26 (ADC0)
  LM35 GND → GND

Dependencies (already in MicroPython):
  machine, network, urequests, ujson, utime
"""

import network
import urequests
import ujson
import utime
from machine import ADC, Pin

# ─── WiFi Configuration ────────────────────────────────────────────────────────
SSID     = "SSID"      # ← change this
PASSWORD = "PASSWORD"    # ← change this

# ─── Relay Server ─────────────────────────────────────────────────────────────
# Set this to your PC's local IP (the machine running relay/server.js)
# Find it with: ipconfig (Windows) or ip addr (Linux/Mac)
RELAY_URL   = "http://10.10.10.27:3000/reading"   # ← change IP
DEVICE_ID   = "pico-w-001"
INTERVAL_S  = 10    # seconds between readings

# ─── Sensor Configuration ─────────────────────────────────────────────────────
ADC_REF_VOLTAGE = 3.3
ADC_MAX         = 65535
NUM_SAMPLES     = 256   # Oversample to reduce ADC noise

# ─── Pin Setup ────────────────────────────────────────────────────────────────
adc     = ADC(Pin(26))         # LM35 signal on GP26
led     = Pin("LED", Pin.OUT)  # Onboard LED for status feedback

# ─── Helpers ──────────────────────────────────────────────────────────────────

def blink(times=1, delay=0.1):
    """Blink onboard LED to indicate status."""
    for _ in range(times):
        led.on()
        utime.sleep(delay)
        led.off()
        utime.sleep(delay)


def connect_wifi():
    """Connect to WiFi and return the WLAN interface."""
    wlan = network.WLAN(network.STA_IF)
    wlan.active(True)

    if wlan.isconnected():
        return wlan

    print(f"Connecting to WiFi: {SSID}")
    wlan.connect(SSID, PASSWORD)

    timeout = 20  # seconds
    start   = utime.time()
    while not wlan.isconnected():
        if utime.time() - start > timeout:
            raise RuntimeError("WiFi connection timed out")
        blink(1, 0.2)
        utime.sleep(0.3)

    print(f"Connected! IP: {wlan.ifconfig()[0]}")
    blink(3, 0.1)   # triple-blink = connected
    return wlan


def read_temperature_celsius():
    """
    Read LM35 sensor and return temperature in Celsius.
    LM35: 10 mV per °C  →  voltage × 100 = temperature.
    Uses oversampling (NUM_SAMPLES) to reduce ADC noise.
    """
    total = 0
    for _ in range(NUM_SAMPLES):
        total += adc.read_u16()
    raw       = total / NUM_SAMPLES
    voltage   = (raw / ADC_MAX) * ADC_REF_VOLTAGE
    temp_c    = voltage * 100
    return temp_c - 10


def celsius_to_fahrenheit(c):
    return (c * 9 / 5) + 32


def post_reading(temp_c):
    """
    POST temperature reading JSON to the relay server.
    Returns True on success, False on failure.
    """
    payload = ujson.dumps({
        "temperature": round(temp_c, 2),
        "unit":        "C",
        "device_id":   DEVICE_ID,
    })
    headers = {
        "Content-Type": "application/json",
    }
    try:
        res = urequests.post(RELAY_URL, data=payload, headers=headers, timeout=10)
        ok = res.status_code == 200
        res.close()
        return ok
    except Exception as e:
        print(f"  HTTP error: {e}")
        return False


# ─── Main Loop ────────────────────────────────────────────────────────────────

print("=" * 50)
print("  Blockchain IoT — Raspberry Pi Pico W")
print("  Temperature Logger → Hardhat Chain")
print("=" * 50)
print()

# Connect WiFi
try:
    wlan = connect_wifi()
except RuntimeError as e:
    print(f"ERROR: {e}")
    while True:
        blink(5, 0.05)
        utime.sleep(2)

print(f"Relay URL : {RELAY_URL}")
print(f"Device ID : {DEVICE_ID}")
print(f"Interval  : {INTERVAL_S}s")
print()
print("Sending readings to chain…\n")

reading_count = 0

while True:
    try:
        temp_c = read_temperature_celsius()
        temp_f = celsius_to_fahrenheit(temp_c)
        reading_count += 1

        print(f"[{reading_count:04d}] {temp_c:.2f} °C  |  {temp_f:.2f} °F", end="  →  ")

        led.on()
        success = post_reading(temp_c)
        led.off()

        if success:
            print("✔ On-chain")
            blink(2, 0.08)   # 2 quick blinks = success
        else:
            print("✗ Failed")
            blink(5, 0.05)   # 5 fast blinks = error

    except KeyboardInterrupt:
        print("\nStopped by user.")
        led.off()
        break
    except Exception as e:
        print(f"\nError: {e}")
        blink(3, 0.2)

    utime.sleep(INTERVAL_S)
