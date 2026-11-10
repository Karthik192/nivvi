const { getDefaultConfig } = require('expo/metro-config');
const path = require('node:path');

const config = getDefaultConfig(__dirname);
if (!config.resolver.assetExts.includes('riv')) config.resolver.assetExts.push('riv');
const localCache = path
  .resolve(__dirname, '../../.local')
  .split(/[\\/]/)
  .map((part) => part.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
  .join('[/\\\\]');
const existing = config.resolver.blockList;
config.resolver.blockList = [
  ...(Array.isArray(existing) ? existing : existing ? [existing] : []),
  new RegExp(`^${localCache}([/\\\\]|$)`),
  // Native compiler outputs contain no JS modules or source assets.
  /[/\\]android[/\\](?:app[/\\])?(?:build|\.cxx|\.gradle)(?:[/\\]|$)/,
];

module.exports = config;
