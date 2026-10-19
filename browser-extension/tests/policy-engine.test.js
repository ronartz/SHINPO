import test from 'node:test'
import assert from 'node:assert/strict'
import '../src/lib/canonical-url.js'
import '../src/lib/policy-engine.js'

const { evaluateUrl, DECISIONS } = globalThis.ShinpoPolicy

test('evaluateUrl returns INACTIVE when policy is INACTIVE', () => {
  const policy = {
    status: 'INACTIVE',
    mode: 'GUIDED',
    resources: [],
    adapterSettings: {}
  }
  const result = evaluateUrl(policy, 'https://youtube.com/shorts/12345678901')
  assert.equal(result.decision, DECISIONS.INACTIVE)
})

test('evaluateUrl allows explicitly approved YouTube video and blocks unapproved Shorts', () => {
  const now = Date.now()
  const policy = {
    status: 'ACTIVE',
    mode: 'PROTECTED',
    sessionId: 10,
    policyVersion: 1,
    leaseExpiresAt: now + 60_000,
    resources: [
      {
        id: 'res-yt-1',
        resourceType: 'YOUTUBE_VIDEO',
        matchType: 'EXACT',
        disposition: 'APPROVED',
        destination: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
        canonicalDestination: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
        enabled: true,
      }
    ],
    adapterSettings: {
      restrictYoutubeShorts: true,
      restrictYoutubeHome: true,
      restrictUnapprovedYoutube: true,
    }
  }

  // Approved video
  const approvedResult = evaluateUrl(policy, 'https://www.youtube.com/watch?v=dQw4w9WgXcQ', now)
  assert.equal(approvedResult.decision, DECISIONS.ALLOW)
  assert.equal(approvedResult.matchedResourceId, 'res-yt-1')

  // Shorts restricted
  const shortsResult = evaluateUrl(policy, 'https://www.youtube.com/shorts/funnycat123', now)
  assert.equal(shortsResult.decision, DECISIONS.RESTRICT)
  assert.ok(shortsResult.reason.includes('Shorts'))

  // Other unapproved YouTube video restricted
  const otherResult = evaluateUrl(policy, 'https://www.youtube.com/watch?v=other123456', now)
  assert.equal(otherResult.decision, DECISIONS.RESTRICT)
  assert.ok(otherResult.reason.includes('Only explicitly approved YouTube videos'))
})

test('evaluateUrl respects active 5-minute temporary exception', () => {
  const now = Date.now()
  const policy = {
    status: 'ACTIVE',
    mode: 'PROTECTED',
    sessionId: 10,
    policyVersion: 2,
    leaseExpiresAt: now + 360_000,
    resources: [
      {
        id: 'temp-1',
        resourceType: 'TEMPORARY_SITE',
        matchType: 'EXACT',
        disposition: 'APPROVED',
        destination: 'https://reddit.com/r/programming',
        canonicalDestination: 'https://reddit.com/r/programming',
        expiresAt: now + 300_000,
        enabled: true,
      }
    ],
    adapterSettings: {}
  }

  const validException = evaluateUrl(policy, 'https://reddit.com/r/programming', now)
  assert.equal(validException.decision, DECISIONS.ALLOW)
  assert.equal(validException.matchedResourceId, 'temp-1')

  // After 5 minutes, exception has expired
  const expiredException = evaluateUrl(policy, 'https://reddit.com/r/programming', now + 305_000)
  assert.notEqual(expiredException.decision, DECISIONS.ALLOW)
})

test('evaluateUrl in GUIDED mode allows approved docs, warns on blocked sites, and allows ordinary web', () => {
  const now = Date.now()
  const policy = {
    status: 'ACTIVE',
    mode: 'GUIDED',
    sessionId: 10,
    policyVersion: 1,
    leaseExpiresAt: now + 60_000,
    resources: [
      {
        id: 'res-domain-1',
        resourceType: 'DOMAIN',
        matchType: 'DOMAIN',
        disposition: 'APPROVED',
        destination: 'spring.io',
        canonicalDestination: 'spring.io',
        enabled: true,
      },
      {
        id: 'res-blocked-1',
        resourceType: 'DOMAIN',
        matchType: 'DOMAIN',
        disposition: 'BLOCKED',
        destination: 'distracting-site.com',
        canonicalDestination: 'distracting-site.com',
        enabled: true,
      }
    ],
    adapterSettings: {}
  }

  const springResult = evaluateUrl(policy, 'https://docs.spring.io/spring-boot/docs/index.html', now)
  assert.equal(springResult.decision, DECISIONS.ALLOW)
  assert.equal(springResult.matchedResourceId, 'res-domain-1')

  const blockedResult = evaluateUrl(policy, 'https://distracting-site.com/feed', now)
  assert.equal(blockedResult.decision, DECISIONS.WARN)
  assert.equal(blockedResult.matchedResourceId, 'res-blocked-1')

  const ordinaryResult = evaluateUrl(policy, 'https://randomblog.xyz/post', now)
  assert.equal(ordinaryResult.decision, DECISIONS.ALLOW)
})
