from machine import ADC, Pin
from utime import sleep

# LM35 connected to GP26 (ADC channel 0)
# Wiring: LM35 VCC -> 3.3V, OUT -> GP26, GND -> GND
adc = ADC(Pin(26))

# ADC reference voltage on Pico W is 3.3V
# ADC resolution is 16-bit (0 - 65535)
ADC_REF_VOLTAGE = 3.3
ADC_MAX = 65535

# Number of samples to average — higher = more stable but slower
# 32 samples gives a good balance between speed and noise reduction
NUM_SAMPLES = 256

def read_temperature_celsius():
    """
    Read LM35 sensor and return temperature in Celsius.
    LM35 output: 10mV per degree Celsius (e.g. 250mV = 25.0°C).

    Oversampling: Takes NUM_SAMPLES readings and averages them to
    cancel out ADC noise — the Pico W ADC is quite noisy on its own.
    """
    total = 0
    for _ in range(NUM_SAMPLES):
        total += adc.read_u16()
    raw = total / NUM_SAMPLES                     # Averaged raw value
    voltage = (raw / ADC_MAX) * ADC_REF_VOLTAGE   # Convert to volts
    temperature = voltage * 100                   # LM35: 10mV/°C → V * 100 = °C
    return temperature

def celsius_to_fahrenheit(celsius):
    return (celsius * 9 / 5) + 32

print("LM35 Temperature Sensor - Raspberry Pi Pico W")
print("=" * 45)
print("Reading temperature every 2 seconds...")
print("Press Ctrl+C to stop.\n")

while True:
    try:
        temp_c = read_temperature_celsius()
        temp_f = celsius_to_fahrenheit(temp_c)
        print(f"Temperature: {temp_c:.2f} °C  |  {temp_f:.2f} °F")
        sleep(2)
    except KeyboardInterrupt:
        print("\nStopped by user.")
        break
