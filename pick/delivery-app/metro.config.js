const path = require('node:path');
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);
const sharedMobileRoot = path.resolve(__dirname, '..', 'mobile');

config.watchFolders = [...(config.watchFolders || []), sharedMobileRoot];
config.resolver.disableHierarchicalLookup = true;
config.resolver.nodeModulesPaths = [
  path.resolve(__dirname, 'node_modules'),
  path.resolve(sharedMobileRoot, 'node_modules')
];

module.exports = config;
