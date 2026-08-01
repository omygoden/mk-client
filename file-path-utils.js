(function attachFilePathUtils(globalScope) {
  function getSafeChildPath(parentDir, entryName) {
    if (
      typeof parentDir !== 'string' ||
      typeof entryName !== 'string' ||
      !entryName ||
      entryName.trim() !== entryName ||
      entryName === '.' ||
      entryName === '..' ||
      /[\\/\\\\\0]/.test(entryName)
    ) {
      return null;
    }

    const pathModule = typeof require === 'function' ? require('node:path') : null;
    if (!pathModule) return null;

    const resolvedParentDir = pathModule.resolve(parentDir);
    const resolvedChildPath = pathModule.resolve(resolvedParentDir, entryName);
    return pathModule.dirname(resolvedChildPath) === resolvedParentDir ? resolvedChildPath : null;
  }

  const api = { getSafeChildPath };
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }
  globalScope.FilePathUtils = api;
})(typeof globalThis === 'undefined' ? window : globalThis);
