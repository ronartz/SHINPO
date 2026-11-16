import test from 'node:test'
import assert from 'node:assert/strict'
import { fetchAnalyticsPeriod, type AnalyticsRange } from './analytics.ts'

test('analytics period API requests the selected supported range', async (t) => {
  const originalFetch = globalThis.fetch
  const requested: string[] = []
  t.after(() => { globalThis.fetch = originalFetch })
  globalThis.fetch = (async (input: RequestInfo | URL) => {
    requested.push(String(input))
    return new Response(JSON.stringify({ range: '7d', timezone: 'UTC' }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })
  }) as typeof fetch

  for (const range of ['24h', '7d', '30d', '90d'] satisfies AnalyticsRange[]) {
    await fetchAnalyticsPeriod(range)
  }

  assert.deepEqual(requested.map((url) => new URL(url, 'http://localhost').searchParams.get('range')), ['24h', '7d', '30d', '90d'])
})

test('analytics period API reports failed responses', async (t) => {
  const originalFetch = globalThis.fetch
  t.after(() => { globalThis.fetch = originalFetch })
  globalThis.fetch = (async () => new Response('', { status: 400 })) as typeof fetch
  await assert.rejects(fetchAnalyticsPeriod('7d'), /Failed to fetch analytics period: 400/)
})
