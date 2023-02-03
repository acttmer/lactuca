import {
  HTTPMethods,
  RawReplyDefaultExpression,
  RawRequestDefaultExpression,
  RawServerDefault,
  RouteHandler as FastifyRouteHandler,
} from 'fastify'
import { resolveUrlPaths } from '../../common/path'
import { Middleware } from './middleware'
import { usePlugin } from './plugin'
import { RouteSchema, RouteSchemaInterface } from './schema'

export type MiddlewareTrigger = 'preValidation' | 'preHandler'

export type Handler<S extends RouteSchema = RouteSchema> = FastifyRouteHandler<
  RouteSchemaInterface<S>,
  RawServerDefault,
  RawRequestDefaultExpression<RawServerDefault>,
  RawReplyDefaultExpression<RawServerDefault>
>

export type LazyCallback<T> = () => T
export type LazyCallbackOr<T> = LazyCallback<T> | T

export interface Route {
  url: string
  method: HTTPMethods
  schema?: LazyCallbackOr<RouteSchema>
  middlewareTrigger?: MiddlewareTrigger
  middlewares?: Middleware[]
  handler: Handler
}

export type MethodRoute<S extends RouteSchema> = {
  schema?: LazyCallbackOr<S>
  middlewareTrigger?: MiddlewareTrigger
  middlewares?: Middleware[]
  handler: Handler<S>
}

export interface RouterOptions {
  prefix?: string
  middlewares?: Middleware[]
}

export interface RouterRegisterOptions {
  middlewares?: Middleware[]
}

export class Router {
  private readonly prefix: string
  private readonly middlewares: Middleware[]
  private readonly routes: Route[]
  private readonly used: [string, Router][]

  constructor(opts: RouterOptions = {}) {
    this.prefix = opts.prefix ?? '/'
    this.middlewares = opts.middlewares ?? []
    this.routes = []
    this.used = []
  }

  compile() {
    return usePlugin<RouterRegisterOptions>((instance, opts, done) => {
      const { middlewares: extendedMiddlewares = [] } = opts
      const currentMiddlewares = [...extendedMiddlewares, ...this.middlewares]

      for (const route of this.routes) {
        const {
          url,
          method,
          schema,
          middlewareTrigger = 'preValidation',
          middlewares = [],
          handler,
        } = route

        instance.route({
          url,
          method,
          schema: typeof schema === 'function' ? schema() : schema,
          [middlewareTrigger]: [...currentMiddlewares, ...middlewares],
          handler,
        })
      }

      for (const [prefix, router] of this.used) {
        instance.register(router.compile(), {
          prefix,
          middlewares: currentMiddlewares,
        })
      }

      done()
    })
  }

  use(prefix: string, router: Router) {
    this.used.push([prefix, router])

    return this
  }

  add<S extends RouteSchema>(
    method: HTTPMethods,
    path: string,
    route: MethodRoute<S>,
  ) {
    const { schema, middlewareTrigger, middlewares, handler } = route

    this.routes.push({
      url: resolveUrlPaths(this.prefix, path),
      method,
      schema,
      middlewareTrigger,
      middlewares,
      handler,
    })

    return this
  }

  get<S extends RouteSchema>(route: MethodRoute<S>): this
  get<S extends RouteSchema>(path: string, route: MethodRoute<S>): this
  get<S extends RouteSchema>(
    pathOrRoute: string | MethodRoute<S>,
    route?: MethodRoute<S>,
  ) {
    return this.addWith('GET', pathOrRoute, route)
  }

  post<S extends RouteSchema>(route: MethodRoute<S>): this
  post<S extends RouteSchema>(path: string, route: MethodRoute<S>): this
  post<S extends RouteSchema>(
    pathOrRoute: string | MethodRoute<S>,
    route?: MethodRoute<S>,
  ) {
    return this.addWith('POST', pathOrRoute, route)
  }

  put<S extends RouteSchema>(route: MethodRoute<S>): this
  put<S extends RouteSchema>(path: string, route: MethodRoute<S>): this
  put<S extends RouteSchema>(
    pathOrRoute: string | MethodRoute<S>,
    route?: MethodRoute<S>,
  ) {
    return this.addWith('PUT', pathOrRoute, route)
  }

  patch<S extends RouteSchema>(route: MethodRoute<S>): this
  patch<S extends RouteSchema>(path: string, route: MethodRoute<S>): this
  patch<S extends RouteSchema>(
    pathOrRoute: string | MethodRoute<S>,
    route?: MethodRoute<S>,
  ) {
    return this.addWith('PATCH', pathOrRoute, route)
  }

  delete<S extends RouteSchema>(route: MethodRoute<S>): this
  delete<S extends RouteSchema>(path: string, route: MethodRoute<S>): this
  delete<S extends RouteSchema>(
    pathOrRoute: string | MethodRoute<S>,
    route?: MethodRoute<S>,
  ) {
    return this.addWith('DELETE', pathOrRoute, route)
  }

  head<S extends RouteSchema>(route: MethodRoute<S>): this
  head<S extends RouteSchema>(path: string, route: MethodRoute<S>): this
  head<S extends RouteSchema>(
    pathOrRoute: string | MethodRoute<S>,
    route?: MethodRoute<S>,
  ) {
    return this.addWith('HEAD', pathOrRoute, route)
  }

  options<S extends RouteSchema>(route: MethodRoute<S>): this
  options<S extends RouteSchema>(path: string, route: MethodRoute<S>): this
  options<S extends RouteSchema>(
    pathOrRoute: string | MethodRoute<S>,
    route?: MethodRoute<S>,
  ) {
    return this.addWith('OPTIONS', pathOrRoute, route)
  }

  private addWith<S extends RouteSchema>(
    method: HTTPMethods,
    pathOrRoute: string | MethodRoute<S>,
    route?: MethodRoute<S>,
  ) {
    if (typeof pathOrRoute === 'string') {
      if (!route) {
        throw new Error('route is undefined')
      }

      return this.add(method, pathOrRoute, route)
    } else {
      return this.add(method, '/', pathOrRoute)
    }
  }
}

export const useRouter = (opts: RouterOptions = {}) => new Router(opts)
