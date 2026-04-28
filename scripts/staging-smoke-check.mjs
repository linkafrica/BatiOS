const requiredTargets = [
  ['BATIOS_FIELD_PWA_URL', 'Field PWA', 'field-pwa'],
  ['BATIOS_ADMIN_URL', 'Admin dashboard', 'admin'],
  ['BATIOS_PM_DASHBOARD_URL', 'PM dashboard', 'pm-dashboard'],
  ['BATIOS_QS_DASHBOARD_URL', 'QS dashboard', 'qs-dashboard'],
];

const missing = requiredTargets
  .filter(([envName]) => process.env[envName] === undefined || process.env[envName]?.trim() === '')
  .map(([envName]) => envName);

if (missing.length > 0) {
  console.error(`Missing required staging smoke check env vars: ${missing.join(', ')}`);
  process.exit(1);
}

const failures = [];

for (const [envName, label, service] of requiredTargets) {
  const url = toHealthUrl(process.env[envName]);

  try {
    const response = await fetch(url, { redirect: 'manual' });

    if (response.status < 200 || response.status >= 400) {
      failures.push(`${label} returned HTTP ${response.status}`);
      continue;
    }

    const payload = await response.json();

    if (payload.service !== service || payload.status !== 'ok') {
      failures.push(`${label} returned invalid health payload`);
      continue;
    }

    if (typeof payload.checkedAt !== 'string' || Number.isNaN(Date.parse(payload.checkedAt))) {
      failures.push(`${label} returned invalid health timestamp`);
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

function toHealthUrl(baseUrl) {
  return new URL('/healthz', baseUrl).toString();
}
