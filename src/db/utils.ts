import { reduce } from 'lodash'
import { Document, Filter, ObjectId } from 'mongodb'
import { isNullOrUndefined } from '../utils/helpers'
import { BaseModel, OmitRef, PopulateItem, Ref } from './model'

export const usePopulateItem = <
  Model extends BaseModel,
  RefModel extends BaseModel,
>(
  item: PopulateItem<Model, RefModel>,
) => item

export const fieldsToProjection = (fields: string[]) => {
  return reduce(
    fields,
    (prev, curr) => {
      prev[curr] = 1
      return prev
    },
    {} as Document,
  )
}

export const asFilter = <Model extends BaseModel>(filter: Document) => {
  return filter as Filter<OmitRef<Model>>
}

function asObjectId<T extends BaseModel>(ref: Ref<T>): ObjectId
function asObjectId<T extends BaseModel>(ref?: Ref<T>): ObjectId | undefined
function asObjectId<T extends BaseModel>(ref?: Ref<T>) {
  if (isNullOrUndefined(ref)) {
    return undefined
  }

  if (ref instanceof ObjectId) {
    return ref
  }

  return ref._id
}

function asDoc<T extends BaseModel>(ref: Ref<T>): T
function asDoc<T extends BaseModel>(ref?: Ref<T>): T | undefined
function asDoc<T extends BaseModel>(ref?: Ref<T>) {
  if (isNullOrUndefined(ref)) {
    return undefined
  }

  if (ref instanceof ObjectId) {
    return { _id: ref } as T
  }

  return ref
}

export { asObjectId, asDoc }
