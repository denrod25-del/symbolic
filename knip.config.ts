import type { KnipConfig } from 'knip';

const config: KnipConfig = {
  // Files to exclude from Knip analysis
  ignore: [
    'checkly.config.ts',
    'src/libs/I18n.ts',
    'src/types/I18n.ts',
    'src/components/Sponsors.tsx',
    'src/components/CounterForm.tsx',
    'src/components/DemoBadge.tsx',
    'src/components/DemoBanner.tsx',
    'src/components/LocaleSwitcher.tsx',
    'src/components/CurrentCount.tsx',
    'src/libs/ads.ts',
    'src/libs/Arcjet.ts',
    'src/libs/DB.ts',
    'src/libs/I18nNavigation.ts',
    'src/libs/Logger.ts',
    'src/validations/CounterValidation.ts',
    'tests/**/*.ts',
  ],
  // Dependencies to ignore during analysis
  ignoreDependencies: [
    '@commitlint/types',
    '@arcjet/next',
    '@hookform/resolvers',
    'react-hook-form',
    '@logtape/logtape',
    '@swc/helpers', // Avoid error in CI: "`npm ci` can only install packages when your package.json and package-lock.json or npm-shrinkwrap.json are in sync."
    'oxfmt',
    'oxlint-tsgolint',
    'postcss',
    'vite',
  ],
  // Binaries to ignore during analysis
  ignoreBinaries: [
    'production', // False positive raised with dotenv-cli
  ],
  compilers: {
    css: (text: string) => [...text.matchAll(/(?<=@)import[^;]+/g)].join('\n'),
  },
};

export default config;
