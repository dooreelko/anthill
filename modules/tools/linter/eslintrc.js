path = require('path');

module.exports = (dir) => ({
    root: true,
    env: {
        browser: false,
        node: true,
        es2021: true
    },
    extends: 'standard-with-typescript',
    parserOptions: {
        project: path.join(dir, './tsconfig.json'),
        // project: './tsconfig.json',
        ecmaVersion: 'latest'
    },
    rules: {
        indent: ['error', 4],
        '@typescript-eslint/indent': ['error', 4],
        'eol-last': 'off',
        '@typescript-eslint/explicit-function-return-type': 'off',
        semi: 'off',
        '@typescript-eslint/semi': ['error', 'always'],
        '@typescript-eslint/strict-boolean-expressions': 'off',
        // aws cdk uses this extensively
        'no-new': 'off',
        '@typescript-eslint/consistent-type-definitions': ["error", "type"],
        "@typescript-eslint/member-delimiter-style": ["error", {
            "multiline": {
                "delimiter": "semi",
                "requireLast": true
            },
            "singleline": {
                "delimiter": "semi",
                "requireLast": false
            },
            "multilineDetection": "brackets"
        }]
    },
    ignorePatterns: [
        '**/dist/**',
        '**/build/**',
        '**/node_modules/**',
        '**/*.test.{js,jsx,ts,tsx}',
        '**/*.spec.{js,jsx,ts,tsx}',
        '**/config-overrides.js',
        '*.d.ts',
        '*.js'
    ]
});