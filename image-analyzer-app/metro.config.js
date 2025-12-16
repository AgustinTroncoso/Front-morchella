const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// Asegurarse de que Metro trate `.tflite` como asset para que `require('./file.tflite')`
// funcione correctamente.
if (config.resolver && Array.isArray(config.resolver.assetExts)) {
  if (!config.resolver.assetExts.includes('tflite')) {
    config.resolver.assetExts.push('tflite');
  }
}

module.exports = config;
