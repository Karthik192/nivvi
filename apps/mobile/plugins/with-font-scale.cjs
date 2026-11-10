const { withAndroidManifest } = require('expo/config-plugins');

// Keep one Router root while React Native handles font configuration updates.
module.exports = function withFontScale(config) {
  return withAndroidManifest(config, (result) => {
    const activity = result.modResults.manifest.application?.[0]?.activity?.find(
      (entry) => entry.$['android:name'] === '.MainActivity',
    );
    if (!activity) throw new Error('MainActivity is required for font-scale configuration.');
    const changes = new Set((activity.$['android:configChanges'] || '').split('|').filter(Boolean));
    changes.add('fontScale');
    activity.$['android:configChanges'] = [...changes].join('|');
    return result;
  });
};
