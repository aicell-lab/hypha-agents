const webpack = require('webpack');

module.exports = function override(config, env) {
  // Add fallback for node core modules
  config.resolve.fallback = {
    ...config.resolve.fallback,
    stream: require.resolve('stream-browserify'),
    buffer: require.resolve('buffer'),
    util: require.resolve('util'),
    process: require.resolve('process/browser'),
    assert: require.resolve('assert/'),
    events: require.resolve('events/'),
    path: require.resolve('path-browserify'),
  };

  // Production optimizations
  if (env === 'production') {
    // Disable source maps for faster builds
    config.devtool = false;
    
    // Optimize chunk splitting for better caching
    config.optimization = {
      ...config.optimization,
      splitChunks: {
        chunks: 'all',
        maxInitialRequests: 10,
        maxAsyncRequests: 10,
        cacheGroups: {
          default: {
            minChunks: 2,
            priority: -20,
            reuseExistingChunk: true,
          },
          vendor: {
            test: /[\\/]node_modules[\\/]/,
            name: 'vendors',
            priority: -10,
            chunks: 'all',
          },
          monaco: {
            test: /[\\/]node_modules[\\/](@monaco-editor|monaco-editor)[\\/]/,
            name: 'monaco',
            priority: 20,
            chunks: 'all',
          },
          thebe: {
            test: /[\\/]node_modules[\\/](thebe-|@jupyterlite)[\\/]/,
            name: 'thebe',
            priority: 20,
            chunks: 'all',
          },
          react: {
            test: /[\\/]node_modules[\\/](react|react-dom)[\\/]/,
            name: 'react',
            priority: 20,
            chunks: 'all',
          },
        },
      },
      // Minimize only in production
      minimize: true,
    };

    // Reduce bundle analysis overhead
    config.performance = {
      maxAssetSize: 2000000, // 2MB
      maxEntrypointSize: 2000000, // 2MB
      hints: 'warning',
    };
  }

  // Enable filesystem caching for faster rebuilds
  config.cache = {
    type: 'filesystem',
    buildDependencies: {
      config: [__filename],
    },
  };

  // Optimize module resolution
  config.resolve = {
    ...config.resolve,
    modules: ['node_modules'],
    extensions: ['.js', '.jsx', '.ts', '.tsx', '.json'],
  };

  // Add plugins
  config.plugins = [
    ...config.plugins,
    // Define environment variables
    new webpack.DefinePlugin({
      'process.env.NODE_ENV': JSON.stringify(env),
    }),
  ];

  return config;
}; 