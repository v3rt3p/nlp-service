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
    const parsed = nlpParseRequest.safeParse(request.body)
    if (!parsed.success) {
      response.status(400).json({ error: parsed.error.issues })
      return
    }
    response.status(200).json(parseText(parsed.data.text, parsed.data.functions, options))
  })

  return app
}
