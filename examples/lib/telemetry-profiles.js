// Synthetic telemetry generators for the Phase 15 example verticals, used by
// simulate-telemetry.js. Each profile is a function of (state) -> { payload, state }
// where `state` is per-device and carried across ticks so values drift realistically
// (sawtooths, slow drains, occasional threshold breaches) instead of being pure noise.

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function jitter(spread) {
  return (Math.random() - 0.5) * 2 * spread;
}

export const profiles = {
  agriculture: {
    'soil-sensor': (state = { soilMoisture: 35, temperature: 22 }) => {
      let { soilMoisture, temperature } = state;
      soilMoisture = soilMoisture <= 14 ? clamp(soilMoisture + 20 + jitter(3), 0, 60) : clamp(soilMoisture - (1 + Math.random() * 2), 0, 60);
      temperature = clamp(temperature + jitter(1.5), 15, 32);
      return { payload: { soilMoisture: Number(soilMoisture.toFixed(1)), temperature: Number(temperature.toFixed(1)) }, state: { soilMoisture, temperature } };
    }
  },

  'industrial-automation': {
    plc: (state = { cycleCount: 0, temperature: 55 }) => {
      const cycleCount = state.cycleCount + 1;
      const temperature = clamp(state.temperature + jitter(3), 40, 80);
      const faultCode = Math.random() < 0.12 ? 1 + Math.floor(Math.random() * 4) : 0;
      return { payload: { faultCode, cycleCount, temperature: Number(temperature.toFixed(1)) }, state: { cycleCount, temperature } };
    }
  },

  energy: {
    'smart-meter': (state = { energyKwh: 0, powerKw: 25 }) => {
      const powerKw = clamp(25 + 20 * Math.sin(Date.now() / 60000) + jitter(15), 5, 75);
      const voltage = clamp(230 + jitter(3), 215, 245);
      const energyKwh = state.energyKwh + powerKw / 720; // ~ interval-sized accumulation
      return {
        payload: { powerKw: Number(powerKw.toFixed(1)), voltage: Number(voltage.toFixed(1)), energyKwh: Number(energyKwh.toFixed(2)) },
        state: { powerKw, energyKwh }
      };
    }
  },

  water: {
    'tank-monitor': (state = { tankLevelPct: 60, pumpRunning: false }) => {
      let { tankLevelPct, pumpRunning } = state;
      if (tankLevelPct <= 12) pumpRunning = true;
      if (tankLevelPct >= 96) pumpRunning = false;
      tankLevelPct = clamp(tankLevelPct + (pumpRunning ? 6 + jitter(2) : -(1.5 + jitter(1))), 0, 100);
      const flowRateLpm = pumpRunning ? Number((30 + jitter(8)).toFixed(1)) : Number((2 + jitter(2)).toFixed(1));
      return {
        payload: { tankLevelPct: Number(tankLevelPct.toFixed(1)), pumpRunning, flowRateLpm },
        state: { tankLevelPct, pumpRunning }
      };
    }
  },

  healthcare: {
    'env-monitor': (state = { temperature: 4 }) => {
      const excursion = Math.random() < 0.1;
      const temperature = excursion ? clamp(9 + jitter(3), 8.1, 14) : clamp(4 + jitter(1.5), 1, 7.9);
      const humidity = Number(clamp(42 + jitter(6), 25, 60).toFixed(1));
      return { payload: { temperature: Number(temperature.toFixed(1)), humidity }, state: { temperature } };
    },
    'asset-tag': (state = { batteryPct: 100 }) => {
      const batteryPct = clamp(state.batteryPct - (0.3 + Math.random() * 0.6), 2, 100);
      return { payload: { batteryPct: Number(batteryPct.toFixed(1)) }, state: { batteryPct } };
    }
  }
};

export function getProfile(industry, role) {
  const industryProfiles = profiles[industry];
  if (!industryProfiles || !industryProfiles[role]) {
    throw new Error(`No telemetry profile for industry "${industry}" role "${role}"`);
  }
  return industryProfiles[role];
}
