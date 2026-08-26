module.exports = {
  preset: 'react-native',
  transformIgnorePatterns: [
    'node_modules/(?!(react-native|@react-native|expo|@react-navigation)/)'
  ],
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json']
};
