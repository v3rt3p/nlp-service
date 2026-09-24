import assert from 'node:assert/strict'
import test from 'node:test'

import { parseText } from '../src/parser'
import { FunctionCatalog } from '../src/schemas'

const functions: FunctionCatalog = {
  open_door: {
    arguments: {},
    description: 'opens the door'
  },
  set_main_lights_state: {
    arguments: {
      state: {
        constraints: {
          argumentType: 'number',
          type: 'number-variants',
          variants: [
            { description: 'off', value: 0 },
            { description: 'on', value: 1 }
          ]
        },
        description: 'lights state'
      }
    },
    description: 'set state of main lights (on or off)'
  }
}

test('parses current time', () => {
  const result = parseText('Который час?', {}, {
    now: new Date('2026-09-24T12:34:00Z'),
    timeZone: 'UTC'
  })
  assert.equal(result.kind, 'response')
  assert.equal(result.intent, 'time.current')
  assert.equal(result.text, '12:34')
})

test('parses a known smart-home state function', () => {
  const result = parseText('включи главные лампы', functions, { timeZone: 'UTC' })
  assert.deepEqual(result.functionCalls, [{
    arguments: { state: 1 },
    name: 'set_main_lights_state'
  }])
})

test('parses a command before unrelated trailing speech', () => {
  const result = parseText(
    'Выключи свет. Я даже это уже ни разу не видел это новый интерфейс.',
    functions,
    { timeZone: 'UTC' }
  )
  assert.deepEqual(result.functionCalls, [{
    arguments: { state: 0 },
    name: 'set_main_lights_state'
  }])
})

test('parses open actions from normalized function names', () => {
  const result = parseText('открой дверь', functions, { timeZone: 'UTC' })
  assert.deepEqual(result.functionCalls, [{
    arguments: {},
    name: 'open_door'
  }])
})

test('does not invent unknown functions', () => {
  const result = parseText('включи кухню', functions, { timeZone: 'UTC' })
  assert.equal(result.kind, 'unknown')
})
