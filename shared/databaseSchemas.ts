import { createSchemaFactory } from '@zenstackhq/zod'

import { schema } from '../generated/zenstack/schema'

const schemaFactory = createSchemaFactory(schema)

export const ArticleUpdateSchema = schemaFactory.makeModelSchema('Article', { optionality: 'all' })
// Only what a commenter may set; the model's required `userId` comes from the session, not the body.
export const CommentCreateSchema = schemaFactory
  .makeModelSchema('Comment', { optionality: 'defaults' })
  .pick({ content: true, gifUrl: true, articleId: true, parentId: true })
export const CommentReactionSchema = schemaFactory.makeModelSchema('CommentReaction')
export const TagCreateSchema = schemaFactory.makeModelSchema('Tag', { optionality: 'defaults' })

export const models = {
  ClientSiteScalarSchema: schemaFactory.makeModelSchema('ClientSite'),
}
