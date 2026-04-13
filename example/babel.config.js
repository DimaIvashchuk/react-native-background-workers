const path = require('path');

const root = path.resolve(__dirname, '..');

module.exports = {
  presets: ['module:@react-native/babel-preset'],
  plugins: [
    path.resolve(root, 'plugin'),
    'react-native-worklets/plugin',
  ],
};
