import nextVitals from "eslint-config-next/core-web-vitals";
import nextTypescript from "eslint-config-next/typescript";

const eslintConfig = [
  {
    ignores: ["node_modules/**", ".next/**", "coverage/**", "borrar/**"],
  },
  ...nextVitals,
  ...nextTypescript,
];

export default eslintConfig;
