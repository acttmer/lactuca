import { BaseModel, ModelType, TimestampsModel, useModel } from '../db/model'
import { sleep } from '../utils/helpers'
import { TooManyRequests } from '../utils/http-errors'

export interface Mutex extends BaseModel, TimestampsModel {
  name: string
  expiresAt?: Date
}

export interface MutexLockOptions {
  expiresIn?: number
  retry?: boolean
  retryInterval?: number
}

export interface MutexInitOptions {
  name?: string
  defaults?: MutexLockOptions
}

export class MutexManager {
  private model: ModelType<Mutex>

  constructor(private opts: MutexInitOptions) {
    this.model = useModel<Mutex>({
      name: opts.name ?? 'mutex',
      timestamps: true,
      sync: true,
      indexes: [
        [{ name: 1 }, { unique: true }],
        [{ expiresAt: 1 }, { expireAfterSeconds: 0, sparse: true }],
      ],
    })
  }

  async accquire(name: string, opts: MutexLockOptions = {}) {
    const { defaults = {} } = this.opts

    const expiresIn = opts.expiresIn ?? defaults.expiresIn
    const retry = opts.retry ?? defaults.retry ?? true
    const retryInterval = opts.retryInterval ?? defaults.retryInterval ?? 1000

    while (true) {
      try {
        if (expiresIn) {
          await this.model.create({
            name,
            expiresAt: new Date(Date.now() + expiresIn),
          })
        } else {
          await this.model.create({ name })
        }

        break
      } catch {
        if (!retry) {
          throw new TooManyRequests('failed to accquire mutex')
        }

        await sleep(retryInterval)
      }
    }
  }

  async protect<T>(
    name: string,
    cb: () => T | Promise<T>,
    opts: MutexLockOptions = {},
  ) {
    await this.accquire(name, opts)

    const result = await cb()

    await this.release(name)

    return result
  }

  async release(name: string) {
    await this.model.deleteOne({ name })
  }
}

export const useMutexManager = (opts: MutexInitOptions) =>
  new MutexManager(opts)
