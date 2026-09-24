import { config } from 'dotenv'

import { createApp } from './http'

config({ path: '.env.local' })
config()

const port = Number.parseInt(process.env.PORT ?? '8090')
const timeZone = process.env.TIMEZONE ?? 'Europe/Moscow'

createApp({ timeZone }).listen(port, error => {
  if (error) {
    console.error(`Failed to start NLP service on :${port}`, error)
    return
  }
  console.log(`NLP service started on :${port}`)
})
