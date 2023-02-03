import { flatMap } from 'lodash'
import {
  AggregateOptions,
  BulkWriteOptions,
  CountDocumentsOptions,
  CreateIndexesOptions,
  DeleteOptions,
  Document,
  EstimatedDocumentCountOptions,
  Filter,
  FindOneAndDeleteOptions,
  FindOneAndUpdateOptions,
  FindOptions,
  IndexSpecification,
  InsertOneOptions,
  NestedPaths,
  ObjectId,
  OptionalId,
  OptionalUnlessRequiredId,
  UpdateFilter,
  UpdateOptions,
  WithoutId,
} from 'mongodb'
import {
  arrayToMap,
  traversalGet,
  traversalReplace,
} from '../common/algorithms/collection'
import { ArrayOr, isEmpty, isNotEmpty, PromiseOr } from '../utils/helpers'
import { MongoConnectionManager } from './mongo'

export type IndexKeys<Model extends BaseModel> = {
  [key in ModelKeys<WithoutId<Model>>]?: 1 | -1 | '2d' | '2dsphere'
}

export type Index<Model extends BaseModel> =
  | [IndexKeys<Model>, CreateIndexesOptions]
  | [IndexKeys<Model>]
  | IndexKeys<Model>

export type ModelType<Model extends BaseModel = BaseModel> = VirtualModel<Model>
export type Ref<Model extends BaseModel> = Model | ObjectId

export interface BaseModel {
  _id: ObjectId
}

export interface Timestamps {
  createdAt: Date
  updatedAt: Date
}

export type NewDocument<T extends OmitRef<BaseModel>> = Omit<
  OptionalId<T>,
  keyof Timestamps
> &
  Partial<Timestamps>

export interface ExtraUpdateOptions {
  timestamps?: boolean
}

export interface PopulateItem<
  Model extends BaseModel,
  RefModel extends BaseModel,
> {
  model: VirtualModel<RefModel>
  path: ModelKeys<Model>
  select?: ModelKeys<RefModel>[]
  pipe?: (docs: RefModel[]) => PromiseOr<void>
}

type IndexJoin<T extends unknown[]> = T extends []
  ? ''
  : T extends [string | number]
  ? `${T[0]}`
  : T extends [string, ...infer R]
  ? `${T[0]}.${IndexJoin<R>}`
  : T extends [number, ...infer R]
  ? IndexJoin<R>
  : string

export type ModelKeys<T> =
  | Exclude<keyof T, number | symbol>
  | IndexJoin<NestedPaths<T, number[]>>

export type OmitRef<T extends BaseModel> = {
  [K in keyof T]: [T[K]] extends [unknown]
    ? T[K]
    : [T[K]] extends [Ref<infer _X>] | undefined
    ? ObjectId
    : T[K] extends Ref<infer _X>[] | undefined
    ? ObjectId[]
    : T[K]
}

export interface ModelInitOptions<Model extends BaseModel> {
  connectionName?: string
  name: string
  timestamps?: boolean
  sync?: boolean
  indexes?: Index<Model>[]
}

export class VirtualModel<
  Model extends BaseModel,
  FlatModel extends OmitRef<Model> = OmitRef<Model>,
> {
  private connectionName: string

  constructor(private opts: ModelInitOptions<Model>) {
    this.connectionName = opts.connectionName ?? 'default'

    MongoConnectionManager.listen(this.connectionName).onConnected(() => {
      if (this.opts.sync) {
        this.syncIndexes()
      }
    })
  }

  initializeOrderedBulkOp(opts?: BulkWriteOptions) {
    return this.collection.initializeOrderedBulkOp(opts)
  }

  initializeUnorderedBulkOp(opts?: BulkWriteOptions) {
    return this.collection.initializeUnorderedBulkOp(opts)
  }

  aggregate(pipeline: object[], opts?: AggregateOptions) {
    return this.collection.aggregate(pipeline, opts)
  }

  async create(doc: NewDocument<FlatModel>, opts: InsertOneOptions = {}) {
    if (this.opts.timestamps) {
      const now = new Date()

      if (!doc.hasOwnProperty('createdAt')) {
        Object.assign(doc, { createdAt: now })
      }

      if (!doc.hasOwnProperty('updatedAt')) {
        Object.assign(doc, { updatedAt: now })
      }
    }

    await this.collection.insertOne(
      doc as unknown as OptionalUnlessRequiredId<Model>,
      opts,
    )

    return doc as unknown as Model
  }

  async createMany(
    docs: NewDocument<FlatModel>[],
    opts: BulkWriteOptions = {},
  ) {
    if (this.opts.timestamps) {
      const now = new Date()

      for (const doc of docs) {
        if (!doc.hasOwnProperty('createdAt')) {
          Object.assign(doc, { createdAt: now })
        }

        if (!doc.hasOwnProperty('updatedAt')) {
          Object.assign(doc, { updatedAt: now })
        }
      }
    }

    await this.collection.insertMany(
      docs as unknown as OptionalUnlessRequiredId<Model>[],
      opts,
    )

    return docs as unknown as Model[]
  }

  find(filter: Filter<FlatModel> = {}, opts: FindOptions<FlatModel> = {}) {
    return this.collection.find(filter as Filter<Model>, opts)
  }

  findOne(filter: Filter<FlatModel>, opts: FindOptions<FlatModel> = {}) {
    return this.collection.findOne(filter as Filter<Model>, opts)
  }

  findById(_id: ObjectId, opts: FindOptions<FlatModel> = {}) {
    return this.findOne({ _id } as Filter<FlatModel>, opts)
  }

  async exists(cond: ArrayOr<ObjectId> | Filter<FlatModel>) {
    if (Array.isArray(cond)) {
      const items = await this.find(
        { _id: { $in: cond as any[] } },
        { projection: { _id: 1 } },
      ).toArray()

      return items.length === cond.length
    } else if (cond instanceof ObjectId) {
      const item = await this.findById(cond, {
        projection: { _id: 1 },
      })

      return item !== null
    } else {
      const item = await this.findOne(cond, {
        projection: { _id: 1 },
      })

      return item !== null
    }
  }

  updateOne(
    filter: Filter<FlatModel>,
    update: UpdateFilter<Model>,
    { timestamps = true, ...opts }: UpdateOptions & ExtraUpdateOptions = {},
  ) {
    if (this.opts.timestamps && timestamps) {
      this.updateTimestamps(update)
    }

    return this.collection.updateOne(
      filter as Filter<Model>,
      update as UpdateFilter<Model>,
      opts,
    )
  }

  updateById(
    _id: ObjectId,
    update: UpdateFilter<Model>,
    opts: UpdateOptions & ExtraUpdateOptions = {},
  ) {
    return this.updateOne({ _id } as Filter<FlatModel>, update, opts)
  }

  updateMany(
    filter: Filter<FlatModel>,
    update: UpdateFilter<Model>,
    { timestamps = true, ...opts }: UpdateOptions & ExtraUpdateOptions = {},
  ) {
    if (this.opts.timestamps && timestamps) {
      this.updateTimestamps(update)
    }

    return this.collection.updateMany(
      filter as Filter<Model>,
      update as UpdateFilter<Model>,
      opts,
    )
  }

  async findOneAndUpdate(
    filter: Filter<FlatModel>,
    update: UpdateFilter<Model>,
    {
      timestamps = true,
      ...opts
    }: FindOneAndUpdateOptions & ExtraUpdateOptions = {},
  ) {
    if (this.opts.timestamps && timestamps) {
      this.updateTimestamps(update)
    }

    const { value } = await this.collection.findOneAndUpdate(
      filter as Filter<Model>,
      update as UpdateFilter<Model>,
      opts,
    )

    return value
  }

  findByIdAndUpdate(
    _id: ObjectId,
    update: UpdateFilter<Model>,
    opts: FindOneAndUpdateOptions & ExtraUpdateOptions = {},
  ) {
    return this.findOneAndUpdate({ _id } as Filter<FlatModel>, update, opts)
  }

  deleteOne(filter: Filter<FlatModel>, opts: DeleteOptions = {}) {
    return this.collection.deleteOne(filter as Filter<Model>, opts)
  }

  deleteById(_id: ObjectId, opts: DeleteOptions = {}) {
    return this.deleteOne({ _id } as Filter<FlatModel>, opts)
  }

  deleteMany(filter: Filter<FlatModel>, opts: DeleteOptions = {}) {
    return this.collection.deleteMany(filter as Filter<Model>, opts)
  }

  async findOneAndDelete(
    filter: Filter<FlatModel>,
    opts: FindOneAndDeleteOptions = {},
  ) {
    const { value } = await this.collection.findOneAndDelete(
      filter as Filter<Model>,
      opts,
    )

    return value
  }

  findByIdAndDelete(_id: ObjectId, opts: FindOneAndDeleteOptions = {}) {
    return this.findOneAndDelete({ _id } as Filter<FlatModel>, opts)
  }

  countDocuments(
    filter: Filter<FlatModel> = {},
    opts: CountDocumentsOptions = {},
  ) {
    return this.collection.countDocuments(filter as Filter<Model>, opts)
  }

  estimatedDocumentCount(opts: EstimatedDocumentCountOptions = {}) {
    return this.collection.estimatedDocumentCount(opts)
  }

  async populate(docs: Model[], items: ArrayOr<PopulateItem<Model, any>>) {
    if (isEmpty(docs)) {
      return docs
    }

    // If the "populate" argument is an array, repeatly populate each of them
    if (Array.isArray(items)) {
      for (const item of items) {
        await this.populate(docs, item)
      }

      return docs
    }

    const { model, path, select = [], pipe } = items

    // Traverse all docs to get ref ids based on the "paths"
    const refIds = flatMap(docs, doc => traversalGet<ObjectId>(doc, path))

    if (isEmpty(refIds)) {
      return docs
    }

    const queryBuilder = model.aggregate([])

    // Query for ref docs by their _id
    queryBuilder.match({ _id: { $in: refIds } })

    // If "select" is not empty, transform it into a projection
    if (isNotEmpty(select)) {
      const projection: Document = {}

      for (const item of select) {
        projection[item] = 1
      }

      queryBuilder.project(projection)
    }

    // Fetch ref docs
    const refDocs = await queryBuilder.toArray()

    // Run the pipeline
    if (pipe) {
      await pipe(refDocs)
    }

    // Traverse all the docs and replace all ref ids with fetched ref docs
    if (isNotEmpty(refDocs)) {
      const refDocMap = arrayToMap(refDocs, '_id')

      for (const doc of docs) {
        traversalReplace(doc, refDocMap, path)
      }
    }

    return docs
  }

  async createIndex(index: Index<Model>) {
    if (Array.isArray(index)) {
      const [indexSpec, options = {}] = index

      await this.collection.createIndex(
        indexSpec as IndexSpecification,
        options,
      )
    } else {
      await this.collection.createIndex(index as IndexSpecification)
    }
  }

  async syncIndexes() {
    if (!this.opts.indexes) return

    for (const index of this.opts.indexes) {
      await this.createIndex(index)
    }
  }

  get collection() {
    return MongoConnectionManager.getClient(this.connectionName)
      .db()
      .collection<Model>(this.opts.name)
  }

  private updateTimestamps(update: UpdateFilter<Model>) {
    if (update.$set) {
      if (!update.$set.hasOwnProperty('updatedAt')) {
        Object.assign(update.$set, {
          updatedAt: new Date(),
        })
      }
    } else {
      Object.assign(update, {
        $set: {
          updatedAt: new Date(),
        },
      })
    }
  }
}

export const useModel = <Model extends BaseModel>(
  opts: ModelInitOptions<Model>,
): ModelType<Model> => new VirtualModel(opts)
