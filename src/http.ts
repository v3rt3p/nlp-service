import express, { Request, Response } from 'express'

import { parseText } from './parser'
import { nlpParseRequest } from './schemas'

export interface HttpOptions {
  timeZone: string;
}

export function createApp (options: HttpOptions): express.Express {
  const app = express()
  app.use(express.json({ limit: '64kb' }))

  app.get('/health', (_request, response) => {
    response.status(200).json({ status: 'ok' })
  })

  app.post('/parse', (request: Request, response: Response) => {
    const startedAt = performance.now()
    const text = typeof request.body?.text === 'string' ? request.body.text : undefined
    console.info('[parse] request received', {
      textLength: text?.length ?? 0,
      functionCount: request.body?.functions && typeof request.body.functions === 'object'
        ? Object.keys(request.body.functions).length
        : 0
    })

    const parsed = nlpParseRequest.safeParse(request.body)
    if (!parsed.success) {
      console.warn('[parse] invalid request', {
        durationMs: Math.round(performance.now() - startedAt),
        issueCount: parsed.error.issues.length
      })
      response.status(400).json({ error: parsed.error.issues })
      return
    }

    const result = parseText(parsed.data.text, parsed.data.functions, options)
    console.info('[parse] request completed', {
      durationMs: Math.round(performance.now() - startedAt),
      kind: result.kind,
      intent: result.intent,
      functionCallCount: result.functionCalls.length
    })
    response.status(200).json(result)
  })

  return app
}
