module.exports = {
  env: {
    browser: true,
    es6: true,
    node: true,
  },
  parserOptions: {
    "ecmaVersion": 2022,
    "sourceType": "module",
  },
  extends: [
    "eslint:recommended",
  ],
  rules: {
    "no-unused-vars": "warn",
    "no-console": "off",
    "quotes": ["error", "single", {"allowTemplateLiterals": true}],
    "semi": ["error", "always"],
  },
  overrides: [
    {
      files: ["functions/**/*.js"],
      env: {
        node: true,
        browser: false,
      },
      parserOptions: {
        "ecmaVersion": 2018,
        "sourceType": "script",
      },
      extends: [
        "eslint:recommended",
        "google",
      ],
      rules: {
        "no-restricted-globals": ["error", "name", "length"],
        "prefer-arrow-callback": "error",
        "quotes": ["error", "double", {"allowTemplateLiterals": true}],
      },
    },
    {
      files: ["**/public/js/*.js", "**/functions/public/js/*.js"],
      env: {
        browser: true,
        node: false,
      },
      parserOptions: {
        "ecmaVersion": 2022,
        "sourceType": "module",
      },
      rules: {
        "no-undef": "off", // Allow global variables in browser
        "quotes": ["error", "single", {"allowTemplateLiterals": true}],
      },
    },
  ],
  globals: {},
};