module.exports = {
    src: [
      "./src/"
    ],
    mode: "file",
    theme: "minimal",
    includeDeclarations: false,
    tsconfig: "tsconfig.json",
    out: "./Documentation",
    excludePrivate: true,
    excludeProtected: false,
    excludeExternals: true,
    excludeNotExported: false,
    readme: "README.md",
    name: `React Input Form Validation`,
    ignoreCompilerErrors: true,
    plugin: "none",
    listInvalidSymbolLinks: true,
    hideGenerator: true,
    verbose: true
  };
