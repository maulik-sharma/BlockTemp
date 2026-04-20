from machine import Pin
from utime import sleep

pin = Pin("LED", Pin.OUT)

print("LED starts flashing...")
while True:
    try:
        pin.on()
        sleep(1)
        pin.off()
        sleep(1)
    except KeyboardInterrupt:
        break

pin.off()
print("Finished.")
