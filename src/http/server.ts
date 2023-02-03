import fastifyCookie, { FastifyCookieOptions } from '@fastify/cookie'
import fastifyCors, { FastifyCorsOptions } from '@fastify/cors'
import fastify, { FastifyInstance, FastifyServerOptions } from 'fastify'
import { Plugin, PluginOptions, PluginRegisterOptions } from './core/plugin'
import { Router, RouterRegisterOptions } from './core/router'
import extendAjv from './validation/ajv'

declare module 'fastify' {
  interface RequestState {}

  interface FastifyRequest {
    state: RequestState
  }
}

export type {
  FastifyReply as Response,
  FastifyRequest as Request,
} from 'fastify'

export type CorsOptions = FastifyCorsOptions | boolean
export type CookieOptions = FastifyCookieOptions | boolean

export interface ServerInitOptions extends Omit<FastifyServerOptions, 'ajv'> {
  cors?: CorsOptions
  cookie?: CookieOptions
}

export interface ServerRegisterFn<T = ReturnType<FastifyInstance['register']>> {
  <Options extends PluginOptions>(
    plugin: Plugin<Options>,
    opts?: PluginRegisterOptions<Options>,
  ): T
  (router: Router, opts?: PluginRegisterOptions<RouterRegisterOptions>): T
}

export interface ServerInstance {
  fast: FastifyInstance
  listen: FastifyInstance['listen']
  use: ServerRegisterFn
  decorateRequest: FastifyInstance['decorateRequest']
  decorateResponse: FastifyInstance['decorateReply']
  addHook: FastifyInstance['addHook']
  addSchema: FastifyInstance['addSchema']
}

export const useHttpServer = async ({
  cors = false,
  cookie = false,
  ...opts
}: ServerInitOptions = {}): Promise<ServerInstance> => {
  // Create a fastify instance
  const fast = fastify({
    logger: false,
    caseSensitive: true,
    ignoreTrailingSlash: true,
    ajv: {
      plugins: [extendAjv],
    },
    ...opts,
  })

  // Enable cors or not
  if (cors) {
    await fast.register(fastifyCors, cors === true ? {} : cors)
  }

  // Enable cookie or not
  if (cookie) {
    await fast.register(fastifyCookie, cookie === true ? {} : cookie)
  }

  // Decorate request for state
  fast.decorateRequest('state', null)

  // Implement onRequest hook
  fast.addHook('onRequest', (req, _, next) => {
    // Patch for DELETE method
    if (req.method === 'DELETE' || req.method == 'delete') {
      if (req.headers['content-type']) {
        delete req.headers['content-type']
      }
    }

    // Set initial request state
    req.state = {}

    next()
  })

  const use: ServerRegisterFn = (
    target: Plugin | Router,
    opts?: PluginRegisterOptions<PluginOptions | RouterRegisterOptions>,
  ) => {
    if (target instanceof Router) {
      return fast.register(target.compile(), opts)
    } else {
      return fast.register(target, opts)
    }
  }

  return {
    fast,
    listen: fast.listen.bind(fast),
    use,
    decorateRequest: fast.decorateRequest.bind(fast),
    decorateResponse: fast.decorateReply.bind(fast),
    addHook: fast.addHook.bind(fast),
    addSchema: fast.addSchema.bind(fast),
  }
}
