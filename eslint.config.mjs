/** @type {import('eslint').Linter.Config[]} */
const config = [
  {
    ignores: [".next/**", "node_modules/**", "public/vendor/**", "storage/**"],
  },
];

export default config;
