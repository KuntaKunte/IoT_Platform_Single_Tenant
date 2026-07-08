export function createMonitoringHooks() {
  const events = [];

  return {
    events,
    trackEvent(name, meta = {}) {
      const event = { name, meta, timestamp: new Date().toISOString() };
      events.push(event);
      return event;
    }
  };
}
