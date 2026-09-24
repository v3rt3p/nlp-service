import { z } from 'zod'

export const functionArgumentConstraint = z.object({
  argumentType: z.enum(['number', 'string']),
  max: z.number().optional(),
  min: z.number().optional(),
  type: z.string(),
  variants: z.array(z.object({
    description: z.string(),
    value: z.union([z.number(), z.string()])
  })).optional()
})

export const functionCatalogEntry = z.object({
  arguments: z.record(z.string(), z.object({
    constraints: functionArgumentConstraint,
    description: z.string()
  })).default({}),
  description: z.string()
})

export const nlpFunctionCall = z.object({
  arguments: z.unknown(),
  name: z.string(),
  schedule: z.number().nonnegative().optional()
})

export const nlpParseRequest = z.object({
  functions: z.record(z.string(), functionCatalogEntry).default({}),
  metadata: z.record(z.string(), z.unknown()).default({}),
  sessionId: z.string().optional(),
  text: z.string().min(1)
})

export const nlpParseResponse = z.object({
  confidence: z.number().min(0).max(1),
  functionCalls: z.array(nlpFunctionCall),
  intent: z.string(),
  kind: z.enum(['response', 'function_calls', 'unknown']),
  text: z.string()
})

export type FunctionCatalog = z.infer<typeof nlpParseRequest>['functions']
export type NlpParseRequest = z.infer<typeof nlpParseRequest>
export type NlpParseResponse = z.infer<typeof nlpParseResponse>
