// ESLint（V1 Q8，D-283）：主要用來守分層邊界（design/24 §8、25 §4），另外開少量抓 bug 的規則。
// 邊界也有 vitest 掃描（tests/core-boundary、tests/layer-boundary）；ESLint 讓編輯器當場就看到。
import tseslint from 'typescript-eslint';

const deny = (group, message) => ['error', { patterns: [{ group, message }] }];

export default tseslint.config(
  { ignores: ['dist/**', 'dist-server/**', 'dist-online/**', 'dev-dist/**', 'android/**', 'ios/**', 'node_modules/**', 'screenshots/**', 'scripts/**', 'public/**'] },
  {
    files: ['src/**/*.ts', 'tests/**/*.ts', 'server/**/*.ts'],
    languageOptions: { parser: tseslint.parser },
    plugins: { '@typescript-eslint': tseslint.plugin },
    rules: {
      'no-debugger': 'error',
      'no-dupe-keys': 'error',
      'no-self-assign': 'error',
      'no-unsafe-finally': 'error',
      'no-cond-assign': ['error', 'except-parens'],
      '@typescript-eslint/no-unused-vars': ['error', { args: 'none', varsIgnorePattern: '^_', caughtErrors: 'none' }],
    },
  },
  {
    files: ['src/core/**/*.ts'],
    rules: {
      'no-restricted-imports': deny(['phaser', '**/game/**', '**/server/**', '**/client/**', '**/net/**', '**/audio/**', '**/i18n/**'], 'src/core 只能 import src/core（純規則、確定性）'),
      'no-restricted-properties': [
        'error',
        ...['random', 'sin', 'cos', 'tan', 'asin', 'acos', 'atan', 'atan2', 'exp', 'pow', 'log', 'hypot'].map((property) => ({ object: 'Math', property, message: '核心用 src/core/fixedMath.ts（D-280）' })),
        { object: 'Date', property: 'now', message: '核心不准讀時間' },
      ],
      'no-restricted-globals': ['error', 'localStorage', 'indexedDB', 'window', 'document', 'performance'],
    },
  },
  {
    files: ['src/server/**/*.ts'],
    rules: {
      'no-restricted-imports': deny(['phaser', '**/game/**', '**/client/**', '**/audio/**', '**/i18n/**'], 'src/server 不准 import Phaser／game／client（要能原封不動放到 Node）'),
      'no-restricted-globals': ['error', 'window', 'document'],
    },
  },
  {
    files: ['src/net/**/*.ts'],
    rules: { 'no-restricted-imports': deny(['phaser', '**/game/**', '**/client/**', '**/server/**', '**/core/**'], 'src/net 只放協定與傳輸') },
  },
  {
    files: ['src/game/**/*.ts', 'src/audio/**/*.ts'],
    rules: { 'no-restricted-imports': deny(['**/server/**'], '畫面層只能透過 GameClient 呼叫伺服器（鐵律 1）') },
  },
);
