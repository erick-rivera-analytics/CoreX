import nextVitals from "eslint-config-next/core-web-vitals";
import nextTypescript from "eslint-config-next/typescript";

const eslintConfig = [
  {
    ignores: ["node_modules/**", ".next/**", "coverage/**", "borrar/**", ".claude/worktrees/**"],
  },
  ...nextVitals,
  ...nextTypescript,
];

export default eslintConfig;
