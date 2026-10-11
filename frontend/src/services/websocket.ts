export type TelemetryCallback = (data: any) => void;

export class TelemetryStream {
  private eventSource: EventSource | null = null;
  private listeners: TelemetryCallback[] = [];

  connect(url = '/events') {
    if (typeof window === 'undefined' || !window.EventSource) return;

    try {
      this.eventSource = new EventSource(url);
      this.eventSource.onmessage = (event) => {
        try {
          const parsed = JSON.parse(event.data);
          this.listeners.forEach((cb) => cb(parsed));
        } catch (e) {
          console.warn('Failed to parse SSE event data', e);
        }
      };
      this.eventSource.onerror = () => {
        // SSE will auto-retry
      };
    } catch (e) {
      console.warn('EventSource initialization failed', e);
    }
  }

  subscribe(callback: TelemetryCallback) {
    this.listeners.push(callback);
    return () => {
      this.listeners = this.listeners.filter((cb) => cb !== callback);
    };
  }

  disconnect() {
    if (this.eventSource) {
      this.eventSource.close();
      this.eventSource = null;
    }
  }
}

export const telemetryStream = new TelemetryStream();
