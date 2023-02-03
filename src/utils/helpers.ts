export type ArrayOr<T> = T | T[]
export type PromiseOr<T> = T | Promise<T>

export const isNullOrUndefined = <T>(x?: T): x is undefined =>
  x === undefined || x === null

export const isEmpty = <T>(list: T[]) => list.length === 0
export const isNotEmpty = <T>(
  arr: T[],
): arr is {
  pop(): T
  shift(): T
} & Array<T> => {
  return arr.length > 0
}

export const sleep = (ms: number) =>
  new Promise(resolve => setTimeout(resolve, ms))
