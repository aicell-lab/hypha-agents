module.exports = function override(config, env) {
  // Add fallback for node core modules
  config.resolve.fallback = {
    ...config.resolve.fallback,
    stream: require.resolve('stream-browserify'),
    buffer: require.resolve('buffer'),
    util: require.resolve('util'),
    process: require.resolve('process/browser'),
    assert: require.resolve('assert/'),
  };

  // Add plugins if needed
  config.plugins = [
    ...config.plugins,
  ];

  return config;
}; 