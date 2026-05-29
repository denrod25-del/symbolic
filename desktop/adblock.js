'use strict';

// Minimal built-in ad/tracker hostlist for the Symbolic browser. Matches
// EXACTLY this host or any subdomain of it (e.g. `g.doubleclick.net` matches
// `doubleclick.net`). Intentionally short and conservative — a real ad-block
// engine like uBlock Origin uses thousands of rules; this is a starting point.

const BLOCKED_HOSTS = [
  // Display ads
  'doubleclick.net',
  'googlesyndication.com',
  'googleadservices.com',
  'adservice.google.com',
  'adnxs.com',
  'adsystem.com',
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
  'adcolony.com',

  // Analytics & trackers
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
  'newrelic.com',
  'optimizely.com',
  'crazyegg.com',
  'amplitude.com',
  'kissmetrics.com',
  'branch.io',
  'adjust.com',
  'appsflyer.com',
  'mparticle.com',
];

module.exports = { BLOCKED_HOSTS };
