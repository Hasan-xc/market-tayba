/**
 * Global Hardware Barcode Scanner Listener
 * Captures keystrokes from USB, Bluetooth, and 2.4G Wireless HID Barcode Scanners.
 * Distinguishes scanner bursts (inter-key time < 45ms) from manual keyboard typing.
 */

type ScanCallback = (barcode: string, stats: { latencyMs: number; charCount: number; raw: string }) => void;

class HardwareScannerManager {
  private buffer: string = '';
  private timestamps: number[] = [];
  private lastKeyTime: number = 0;
  private maxInterKeyDelay: number = 55; // ms between keys for scanner detection
  private listeners: Set<ScanCallback> = new Set();
  private testListeners: Set<(event: { char: string; delta: number; buffer: string }) => void> = new Set();
  private isListening: boolean = false;
  private lastScannedCode: string = '';
  private lastScanTime: number = 0;

  constructor() {
    if (typeof window !== 'undefined') {
      this.init();
    }
  }

  private init() {
    if (this.isListening) return;
    window.addEventListener('keydown', this.handleKeyDown, true);
    this.isListening = true;
  }

  public setMaxDelay(delayMs: number) {
    this.maxInterKeyDelay = Math.max(20, Math.min(150, delayMs));
  }

  public subscribe(callback: ScanCallback): () => void {
    this.listeners.add(callback);
    return () => {
      this.listeners.delete(callback);
    };
  }

  public subscribeTestEvents(callback: (event: { char: string; delta: number; buffer: string }) => void): () => void {
    this.testListeners.add(callback);
    return () => {
      this.testListeners.delete(callback);
    };
  }

  private handleKeyDown = (e: KeyboardEvent) => {
    // Ignore modifier keys alone
    if (['Shift', 'Control', 'Alt', 'Meta', 'CapsLock', 'Tab'].includes(e.key)) {
      return;
    }

    const now = performance.now();
    const delta = this.lastKeyTime > 0 ? now - this.lastKeyTime : 0;
    this.lastKeyTime = now;

    // Notify test listeners for diagnostic view
    if (this.testListeners.size > 0 && e.key.length === 1) {
      this.testListeners.forEach((fn) => fn({ char: e.key, delta, buffer: this.buffer + e.key }));
    }

    // Check if key is Enter (standard barcode scanner terminating character)
    if (e.key === 'Enter') {
      if (this.buffer.length >= 3) {
        // Calculate average time between strokes
        let isRapidBurst = true;
        if (this.timestamps.length >= 2) {
          const totalDuration = this.timestamps[this.timestamps.length - 1] - this.timestamps[0];
          const avgInterval = totalDuration / (this.timestamps.length - 1);
          isRapidBurst = avgInterval <= this.maxInterKeyDelay;
        }

        const barcode = this.buffer.trim();
        const duration = this.timestamps.length > 1 ? Math.round(this.timestamps[this.timestamps.length - 1] - this.timestamps[0]) : 0;

        // Prevent rapid accidental duplicate scans within 400ms
        const isDuplicateRecent = barcode === this.lastScannedCode && (now - this.lastScanTime < 400);

        if (isRapidBurst && !isDuplicateRecent && barcode.length >= 2) {
          this.lastScannedCode = barcode;
          this.lastScanTime = now;

          // Prevent default Enter action if it was a hardware scanner burst
          e.preventDefault();
          e.stopPropagation();

          // Dispatch to all registered listeners
          this.listeners.forEach((fn) => {
            try {
              fn(barcode, {
                latencyMs: duration,
                charCount: barcode.length,
                raw: barcode,
              });
            } catch (err) {
              console.error('Error handling barcode scan:', err);
            }
          });
        }
      }

      // Reset buffer after Enter
      this.buffer = '';
      this.timestamps = [];
      return;
    }

    // If typing was too slow (> 120ms between keys), reset buffer unless it's the very first character
    if (delta > 120 && this.buffer.length > 0) {
      this.buffer = '';
      this.timestamps = [];
    }

    // Only collect single printable characters
    if (e.key.length === 1) {
      this.buffer += e.key;
      this.timestamps.push(now);

      // Auto-purge buffer if exceeding 60 characters
      if (this.buffer.length > 60) {
        this.buffer = this.buffer.slice(-60);
        this.timestamps = this.timestamps.slice(-60);
      }
    }
  };

  /**
   * Manually simulate a scan (useful for UI buttons, testing, or camera scanners)
   */
  public simulateScan(barcode: string) {
    if (!barcode) return;
    this.listeners.forEach((fn) => {
      try {
        fn(barcode.trim(), {
          latencyMs: 15,
          charCount: barcode.trim().length,
          raw: barcode.trim(),
        });
      } catch (err) {
        console.error('Error handling simulated scan:', err);
      }
    });
  }
}

export const hardwareScanner = new HardwareScannerManager();
