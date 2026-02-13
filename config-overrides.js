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

  // Ignore specific source map warnings
  config.ignoreWarnings = [
    // Ignore source map warnings for hypha-core
    /Failed to parse source map.*hypha-core.*utf8\.mjs\.map/,
    // Ignore source map warnings for hypha-rpc
    /Failed to parse source map.*hypha-rpc.*utf8\.mjs\.map/,
    // Ignore source map warnings for imjoy-rpc
    /Failed to parse source map.*imjoy-rpc.*utf8\.mjs\.map/,
    // Ignore source map warnings for monaco-editor marked
    /Failed to parse source map.*monaco-editor.*marked.*\.js\.map/,
  ];

  // Optimize module resolution
  config.resolve = {
    ...config.resolve,
    modules: ['node_modules'],
    extensions: ['.js', '.jsx', '.ts', '.tsx', '.json'],
  };

  // Configure source-map-loader to ignore warnings for problematic packages
  config.module = {
    ...config.module,
    rules: [
      ...config.module.rules,
      {
        test: /\.(js|mjs)$/,
        enforce: 'pre',
        use: [
          {
            loader: 'source-map-loader',
            options: {
              filterSourceMappingUrl: (url, resourcePath) => {
                // Ignore source map warnings for hypha-core, hypha-rpc, imjoy-rpc and monaco-editor
                if (resourcePath.includes('hypha-core') || 
                    resourcePath.includes('hypha-rpc') || 
                    resourcePath.includes('imjoy-rpc') || 
                    resourcePath.includes('monaco-editor')) {
                  return false;
                }
                return true;
              },
            },
          },
        ],
        exclude: [
          // Exclude problematic packages from source map processing
          /node_modules\/hypha-core/,
          /node_modules\/hypha-rpc/,
          /node_modules\/imjoy-rpc/,
          /node_modules\/monaco-editor.*marked/,
        ],
      },
    ],
  };

  // Add plugins
  config.plugins = [
    ...config.plugins,
    // Define environment variables
    new webpack.DefinePlugin({
      'process.env.NODE_ENV': JSON.stringify(env),
    }),
    // Ignore missing source map warnings for specific modules
    new webpack.IgnorePlugin({
      checkResource(resource, context) {
        // Ignore source map files for hypha-core, hypha-rpc, imjoy-rpc and monaco-editor marked
        if (resource.endsWith('.map') && 
            (context.includes('hypha-core') || 
             context.includes('hypha-rpc') || 
             context.includes('imjoy-rpc') || 
             context.includes('monaco-editor') && context.includes('marked'))) {
          return true;
        }
        return false;
      },
    }),
  ];

  return config;
}; 