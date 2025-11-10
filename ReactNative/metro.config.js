// metro.config.js
// React Native 0.80 기준 기본 설정

const {getDefaultConfig, mergeConfig} = require('@react-native/metro-config');

const defaultConfig = getDefaultConfig(__dirname);

// 필요 시 windows 플랫폼 확장자를 추가하고 싶다면 (보통 자동 처리됨)
// defaultConfig.resolver.platforms.push('windows');

module.exports = mergeConfig(defaultConfig, {
  // 커스텀 설정 넣을 거 없으면 비워둬도 됩니다.
});