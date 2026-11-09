export default function languagePlugin() {
  let entry;
  const runtime = '\0game-language-runtime';
  const devRuntime = '\0game-language-dev-runtime';
  return {
    name: 'game-language',
    enforce: 'pre',
    configResolved(config) { entry = `${config.root}/src/language.ts`; },
    resolveId(id, importer) {
      if (id === 'react/jsx-runtime' && importer !== runtime) return runtime;
      if (id === 'react/jsx-dev-runtime' && importer !== devRuntime) return devRuntime;
    },
    load(id) {
      if (id !== runtime && id !== devRuntime) return;
      const moduleName = id === runtime ? 'react/jsx-runtime' : 'react/jsx-dev-runtime';
      const exports = id === runtime
        ? 'export const jsx = (type, props, key) => native.jsx(type, localizeProps(props), key); export const jsxs = (type, props, key) => native.jsxs(type, localizeProps(props), key);'
        : 'export const jsxDEV = (type, props, key, isStatic, location, self) => native.jsxDEV(type, localizeProps(props), key, isStatic, location, self);';
      return `import * as native from ${JSON.stringify(moduleName)}; import { localizeProps } from ${JSON.stringify(entry)}; export const Fragment = native.Fragment; ${exports}`;
    },
  };
}
