// Publishes synthetic telemetry for a seeded example's devices onto the real MQTT
// broker, so dashboards/rules/reports have live data to work with instead of just
// accepted config. Requires `node examples/<industry>/seed.js` to have already run
// (reads its .seeded.json for device ids/roles).
//
// Usage: node examples/lib/simulate-telemetry.js --industry agriculture [--interval-ms 5000] [--iterations 20]

import mqtt from 'mqtt';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { loadState } from './seed-client.js';
import { getProfile } from './telemetry-profiles.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function parseArgs(argv) {
  const args = { intervalMs: 5000, iterations: Infinity };
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === '--industry') args.industry = argv[++i];
    else if (argv[i] === '--interval-ms') args.intervalMs = Number(argv[++i]);
    else if (argv[i] === '--iterations') args.iterations = Number(argv[++i]);
  }
  if (!args.industry) {
    throw new Error('Usage: node examples/lib/simulate-telemetry.js --industry <name> [--interval-ms N] [--iterations N]');
  }
  return args;
}

async function main() {
  const { industry, intervalMs, iterations } = parseArgs(process.argv.slice(2));

  const statePath = path.join(__dirname, '..', industry, '.seeded.json');
  const seeded = loadState(statePath);
  if (!seeded.devices?.length) {
    throw new Error(`No devices recorded in ${statePath} — run examples/${industry}/seed.js first`);
  }

  const brokerUrl = `mqtt://${process.env.MQTT_HOST || 'localhost'}:${process.env.MQTT_PORT || 1883}`;
  const client = mqtt.connect(brokerUrl, {
    username: process.env.MQTT_USERNAME || undefined,
    password: process.env.MQTT_PASSWORD || undefined,
    clientId: `example-simulator-${industry}-${Date.now()}`
  });

  await new Promise((resolve, reject) => {
    client.once('connect', resolve);
    client.once('error', reject);
  });
  console.log(`Connected to ${brokerUrl}; simulating ${seeded.devices.length} device(s) for "${industry}"`);

  const deviceState = new Map();
  let tick = 0;

  const publishOnce = () =>
    Promise.all(
      seeded.devices.map((device) => {
        const generate = getProfile(industry, device.role);
        const { payload, state } = generate(deviceState.get(device.id));
        deviceState.set(device.id, state);
        const topic = `devices/${device.id}/telemetry`;
        return new Promise((resolve, reject) => {
          client.publish(topic, JSON.stringify(payload), (err) => {
            if (err) return reject(err);
            console.log(`  -> ${topic} ${JSON.stringify(payload)}`);
            resolve();
          });
        });
      })
    );

  while (tick < iterations) {
    await publishOnce();
    tick += 1;
    if (tick < iterations) await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }

  client.end();
  console.log(`Done: published ${tick} round(s) of telemetry for "${industry}"`);
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
