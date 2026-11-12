const { withGradleProperties, withProjectBuildGradle, withSettingsGradle } = require('expo/config-plugins');
const { platform } = require('node:process');

// SDK CMake 4.1.2 bundles Ninja 1.12.1, which supports Windows long paths.
// Keep this host-specific choice out of Linux/macOS generated builds.
module.exports = function withWindowsCmake(config) {
  if (platform !== 'win32') return config;
  config = withGradleProperties(config, (result) => {
    result.modResults = result.modResults.filter(
      (entry) => entry.type !== 'property' || entry.key !== 'android.cmakeVersion',
    );
    result.modResults.push({ type: 'property', key: 'android.cmakeVersion', value: '4.1.2' });
    return result;
  });
  config = withSettingsGradle(config, (result) => {
    const generated = 'expoAutolinking.useExpoVersionCatalog()';
    const compatible = "expoAutolinking.useExpoVersionCatalog { version('agp', '9.1.1') }";
    result.modResults.contents = result.modResults.contents.replace(generated, compatible);
    return result;
  });
  return withProjectBuildGradle(config, (result) => {
    const compatibility = `
// Expo SQLite 58 declares CMake 3.4.1; CMake 4 requires an explicit policy compatibility floor.
subprojects { project ->
  if (project.name == 'expo-sqlite') {
    project.afterEvaluate {
      project.android.defaultConfig.externalNativeBuild.cmake.arguments += '-DCMAKE_POLICY_VERSION_MINIMUM=3.5'
    }
  }
}
`;
    if (!result.modResults.contents.includes('CMAKE_POLICY_VERSION_MINIMUM=3.5'))
      result.modResults.contents += compatibility;
    return result;
  });
};
