import { FunctionCatalog, NlpParseResponse } from './schemas'

const DIRECTIVE_ALIASES: Record<string, string[]> = {
  assistant_disable_bluetooth: ['выключи блютуз', 'выключи bluetooth', 'disable bluetooth', 'turn off bluetooth'],
  assistant_enable_bluetooth: ['включи блютуз', 'включи bluetooth', 'enable bluetooth', 'turn on bluetooth'],
  assistant_set_volume_louder: ['сделай громче', 'погромче', 'громче', 'volume up', 'turn up the volume', 'louder'],
  assistant_set_volume_quieter: ['сделай тише', 'потише', 'тише', 'volume down', 'turn down the volume', 'quieter'],
}

const MEDIA_ALIASES: Record<string, string[]> = {
  assistant_media_pause: ['поставь на паузу', 'пауза', 'pause'],
  assistant_media_resume: ['продолжи', 'возобнови', 'resume', 'continue playing'],
  assistant_media_next: ['следующий трек', 'переключи трек', 'next track', 'next song'],
  assistant_media_previous: ['предыдущий трек', 'previous track', 'previous song']
}

const TIME_PATTERNS = [
  /котор(?:ый|ое)\s+час/u,
  /сколько\s+времени/u,
  /what\s+time\s+is\s+it/i,
  /current\s+time/i
]

const DATE_PATTERNS = [
  /какое\s+сегодня\s+число/u,
  /какая\s+сегодня\s+дата/u,
  /what(?:'s| is)\s+the\s+date/i,
  /today(?:'s)?\s+date/i
]

const ON_WORDS = ['включи', 'включить', 'зажги', 'открой', 'open', 'turn on', 'switch on']
const OFF_WORDS = ['выключи', 'выключить', 'погаси', 'закрой', 'close', 'turn off', 'switch off']

export interface ParserOptions {
  timeZone: string;
  now?: Date;
}

export function parseText (text: string, functions: FunctionCatalog, options: ParserOptions): NlpParseResponse {
  const normalized = normalize(text)
  const now = options.now ?? new Date()

  if (TIME_PATTERNS.some(pattern => pattern.test(normalized))) {
    return response('response', 'time.current', 1, formatTime(now, options.timeZone))
  }
  if (DATE_PATTERNS.some(pattern => pattern.test(normalized))) {
    return response('response', 'date.current', 1, formatDate(now, options.timeZone))
  }

  for (const [name, aliases] of Object.entries(DIRECTIVE_ALIASES)) {
    if (aliases.some(alias => normalized.includes(alias))) {
      if (name === 'assistant_set_volume_louder' || name === 'assistant_set_volume_quieter') {
        const known = functions[name]
        if (!known && Object.keys(functions).length > 0) continue
      }
      return callResponse(name, 'assistant.directive', functions)
    }
  }

  for (const [name, aliases] of Object.entries(MEDIA_ALIASES)) {
    if (aliases.some(alias => normalized.includes(alias))) {
      return callResponse(name, 'media.control', functions)
    }
  }

  const homeCall = parseHomeControl(text, functions)
  if (homeCall) return homeCall

  return response('unknown', 'unknown', 0, '')
}

function parseHomeControl (text: string, functions: FunctionCatalog): NlpParseResponse | null {
  const command = extractCommand(text)
  const action = findAction(command)
  if (!action) return null

  const candidates = Object.entries(functions).filter(([name, entry]) => {
    const searchable = normalize(`${name.replaceAll('_', ' ')} ${entry.description}`)
    return matchesDevice(command, searchable) && matchesAction(action, name, searchable, entry)
  })

  const selected = selectCandidate(command, candidates)
  if (!selected) return null
  const [name, entry] = selected
  const args = buildArguments(action, entry)
  if (args === null) return null
  return callResponse(name, 'smart_home.control', functions, args)
}

function extractCommand (text: string): string {
  const lowered = text.toLocaleLowerCase('ru-RU')
  const action = ON_WORDS.concat(OFF_WORDS).find(word => lowered.includes(word))
  if (!action) return normalize(text)

  const start = lowered.indexOf(action)
  const remainder = lowered.slice(start)
  const boundary = remainder.search(/[.!?;\n—–-]/u)
  return normalize(boundary === -1 ? remainder : remainder.slice(0, boundary))
}

function selectCandidate (
  text: string,
  candidates: Array<[string, FunctionCatalog[string]]>
): [string, FunctionCatalog[string]] | null {
  if (candidates.length === 1) return candidates[0]
  if (!candidates.length) return null

  const genericLightCommand = /(?:свет|ламп(?:а|ы)?|light|lights)/u.test(text)
  if (!genericLightCommand) return null

  const mainCandidates = candidates.filter(([name, entry]) =>
    /(?:^|[_ ])main(?:[_ ]|$)/u.test(normalize(`${name} ${entry.description}`))
  )
  return mainCandidates.length === 1 ? mainCandidates[0] : null
}

function findAction (text: string): 'on' | 'off' | null {
  if (ON_WORDS.some(word => text.includes(word))) return 'on'
  if (OFF_WORDS.some(word => text.includes(word))) return 'off'
  return null
}

function matchesDevice (text: string, searchable: string): boolean {
  const terms = text.split(/\s+/u).filter(term => term.length > 2 &&
    !ON_WORDS.includes(term) && !OFF_WORDS.includes(term) &&
    !['главные', 'главный', 'лампы', 'лампа', 'свет', 'lights', 'light'].includes(term))
  if (terms.length === 0) {
    return /(?:light|lights|ламп|свет|main)/u.test(searchable)
  }
  const aliases: Record<string, string[]> = {
    дверь: ['door'],
    дверцу: ['door'],
    ламп: ['light', 'lights'],
    кухня: ['kitchen'],
    свет: ['light', 'lights']
  }
  return terms.some(term => searchable.includes(term) || aliases[term]?.some(alias => searchable.includes(alias))) ||
    (text.includes('главн') && searchable.includes('main'))
}

function matchesAction (action: 'on' | 'off', name: string, searchable: string,
  entry: FunctionCatalog[string]): boolean {
  if (name.includes('set_') || searchable.includes('set state')) {
    const state = entry.arguments.state
    const variants = state?.constraints.variants ?? []
    return variants.some(variant => {
      const value = String(variant.value)
      const description = normalize(variant.description)
      return action === 'on' ? value === '1' || description === 'on' : value === '0' || description === 'off'
    })
  }
  const open = /(?:^|\s)(?:open|opens|откро|включ)/u.test(searchable)
  const close = /(?:^|\s)(?:off|close|closes|выключ|закро)/u.test(searchable)
  return action === 'on' ? open : close
}

function buildArguments (action: 'on' | 'off', entry: FunctionCatalog[string]): Record<string, number | string> | null {
  const state = entry.arguments.state
  if (!state) {
    return /\bset[_ ]/u.test(entry.description.toLocaleLowerCase('en-US')) ? { state: action === 'on' ? 1 : 0 } : {}
  }
  const variants = state.constraints.variants ?? []
  const matching = variants.find(variant => {
    const description = normalize(variant.description)
    return action === 'on' ? String(variant.value) === '1' || description === 'on' : String(variant.value) === '0' || description === 'off'
  })
  return matching ? { state: matching.value } : null
}

function callResponse (name: string, intent: string, functions: FunctionCatalog,
  args: unknown = null): NlpParseResponse {
  if (!functions[name] && Object.keys(functions).length > 0) return response('unknown', 'unknown', 0, '')
  return {
    confidence: 0.96,
    functionCalls: [{ arguments: args, name }],
    intent,
    kind: 'function_calls',
    text: ''
  }
}

function response (kind: NlpParseResponse['kind'], intent: string, confidence: number, text: string): NlpParseResponse {
  return { confidence, functionCalls: [], intent, kind, text }
}

function normalize (text: string): string {
  return text.toLocaleLowerCase('ru-RU').replace(/[!?.,:;]/gu, ' ').replace(/\s+/gu, ' ').trim()
}

function formatTime (date: Date, timeZone: string): string {
  return new Intl.DateTimeFormat('ru-RU', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone
  }).format(date)
}

function formatDate (date: Date, timeZone: string): string {
  return new Intl.DateTimeFormat('ru-RU', {
    day: '2-digit',
    month: '2-digit',
    timeZone,
    year: 'numeric'
  }).format(date)
}
