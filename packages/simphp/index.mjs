import { createRequire } from 'node:module';

const cjs = createRequire(import.meta.url)('./index.js');

export const { createSimPHP, cgiEnv } = cjs;
export const SimPHP = cjs.SimPHP;
export default cjs;
