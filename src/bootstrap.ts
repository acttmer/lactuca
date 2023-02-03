import { MongoInitOptions, useMongo } from './db/mongo'
import { FileTreeRouter } from './features/file-tree-router'
import { Router } from './http/core/router'
import { ServerInitOptions, useHttpServer } from './http/server'

export interface LactucaInitOptions {
  app: {
    name: string
    version: string | number
  }
  httpServer: {
    port: number
    host: string
    options?: ServerInitOptions
    router?: Router
    fileTreeRouter?: FileTreeRouter
  }
  mongo?: {
    url: string
    options?: MongoInitOptions
  }
}

export const useLactuca = async (opts: LactucaInitOptions) => {
  console.log(`${opts.app.name} (${opts.app.version})`)
  console.log('Powered by Lactuca\n')

  const httpServer = await useHttpServer(opts.httpServer.options)

  if (opts.mongo) {
    await useMongo(opts.mongo.url, opts.mongo.options)

    console.log('- Established database connection')
  }

  const { router, fileTreeRouter, port, host } = opts.httpServer

  if (router) {
    await httpServer.use(router)
  }

  if (fileTreeRouter) {
    await httpServer.use(await fileTreeRouter.compile())
  }

  console.log('- Mounted routes')

  httpServer.listen({ port, host }, () => {
    console.log(`- Listening ${host}:${port}`)
  })
}
