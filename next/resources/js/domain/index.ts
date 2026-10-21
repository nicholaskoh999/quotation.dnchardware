/* QUOTATION NEXT domain engine — public API.

   Pure, framework-free TypeScript (handoff §1, §9). Desktop and mobile share
   this one engine; React components call it and never re-implement a rule.
   Verified against the R0b golden fixtures (fixtures/golden). See NOTES.md for
   coverage, open gates and deviations. */

export * from './numbers';
export * from './products';
export * from './rounding';
export * from './size';
export * from './material';
export * from './diameter';
export * from './weight';
export * from './geometry';
export * from './defaults';
export * from './accessories';
export * from './pricing';
export * from './sagrod';
export * from './description';
