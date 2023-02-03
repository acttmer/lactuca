import { FastifySchema } from 'fastify'
import { Static, TSchema } from '../../common/schema'

type Maybe<T> = T extends TSchema ? Static<T> : unknown

export type RouteSchema = FastifySchema
export type RouteSchemaInterface<S extends RouteSchema> = {
  Params: Maybe<S['params']>
  Querystring: Maybe<S['querystring']>
  Body: Maybe<S['body']>
  Headers: Maybe<S['headers']>
  Reply: unknown
}
