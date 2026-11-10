import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { runInNewContext } from 'node:vm';

type Property = { type: string; key?: string; value: string };
type ModResult = { modResults: Property[] };

function loadPlugin(platform: string) {
  let mod: ((result: ModResult) => ModResult) | undefined;
  const output = { exports: undefined as unknown };
  runInNewContext(
    readFileSync(resolve(__dirname, '../../plugins/with-windows-cmake.cjs'), 'utf8'),
    {
      module: output,
      require: (name: string) => {
        if (name === 'node:process') return { platform };
        if (name !== 'expo/config-plugins') throw new Error(`Unexpected dependency: ${name}`);
        return {
          withGradleProperties: (config: object, action: (result: ModResult) => ModResult) => {
            mod = action;
            return config;
          },
        };
      },
    },
  );
  return {
    configure: output.exports as (config: object) => object,
    apply: (properties: Property[]) => {
      if (!mod) throw new Error('Gradle properties mod was not registered.');
      return mod({ modResults: properties }).modResults;
    },
    registered: () => Boolean(mod),
  };
}

describe('Windows native build tool selection', () => {
  it.each(['linux', 'darwin'])('keeps the platform defaults on %s', (platform) => {
    const plugin = loadPlugin(platform);
    const config = { name: 'Nivvi' };
    expect(plugin.configure(config)).toBe(config);
    expect(plugin.registered()).toBe(false);
  });

  it('replaces stale CMake selection once while preserving other settings across prebuilds', () => {
    const plugin = loadPlugin('win32');
    plugin.configure({ name: 'Nivvi' });
    const retained = [
      { type: 'comment', value: 'Retain user configuration' },
      { type: 'property', key: 'reactNativeArchitectures', value: 'arm64-v8a,x86_64' },
    ];
    const once = plugin.apply([
      ...retained,
      { type: 'property', key: 'android.cmakeVersion', value: '3.22.1' },
    ]);
    const twice = plugin.apply(once);
    expect(twice).toEqual([
      ...retained,
      { type: 'property', key: 'android.cmakeVersion', value: '4.1.2' },
    ]);
  });
});
