const requiredTargets = [
  ['BATIOS_FIELD_PWA_URL', 'Field PWA'],
  ['BATIOS_ADMIN_URL', 'Admin dashboard'],
  ['BATIOS_PM_DASHBOARD_URL', 'PM dashboard'],
  ['BATIOS_QS_DASHBOARD_URL', 'QS dashboard'],
];

const missing = requiredTargets
  .filter(([envName]) => process.env[envName] === undefined || process.env[envName]?.trim() === '')
  .map(([envName]) => envName);

if (missing.length > 0) {
  console.error(`Missing required staging smoke check env vars: ${missing.join(', ')}`);
  process.exit(1);
}

const failures = [];

for (const [envName, label] of requiredTargets) {
  const url = process.env[envName];

  try {
    const response = await fetch(url, { redirect: 'manual' });

    if (response.status < 200 || response.status >= 400) {
      failures.push(`${label} returned HTTP ${response.status}`);
      continue;
    }

    console.log(`${label}: ${response.status}`);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'request failed';
    failures.push(`${label} failed: ${message}`);
  }
}

if (failures.length > 0) {
  console.error(failures.join('\n'));
  process.exit(1);
}

console.log('Staging smoke check passed.');
