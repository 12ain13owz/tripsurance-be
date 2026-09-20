import type { Request } from 'express'
import type { z, ZodType } from 'zod'

/** Route schema group — each key is an optional Zod schema for that request segment */
export type ValidatedShape = {
  params?: ZodType
  query?: ZodType
  body?: ZodType
}

/** Infer plain types from a grouped route schema (only segments that exist) */
export type InferValidated<T extends ValidatedShape> = {
  [K in keyof T & ('params' | 'query' | 'body')]: T[K] extends ZodType ? z.infer<T[K]> : never
}

type HasSegmentKey<T> = 'params' extends keyof T
  ? true
  : 'query' extends keyof T
    ? true
    : 'body' extends keyof T
      ? true
      : false

type ValidatedRequestFromSegments<T> = Request<
  'params' extends keyof T ? T['params'] : Record<string, string>,
  unknown,
  'body' extends keyof T ? T['body'] : unknown,
  'query' extends keyof T ? T['query'] : Record<string, unknown>
>

/** Express `Request` whose segments have already been validated by the `validate` middleware. */
export type ValidatedRequest<T> =
  HasSegmentKey<T> extends true
    ? ValidatedRequestFromSegments<T>
    : Request<Record<string, string>, unknown, T>

/**
 * Request type for one entry of a feature's schema map — e.g. `ReqOf<typeof authSchema, 'login'>`.
 * Replaces hand-written per-endpoint Req aliases; adding a schema entry gives the type for free.
 */
export type ReqOf<
  TMap extends Record<string, ValidatedShape>,
  K extends keyof TMap,
> = ValidatedRequest<InferValidated<TMap[K]>>
