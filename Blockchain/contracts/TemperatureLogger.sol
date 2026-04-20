// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title TemperatureLogger
 * @notice Stores temperature readings from IoT devices (e.g. Raspberry Pi Pico W)
 *         on the blockchain. Each reading is immutably recorded with a timestamp.
 * @dev Designed for the Blockchain in IoT presentation demo.
 */
contract TemperatureLogger {

    // ─── Data Structures ────────────────────────────────────────────────────────

    struct Reading {
        uint256 timestamp;      // Unix timestamp of the reading
        int256  temperatureC;   // Temperature in Celsius × 100 (e.g. 2567 = 25.67°C)
        string  deviceId;       // Identifier for the IoT device
    }

    // ─── State Variables ────────────────────────────────────────────────────────

    Reading[] public readings;
    address   public owner;

    mapping(string => bool) public authorizedDevices;

    // ─── Events ─────────────────────────────────────────────────────────────────

    /**
     * @notice Emitted whenever a new temperature reading is recorded on-chain.
     * @param index     Position in the readings array
     * @param deviceId  The ID of the reporting IoT device
     * @param tempC100  Temperature in Celsius × 100
     * @param timestamp Unix timestamp
     */
    event TemperatureRecorded(
        uint256 indexed index,
        string  indexed deviceId,
        int256          tempC100,
        uint256         timestamp
    );

    event DeviceAuthorized(string deviceId);
    event DeviceRevoked(string deviceId);

    // ─── Modifiers ───────────────────────────────────────────────────────────────

    modifier onlyOwner() {
        require(msg.sender == owner, "Not the contract owner");
        _;
    }

    modifier onlyAuthorized(string memory deviceId) {
        require(authorizedDevices[deviceId], "Device not authorized");
        _;
    }

    // ─── Constructor ─────────────────────────────────────────────────────────────

    constructor() {
        owner = msg.sender;
    }

    // ─── Admin Functions ─────────────────────────────────────────────────────────

    function authorizeDevice(string memory deviceId) external onlyOwner {
        authorizedDevices[deviceId] = true;
        emit DeviceAuthorized(deviceId);
    }

    function revokeDevice(string memory deviceId) external onlyOwner {
        authorizedDevices[deviceId] = false;
        emit DeviceRevoked(deviceId);
    }

    // ─── Core Functions ──────────────────────────────────────────────────────────

    /**
     * @notice Record a temperature reading on the blockchain.
     * @param temperatureC100  Temperature × 100 to preserve 2 decimal places
     * @param deviceId         The ID of the device submitting the reading
     */
    function recordTemperature(
        int256  temperatureC100,
        string  memory deviceId
    ) external onlyAuthorized(deviceId) {
        uint256 idx = readings.length;

        readings.push(Reading({
            timestamp:      block.timestamp,
            temperatureC:   temperatureC100,
            deviceId:       deviceId
        }));

        emit TemperatureRecorded(idx, deviceId, temperatureC100, block.timestamp);
    }

    // ─── View Functions ──────────────────────────────────────────────────────────

    function getTotalReadings() external view returns (uint256) {
        return readings.length;
    }

    function getReading(uint256 index) external view returns (
        uint256 timestamp,
        int256  temperatureC,
        string  memory deviceId
    ) {
        require(index < readings.length, "Index out of bounds");
        Reading storage r = readings[index];
        return (r.timestamp, r.temperatureC, r.deviceId);
    }

    function getLatestReading() external view returns (
        uint256 timestamp,
        int256  temperatureC,
        string  memory deviceId
    ) {
        require(readings.length > 0, "No readings yet");
        Reading storage r = readings[readings.length - 1];
        return (r.timestamp, r.temperatureC, r.deviceId);
    }

    /// @notice Return all readings in one call (for dashboard use)
    function getAllReadings() external view returns (Reading[] memory) {
        return readings;
    }
}
