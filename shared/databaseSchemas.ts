import { createSchemaFactory } from '@zenstackhq/zod'

import { schema } from '../generated/zenstack/schema'

const schemaFactory = createSchemaFactory(schema)

export const ArticleUpdateSchema = schemaFactory.makeModelSchema('Article', { optionality: 'all' })
export const CommentCreateSchema = schemaFactory.makeModelSchema('Comment', { optionality: 'defaults' })
export const CommentReactionSchema = schemaFactory.makeModelSchema('CommentReaction')
export const TagCreateSchema = schemaFactory.makeModelSchema('Tag', { optionality: 'defaults' })

export const models = {
  ClientSiteScalarSchema: schemaFactory.makeModelSchema('ClientSite'),
}
