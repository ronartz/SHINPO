import test from 'node:test'
import assert from 'node:assert/strict'
import '../src/lib/canonical-url.js'
import '../src/lib/policy-engine.js'

const { evaluateUrl, effectiveDeadlineAt, effectivePhase, normalizePolicy, DECISIONS } = globalThis.ShinpoPolicy

test('normalizePolicy preserves the server phase and deadline metadata', () => {
  const now = Date.now()
  const policy = globalThis.ShinpoPolicy.normalizePolicy({
    sessionId: 10,
    status: 'ACTIVE',
    currentPhase: 'GRACE',
    phaseRemainingSeconds: 120,
    phaseDeadlineAt: now + 120_000,
    leaseExpiresAt: now + 60_000,
    resources: [],
  }, now)

  assert.equal(policy.currentPhase, 'GRACE')
  assert.equal(policy.phaseRemainingSeconds, 120)
  assert.equal(policy.phaseDeadlineAtMs, now + 120_000)
})

test('normalizePolicy preserves versioned Guardian catalogs from the native policy', () => {
  const now = Date.now()
  const policy = normalizePolicy({
    sessionId: 10, status: 'ACTIVE', currentPhase: 'FOCUS',
    leaseExpiresAt: now + 60_000,
    catalogVersions: { applications: 'guardian-apps-v1', domains: 'guardian-domains-v1' },
  }, now)

  assert.deepEqual(policy.catalogVersions, {
    applications: 'guardian-apps-v1', domains: 'guardian-domains-v1',
  })
})

test('automatic Guardian warns in Light, restricts in Standard and Strict, and permits only the break exception', () => {
  const now = Date.now()
  const policy = {
    sessionId: 77, status: 'ACTIVE', mode: 'GUIDED', currentPhase: 'FOCUS',
    phaseDeadlineAt: now + 60_000, breakDeadlineAt: now + 120_000,
    graceDeadlineAt: now + 180_000, leaseExpiresAt: now + 240_000,
    resources: [{ id: 'guardian-domains-v1:reddit.com', resourceType: 'WEBSITE', matchType: 'DOMAIN',
      disposition: 'BLOCKED', destination: 'reddit.com', automaticGuardian: true }],
  }
  const breakApproval = { id: 'break-reddit', resourceType: 'WEBSITE', matchType: 'DOMAIN',
    disposition: 'APPROVED', breakOnly: true, destination: 'reddit.com' }
  assert.equal(evaluateUrl(policy, 'https://www.reddit.com', now).decision, DECISIONS.WARN)
  assert.equal(evaluateUrl({ ...policy, currentPhase: 'BREAK', phaseDeadlineAt: now + 60_000 }, 'https://www.reddit.com', now).decision, DECISIONS.WARN)
  assert.equal(evaluateUrl({ ...policy, mode: 'PROTECTED' }, 'https://www.reddit.com', now).decision, DECISIONS.RESTRICT)
  assert.equal(evaluateUrl({ ...policy, mode: 'STRICT' }, 'https://www.reddit.com', now).decision, DECISIONS.RESTRICT)
  assert.equal(evaluateUrl({ ...policy, mode: 'PROTECTED', currentPhase: 'BREAK', phaseDeadlineAt: now + 60_000, resources: [...policy.resources, breakApproval] }, 'https://reddit.com', now).decision, DECISIONS.ALLOW)
  assert.equal(evaluateUrl({ ...policy, mode: 'PROTECTED', currentPhase: 'BREAK', phaseDeadlineAt: now + 60_000 }, 'https://unlisted.example', now).decision, DECISIONS.RESTRICT)
  assert.equal(evaluateUrl({ ...policy, mode: 'GUIDED', currentPhase: 'BREAK', phaseDeadlineAt: now + 60_000 }, 'https://unlisted.example', now).decision, DECISIONS.ALLOW)
  assert.equal(evaluateUrl({ ...policy, mode: 'STRICT', resources: [] }, 'https://arxiv.org', now).decision, DECISIONS.RESTRICT)
  assert.equal(evaluateUrl({ ...policy, mode: 'STRICT', resources: [{ id: 'trusted-arxiv', resourceType: 'WEBSITE', matchType: 'DOMAIN', disposition: 'APPROVED', destination: 'arxiv.org', automaticGuardian: true }] }, 'https://arxiv.org/abs/1234', now).decision, DECISIONS.ALLOW)
  assert.equal(evaluateUrl({ ...policy, mode: 'STRICT', resources: [] }, 'https://khanacademy.org', now).decision, DECISIONS.RESTRICT)
  assert.equal(evaluateUrl(policy, 'https://reddit.com', now + 60_001).decision, DECISIONS.WARN)
  assert.equal(evaluateUrl(policy, 'https://reddit.com', now + 180_001).decision, DECISIONS.WARN)
  assert.equal(evaluateUrl(policy, 'https://notreddit.com', now).decision, DECISIONS.ALLOW)
})

test('normalizePolicy rejects an active lease with no recognized server phase', () => {
  const now = Date.now()
  const policy = globalThis.ShinpoPolicy.normalizePolicy({
    sessionId: 11,
    status: 'ACTIVE',
    leaseExpiresAt: now + 60_000,
    resources: [],
  }, now)

  assert.equal(policy.currentPhase, 'UNKNOWN')
  assert.equal(policy.active, false)
})

test('break-only approvals do not leak into Focus and expire at the server deadline', () => {
  const now = Date.now()
  const policy = {
    status: 'ACTIVE',
    currentPhase: 'GRACE',
    mode: 'PROTECTED',
    sessionId: 12,
    policyVersion: 3,
    phaseDeadlineAt: now + 60_000,
    leaseExpiresAt: now + 120_000,
    resources: [{
      id: 'break-site', resourceType: 'WEBSITE', matchType: 'DOMAIN', disposition: 'APPROVED',
      breakOnly: true, destination: 'game.example', canonicalDestination: 'game.example', enabled: true,
    }],
    adapterSettings: {},
  }

  assert.equal(evaluateUrl(policy, 'https://game.example', now).decision, DECISIONS.ALLOW)
  assert.equal(evaluateUrl(policy, 'https://unlisted.example', now).decision, DECISIONS.RESTRICT)
  assert.equal(evaluateUrl(policy, 'https://game.example', now + 60_001).decision, DECISIONS.RESTRICT)

  const focusPolicy = { ...policy, currentPhase: 'FOCUS', phaseDeadlineAt: null }
  assert.equal(evaluateUrl(focusPolicy, 'https://game.example', now).decision, DECISIONS.RESTRICT)

  const restrictedPolicy = {
    ...policy,
    resources: [{ ...policy.resources[0], disposition: 'BLOCKED', breakOnly: false }],
  }
  assert.equal(evaluateUrl(restrictedPolicy, 'https://game.example', now + 60_001).decision, DECISIONS.RESTRICT)
})

test('stale Focus and Break snapshots preserve approved sites through Grace, then cut off', () => {
  const now = Date.now()
  const resource = {
    id: 'break-site', resourceType: 'WEBSITE', matchType: 'DOMAIN', disposition: 'APPROVED',
    breakOnly: true, destination: 'game.example', canonicalDestination: 'game.example',
  }
  const blockedSite = {
    id: 'blocked-site', resourceType: 'WEBSITE', matchType: 'DOMAIN', disposition: 'BLOCKED',
    breakOnly: false, destination: 'social.example', canonicalDestination: 'social.example',
  }
  const policy = {
    status: 'ACTIVE', currentPhase: 'FOCUS', mode: 'PROTECTED', sessionId: 19,
    phaseDeadlineAt: now + 60_000,
    breakDeadlineAt: now + 960_000,
    graceDeadlineAt: now + 1_560_000,
    leaseExpiresAt: now + 1_800_000,
    resources: [resource, blockedSite],
  }

  assert.equal(evaluateUrl(policy, 'https://social.example', now).decision, DECISIONS.RESTRICT)
  assert.equal(evaluateUrl(policy, 'https://game.example', now).decision, DECISIONS.RESTRICT)
  assert.equal(evaluateUrl(policy, 'https://social.example', now + 60_001).decision, DECISIONS.RESTRICT)
  assert.equal(evaluateUrl(policy, 'https://game.example', now + 60_001).decision, DECISIONS.ALLOW)
  const breakSnapshot = normalizePolicy(policy, now + 60_001)
  assert.equal(effectivePhase(breakSnapshot, now + 60_001), 'BREAK')
  assert.equal(effectiveDeadlineAt(breakSnapshot, now + 60_001), now + 960_000)
  assert.equal(evaluateUrl(policy, 'https://game.example', now + 960_001).decision, DECISIONS.ALLOW)
  const graceSnapshot = normalizePolicy(policy, now + 960_001)
  assert.equal(effectivePhase(graceSnapshot, now + 960_001), 'GRACE')
  assert.equal(effectiveDeadlineAt(graceSnapshot, now + 960_001), now + 1_560_000)
  assert.equal(evaluateUrl(policy, 'https://game.example', now + 1_560_001).decision, DECISIONS.RESTRICT)
  const cutoffSnapshot = normalizePolicy(policy, now + 1_560_001)
  assert.equal(effectivePhase(cutoffSnapshot, now + 1_560_001), 'RETURN_REQUIRED')
  assert.equal(effectiveDeadlineAt(cutoffSnapshot, now + 1_560_001), 0)
})

test('expired policy retains only explicit restrictions and reports other destinations uncertain', () => {
  const { degradedPolicy } = globalThis.ShinpoPolicy
  const degraded = degradedPolicy({
    sessionId: '33', taskTitle: 'Study block', policyVersion: 8,
    resources: [
      { disposition: 'BLOCKED', resourceType: 'WEBSITE', matchType: 'DOMAIN', value: 'social.example' },
      { disposition: 'APPROVED', breakOnly: true, resourceType: 'WEBSITE', matchType: 'DOMAIN', value: 'game.example' },
      { disposition: 'APPROVED', breakOnly: false, resourceType: 'WEBSITE', matchType: 'DOMAIN', value: 'docs.example' },
    ],
  }, 'Server unavailable')

  assert.equal(degraded.active, false)
  assert.equal(degraded.degraded, true)
  assert.equal(evaluateUrl(degraded, 'https://social.example').decision, DECISIONS.RESTRICT)
  assert.equal(evaluateUrl(degraded, 'https://game.example').decision, DECISIONS.RESTRICT)
  assert.equal(evaluateUrl(degraded, 'https://docs.example').decision, DECISIONS.UNCERTAIN)
})

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

test('local desktop policy can explicitly disable temporary browser exceptions', () => {
  const policy = globalThis.ShinpoPolicy.normalizePolicy({
    status: 'ACTIVE', sessionId: 34, currentPhase: 'FOCUS', mode: 'PROTECTED',
    allowTemporaryExceptions: false, policyVersion: 2,
    expiresAt: Date.now() + 60_000, resources: [],
  })
  assert.equal(policy.active, true)
  assert.equal(policy.allowTemporaryExceptions, false)
})

test('evaluateUrl allows explicitly approved YouTube video and blocks unapproved Shorts', () => {
  const now = Date.now()
  const policy = {
    status: 'ACTIVE',
    currentPhase: 'FOCUS',
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
    currentPhase: 'FOCUS',
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
    currentPhase: 'FOCUS',
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
