/* eslint-disable @typescript-eslint/no-explicit-any */
export type ParamsOf<T extends (...params: readonly any[]) => any> = T extends (
  ...params: infer P
) => any
  ? P
  : never;
