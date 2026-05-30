'use strict';

const fs = require('node:fs');
const https = require('node:https');
const path = require('node:path');

// Seed list — used until the upstream hosts file is fetched and cached.
const SEED_HOSTS = [
  'doubleclick.net',
  'googlesyndication.com',
  'googleadservices.com',
  'adservice.google.com',
  'adnxs.com',
  'adsrvr.org',
  'rubiconproject.com',
  'pubmatic.com',
  'openx.net',
  'criteo.com',
  'criteo.net',
  'taboola.com',
  'outbrain.com',
  'media.net',
  'amazon-adsystem.com',
  'advertising.com',
  'adform.net',
  'adroll.com',
  'serving-sys.com',
  'casalemedia.com',
  'yieldmo.com',
  'indexww.com',
  'smartadserver.com',
  'moatads.com',
  'google-analytics.com',
  'analytics.google.com',
  'googletagmanager.com',
  'googletagservices.com',
  'scorecardresearch.com',
  'quantserve.com',
  'chartbeat.com',
  'mixpanel.com',
  'segment.com',
  'segment.io',
  'fullstory.com',
  'hotjar.com',
  'mouseflow.com',
  'optimizely.com',
  'crazyegg.com',
  'amplitude.com',
  'kissmetrics.com',
  'branch.io',
  'adjust.com',
  'appsflyer.com',
];

// StevenBlack/hosts — a widely-used, MIT-licensed aggregator of multiple ad,
// tracker, and malware blocklists. Roughly 150k entries.
const UPSTREAM_URL =
  'https://raw.githubusercontent.com/StevenBlack/hosts/master/hosts';
const MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000; // refresh weekly

const parseHostsFile = (text) => {
  const hosts = new Set();
  for (const line of text.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) {
      continue;
    }
    const parts = trimmed.split(/\s+/);
    if (parts.length < 2) {
      continue;
    }
    const ip = parts[0];
    if (ip !== '0.0.0.0' && ip !== '127.0.0.1') {
      continue;
    }
    const host = parts[1].toLowerCase();
    if (
      host === 'localhost' ||
      host === 'localhost.localdomain' ||
      host === 'broadcasthost' ||
      host === '0.0.0.0' ||
      !host.includes('.')
    ) {
      continue;
    }
    hosts.add(host);
  }
  return hosts;
};

const fetchUpstream = () =>
  new Promise((resolve, reject) => {
    https
      .get(UPSTREAM_URL, (res) => {
        if (res.statusCode !== 200) {
          reject(new Error(`status ${res.statusCode}`));
          res.resume();
          return;
        }
        const chunks = [];
        res.on('data', (chunk) => chunks.push(chunk));
        res.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
      })
      .on('error', reject);
  });

/**
 * Loads the blocked-hosts set: seed list immediately, plus the StevenBlack
 * upstream list cached on disk (refreshed weekly).
 *
 * @param userDataDir Electron app.getPath('userData').
 * @returns Promise resolving to a Set of blocked hostnames.
 */
async function loadBlockedHosts(userDataDir) {
  const hosts = new Set(SEED_HOSTS);

  const cachePath = path.join(userDataDir, 'adblock-hosts.txt');
  let cachedText = null;
  try {
    const stat = fs.statSync(cachePath);
    if (Date.now() - stat.mtimeMs < MAX_AGE_MS) {
      cachedText = fs.readFileSync(cachePath, 'utf8');
    }
  } catch {
    // missing or unreadable — fall through
  }

  if (cachedText) {
    for (const host of parseHostsFile(cachedText)) {
      hosts.add(host);
    }
    return hosts;
  }

  try {
    const text = await fetchUpstream();
    fs.mkdirSync(userDataDir, { recursive: true });
    fs.writeFileSync(cachePath, text);
    for (const host of parseHostsFile(text)) {
      hosts.add(host);
    }
  } catch {
    // Network down — seed list is the fallback.
  }
  return hosts;
}

module.exports = { SEED_HOSTS, loadBlockedHosts };
