/**
 * Below are the colors that are used in the app. The colors are defined in the light and dark mode.
 * There are many other ways to style your app. For example, [Nativewind](https://www.nativewind.dev/), [Tamagui](https://tamagui.dev/), [unistyles](https://reactnativeunistyles.vercel.app), etc.
 */

import { Platform } from 'react-native';

// Paleta de colores de la morchella
const tintColorLight = '#6b5238'; // Marrón oscuro de morchella
const tintColorDark = '#d4a574'; // Beige claro de morchella

export const Colors = {
  light: {
    text: '#3d2817', // Marrón oscuro para texto
    background: '#f5ebe0', // Beige muy claro para fondo
    tint: tintColorLight,
    icon: '#6b5238', // Marrón oscuro para iconos
    tabIconDefault: '#b8956a', // Ocre para iconos no seleccionados
    tabIconSelected: tintColorLight,
  },
  dark: {
    text: '#d4a574', // Beige claro para texto en modo oscuro
    background: '#1a0f08', // Marrón muy oscuro para fondo
    tint: tintColorDark,
    icon: '#c9a068', // Beige para iconos
    tabIconDefault: '#8b6f47', // Ocre oscuro para iconos no seleccionados
    tabIconSelected: tintColorDark,
  },
};

export const Fonts = Platform.select({
  ios: {
    /** iOS `UIFontDescriptorSystemDesignDefault` */
    sans: 'system-ui',
    /** iOS `UIFontDescriptorSystemDesignSerif` */
    serif: 'ui-serif',
    /** iOS `UIFontDescriptorSystemDesignRounded` */
    rounded: 'ui-rounded',
    /** iOS `UIFontDescriptorSystemDesignMonospaced` */
    mono: 'ui-monospace',
  },
  default: {
    sans: 'normal',
    serif: 'serif',
    rounded: 'normal',
    mono: 'monospace',
  },
  web: {
    sans: "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
    serif: "Georgia, 'Times New Roman', serif",
    rounded: "'SF Pro Rounded', 'Hiragino Maru Gothic ProN', Meiryo, 'MS PGothic', sans-serif",
    mono: "SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace",
  },
});
