import { MongoClient, MongoClientOptions } from 'mongodb'

export { ObjectId } from 'mongodb'

export type MongoInitOptions = MongoClientOptions & {
  connectionName?: string
}

export class MongoConnectionManager {
  private static connections: Record<string, MongoClient> = {}
  private static onConnectedCallbacks: Record<string, (() => void)[]> = {}

  static getClient(connectionName = 'default') {
    if (!this.connections[connectionName]) {
      throw new Error('Mongo connection has not been established')
    }

    return this.connections[connectionName]
  }

  static listen(connectionName: string) {
    return {
      onConnected: (callback: () => void) => {
        if (connectionName in this.connections) {
          callback()
        } else {
          this.onConnectedCallbacks[connectionName] ??= []
          this.onConnectedCallbacks[connectionName].push(callback)
        }
      },
    }
  }

  static async connect(url: string, opts: MongoInitOptions = {}) {
    const connectionName = opts.connectionName ?? 'default'
    const client = await MongoClient.connect(url, opts)

    this.connections[connectionName] = client

    if (connectionName in this.onConnectedCallbacks) {
      for (const callback of this.onConnectedCallbacks[connectionName]) {
        callback()
      }
    }

    return client
  }
}

export const useMongo = (url: string, opts: MongoInitOptions = {}) =>
  MongoConnectionManager.connect(url, opts)
