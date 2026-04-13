const escape = require('escape-string-regexp');
const { getDefaultConfig } = require('@react-native/metro-config');
const fs = require('fs');
const path = require('path');

const config = getDefaultConfig(__dirname);
const root = path.resolve(__dirname, '..');
const rootPak = JSON.parse(
  fs.readFileSync(path.join(root, 'package.json'), 'utf8')
);

const modules = [
  '@babel/runtime',
  ...Object.keys({
    ...rootPak.devDependencies,
    ...rootPak.peerDependencies,
  }),
];

config.watchFolders = [root];

config.resolver.blockList = [
  new RegExp(`^${escape(path.join(root, 'node_modules'))}\\/.*$`),
];

config.resolver.extraNodeModules = {
  'react-native-background-workers': path.join(root, 'src'),
  ...modules.reduce((acc, name) => {
    acc[name] = path.join(__dirname, 'node_modules', name);
    return acc;
  }, {}),
};

module.exports = config;
