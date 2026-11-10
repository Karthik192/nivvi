const { withGradleProperties } = require('expo/config-plugins');
const { platform } = require('node:process');

// SDK CMake 4.1.2 bundles Ninja 1.12.1, which supports Windows long paths.
// Keep this host-specific choice out of Linux/macOS generated builds.
module.exports = function withWindowsCmake(config) {
  if (platform !== 'win32') return config;
  return withGradleProperties(config, (result) => {
    result.modResults = result.modResults.filter(
      (entry) => entry.type !== 'property' || entry.key !== 'android.cmakeVersion',
    );
    result.modResults.push({ type: 'property', key: 'android.cmakeVersion', value: '4.1.2' });
    return result;
  });
};
