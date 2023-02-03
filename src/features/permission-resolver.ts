import { makeArray } from '../common/algorithms/collection'
import { Forbidden } from '../utils/http-errors'

export interface PermissionPreset {
  name: string
  description?: string
  extends?: string[]
}

export type PermissionMatchMethod = 'has' | 'hasAnyOf' | 'hasAllOf'

export interface PermissionMatchStrategy {
  method: PermissionMatchMethod
  queries: string[]
  cond: boolean
}

export class PermissionMatchBuilder {
  private condition = true

  constructor(
    private method: PermissionMatchMethod,
    private queries: string | string[],
  ) {}

  cond(condition: boolean) {
    this.condition = condition
    return this
  }

  build(): PermissionMatchStrategy {
    return {
      method: this.method,
      queries: makeArray(this.queries),
      cond: this.condition,
    }
  }
}

export type PermissionMatchCallback = (params: {
  has: (query: string) => PermissionMatchBuilder
  hasAnyOf: (queries: string[]) => PermissionMatchBuilder
  hasAllOf: (queries: string[]) => PermissionMatchBuilder
  cond: (condition: boolean) => boolean
}) => (PermissionMatchBuilder | boolean)[]

export class PermissionValidator {
  private throwError: boolean

  constructor(private permissionSet: Set<string>) {
    this.throwError = false
  }

  has(query: string) {
    const result = this.permissionSet.has(query)

    if (this.throwError && !result) {
      throw new Forbidden('missing permissions')
    }

    return result
  }

  hasAnyOf(queries: string[]) {
    for (const query of queries) {
      if (this.permissionSet.has(query)) {
        return true
      }
    }

    if (this.throwError) {
      throw new Forbidden('missing permissions')
    }

    return false
  }

  hasAllOf(queries: string[]) {
    for (const query of queries) {
      if (!this.permissionSet.has(query)) {
        if (this.throwError) {
          throw new Forbidden('missing permissions')
        }

        return false
      }
    }

    return true
  }

  guard() {
    this.throwError = true
    return this
  }

  matchOne(cb: PermissionMatchCallback) {
    const strategies = cb({
      has: query => new PermissionMatchBuilder('has', query),
      hasAnyOf: queries => new PermissionMatchBuilder('hasAnyOf', queries),
      hasAllOf: queries => new PermissionMatchBuilder('hasAnyOf', queries),
      cond: condition => condition,
    })

    for (const strategy of strategies) {
      if (typeof strategy === 'boolean') {
        if (strategy) {
          return true
        }

        continue
      }

      const { method, queries, cond } = strategy.build()

      if (!cond) {
        continue
      }

      const result = (() => {
        switch (method) {
          case 'has':
            return this.has(queries[0])
          case 'hasAnyOf':
            return this.hasAnyOf(queries)
          case 'hasAllOf':
            return this.hasAllOf(queries)
        }
      })()

      if (result) {
        return true
      }
    }

    if (this.throwError) {
      throw new Forbidden('missing permissions')
    }

    return false
  }

  matchAll(cb: PermissionMatchCallback) {
    const strategies = cb({
      has: query => new PermissionMatchBuilder('has', [query]),
      hasAnyOf: queries => new PermissionMatchBuilder('hasAnyOf', queries),
      hasAllOf: queries => new PermissionMatchBuilder('hasAnyOf', queries),
      cond: condition => condition,
    })

    for (const strategy of strategies) {
      if (typeof strategy === 'boolean') {
        if (!strategy) {
          if (this.throwError) {
            throw new Forbidden('missing permissions')
          }

          return false
        }

        continue
      }

      const { method, queries, cond } = strategy.build()

      if (!cond) {
        if (this.throwError) {
          throw new Forbidden('missing permissions')
        }

        return false
      }

      const result = (() => {
        switch (method) {
          case 'has':
            return this.has(queries[0])
          case 'hasAnyOf':
            return this.hasAnyOf(queries)
          case 'hasAllOf':
            return this.hasAllOf(queries)
        }
      })()

      if (!result) {
        if (this.throwError) {
          throw new Forbidden('missing permissions')
        }

        return false
      }
    }

    return true
  }
}

export class PermissionResolver {
  constructor(private presets: PermissionPreset[]) {}

  list() {
    return this.presets
  }

  take(permissions: string[]) {
    const permissionSet = new Set<string>()

    const walk = (items: string[]) => {
      for (const item of items) {
        const source = this.presets.find(preset => preset.name === item)

        if (source) {
          permissionSet.add(item)

          if (source.extends) {
            walk(source.extends)
          }
        }
      }
    }

    walk(permissions)

    return new PermissionValidator(permissionSet)
  }
}

export const usePermissionResolver = (presets: PermissionPreset[]) =>
  new PermissionResolver(presets)
