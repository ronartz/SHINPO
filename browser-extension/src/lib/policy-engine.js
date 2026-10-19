(function installPolicyEngine(global) {
  'use strict'

  const canonical = global.ShinpoCanonical
  if (!canonical) throw new Error('ShinpoCanonical must be loaded before policy-engine.js')

  const DECISIONS = Object.freeze({
    ALLOW: 'ALLOW',
    WARN: 'WARN',
    RESTRICT: 'RESTRICT',
    UNCERTAIN: 'UNCERTAIN',
    INACTIVE: 'INACTIVE',
  })
  const MODES = new Set(['GUIDED', 'PROTECTED', 'STRICT'])
  const TERMINAL_SESSION_STATES = new Set(['PAUSED', 'COMPLETED', 'CANCELLED', 'EXPIRED', 'FAILED'])

  function normalizePolicy(rawPolicy, now = Date.now()) {
    if (!rawPolicy || typeof rawPolicy !== 'object') return inactivePolicy('No active Focus policy')

    const sessionId = scalarString(rawPolicy.sessionId)
    const status = String(rawPolicy.status || rawPolicy.sessionStatus || (sessionId ? 'ACTIVE' : 'INACTIVE')).toUpperCase()
    const modeCandidate = String(rawPolicy.mode || 'GUIDED').toUpperCase()
    const mode = MODES.has(modeCandidate) ? modeCandidate : 'GUIDED'
    const policyVersion = normalizeVersion(rawPolicy.policyVersion ?? rawPolicy.revision ?? 0)
    const leaseExpiresAtMs = timestamp(
      rawPolicy._hostLeaseExpiresAtMs ?? rawPolicy.leaseExpiresAt ?? rawPolicy.expiresAt,
    )
    const issuedAtMs = timestamp(rawPolicy.issuedAt) || now
    const active = Boolean(sessionId) && status === 'ACTIVE' && leaseExpiresAtMs > now
    const resources = Array.isArray(rawPolicy.resources)
      ? rawPolicy.resources.map(normalizeResource).filter(Boolean)
      : []

    const returnUrlCandidate = rawPolicy.returnUrl || findApprovedReturnUrl(resources)
    const normalizedReturnUrl = returnUrlCandidate
      ? canonical.canonicalizeUrl(returnUrlCandidate)
      : null

    return {
      schemaVersion: 1,
      active,
      inactiveReason: active
        ? null
        : inactiveReason(status, sessionId, leaseExpiresAtMs, now),
      sessionId,
      status,
      mode,
      policyVersion,
      taskId: scalarString(rawPolicy.taskId),
      taskTitle: safeText(rawPolicy.taskTitle || rawPolicy.sessionName || 'Current Focus session', 180),
      issuedAtMs,
      leaseExpiresAtMs,
      returnUrl: normalizedReturnUrl?.ok ? normalizedReturnUrl.url : null,
      resources,
      adapterSettings: normalizeAdapterSettings(rawPolicy.adapterSettings),
    }
  }

  function normalizeResource(rawResource) {
    if (!rawResource || typeof rawResource !== 'object') return null
    const resourceType = String(rawResource.resourceType || rawResource.type || 'WEBSITE').toUpperCase()
    const matchType = String(rawResource.matchType || inferMatchType(resourceType)).toUpperCase()
    const dispositionValue = String(rawResource.disposition || rawResource.effect || 'APPROVED').toUpperCase()
    const disposition = dispositionValue === 'BLOCK' ? 'BLOCKED' :
      (dispositionValue === 'ALLOW' ? 'APPROVED' : dispositionValue)
    if (disposition !== 'APPROVED' && disposition !== 'BLOCKED') return null
    if (resourceType === 'DESKTOP_PROCESS' || matchType === 'PROCESS') return null

    const value = rawResource.canonicalDestination || rawResource.destination ||
      rawResource.value || rawResource.resourceIdentifier
    if (typeof value !== 'string' || !value.trim()) return null

    return {
      id: scalarString(rawResource.id || rawResource.resourceId),
      resourceType,
      matchType,
      disposition,
      value: value.trim(),
      destination: typeof rawResource.destination === 'string' ? rawResource.destination.trim() : null,
      expiresAtMs: timestamp(rawResource.expiresAt),
      temporary: resourceType === 'TEMPORARY_SITE' || Boolean(rawResource.temporary),
    }
  }

  function evaluateUrl(rawPolicy, destination, now = Date.now()) {
    const policy = rawPolicy?.schemaVersion === 1 && 'active' in rawPolicy
      ? rawPolicy
      : normalizePolicy(rawPolicy, now)
    if (!policy.active || policy.leaseExpiresAtMs <= now || TERMINAL_SESSION_STATES.has(policy.status)) {
      return decision(DECISIONS.INACTIVE, policy.inactiveReason || 'Focus protection is inactive', null, policy)
    }

    const target = canonical.canonicalizeUrl(destination)
    if (!target.ok) {
      return decision(DECISIONS.INACTIVE, target.error, null, policy)
    }

    const matches = policy.resources
      .filter((resource) => !resource.expiresAtMs || resource.expiresAtMs > now)
      .filter((resource) => resourceMatches(resource, target.url))

    const approved = matches.find((resource) => resource.disposition === 'APPROVED')
    if (approved) {
      const reason = approved.temporary
        ? 'A time-limited exception allows this exact resource'
        : 'This resource is approved for the current Focus session'
      return decision(DECISIONS.ALLOW, reason, target.url, policy, approved)
    }

    const blocked = matches.find((resource) => resource.disposition === 'BLOCKED')
    if (blocked) {
      const outcome = policy.mode === 'GUIDED' ? DECISIONS.WARN : DECISIONS.RESTRICT
      return decision(outcome, 'This destination is outside your configured Focus rules', target.url, policy, blocked)
    }

    const youtube = canonical.parseYouTubeResource(target.url)
    if (youtube) return evaluateYouTube(policy, youtube)

    const discord = canonical.parseDiscordRoute(target.url)
    if (discord) return evaluateDiscord(policy, discord)

    const instagram = canonical.parseInstagramRoute(target.url)
    if (instagram) return evaluateInstagram(policy, instagram)

    if (policy.mode === 'GUIDED') {
      return decision(DECISIONS.ALLOW, 'Guided Focus keeps ordinary browsing available', target.url, policy)
    }
    return decision(
      DECISIONS.UNCERTAIN,
      'This destination has no explicit Focus rule and was not blocked',
      target.url,
      policy,
    )
  }

  function evaluateYouTube(policy, youtube) {
    const settings = policy.adapterSettings.youtube
    if (youtube.route === 'SHORTS' && settings.restrictShorts) {
      return adapterRestriction(policy, youtube.canonical.url, 'YouTube Shorts are restricted by your Focus settings')
    }
    if (youtube.route === 'HOME' && settings.restrictHome) {
      return adapterRestriction(policy, youtube.canonical.url, 'The YouTube feed is restricted by your Focus settings')
    }
    if ((youtube.route === 'VIDEO' || youtube.route === 'PLAYLIST') && settings.restrictUnapprovedVideos) {
      return adapterRestriction(
        policy,
        youtube.canonical.url,
        'Only explicitly approved YouTube videos and playlists are available right now',
      )
    }
    if (policy.mode === 'GUIDED') {
      return decision(DECISIONS.ALLOW, 'Guided Focus leaves this YouTube route available', youtube.canonical.url, policy)
    }
    return decision(
      DECISIONS.UNCERTAIN,
      'This YouTube resource is not approved or blocked; SHINPO did not guess its relevance',
      youtube.canonical.url,
      policy,
    )
  }

  function evaluateDiscord(policy, discord) {
    if (discord.kind === 'INVALID_CHANNEL') {
      return decision(DECISIONS.UNCERTAIN, 'This Discord route could not be validated safely', discord.canonical.url, policy)
    }
    if (policy.mode === 'GUIDED') {
      return decision(DECISIONS.ALLOW, 'Guided Focus leaves this Discord route available', discord.canonical.url, policy)
    }
    return decision(
      DECISIONS.UNCERTAIN,
      discord.kind === 'CHANNEL'
        ? 'This Discord channel has no explicit rule; message content was not inspected'
        : 'This Discord route has no explicit rule; private content was not inspected',
      discord.canonical.url,
      policy,
    )
  }

  function evaluateInstagram(policy, instagram) {
    const settings = policy.adapterSettings.instagram
    if (instagram.route === 'EXPLORE' && settings.restrictExplore) {
      return adapterRestriction(policy, instagram.canonical.url, 'Instagram Explore is restricted by your Focus settings')
    }
    if (instagram.route === 'REELS' && settings.restrictReels) {
      return adapterRestriction(policy, instagram.canonical.url, 'Instagram Reels are restricted by your Focus settings')
    }
    if (policy.mode === 'GUIDED') {
      return decision(DECISIONS.ALLOW, 'Guided Focus leaves this Instagram route available', instagram.canonical.url, policy)
    }
    return decision(
      DECISIONS.UNCERTAIN,
      'SHINPO cannot determine whether this Instagram content is relevant and did not block it',
      instagram.canonical.url,
      policy,
    )
  }

  function adapterRestriction(policy, url, reason) {
    return decision(policy.mode === 'GUIDED' ? DECISIONS.WARN : DECISIONS.RESTRICT, reason, url, policy)
  }

  function resourceMatches(resource, destination) {
    if (resource.resourceType === 'YOUTUBE_VIDEO') {
      const actual = canonical.parseYouTubeResource(destination)
      if (!actual?.videoId) return false
      const expected = canonical.parseYouTubeResource(resource.destination || resource.value)
      const expectedId = stableIdentifier(resource.value, 'youtube:video:') || expected?.videoId ||
        (/^[A-Za-z0-9_-]{11}$/.test(resource.value) ? resource.value : null)
      return Boolean(expectedId && actual.videoId === expectedId)
    }
    if (resource.resourceType === 'YOUTUBE_PLAYLIST') {
      const actual = canonical.parseYouTubeResource(destination)
      if (!actual?.playlistId) return false
      const expected = canonical.parseYouTubeResource(resource.destination || resource.value)
      const expectedId = stableIdentifier(resource.value, 'youtube:playlist:') || expected?.playlistId ||
        (/^[A-Za-z0-9_-]{10,80}$/.test(resource.value) ? resource.value : null)
      return Boolean(expectedId && actual.playlistId === expectedId)
    }
    if (resource.resourceType === 'DISCORD_CHANNEL' || resource.matchType === 'BROWSER_CHANNEL') {
      const actual = canonical.parseDiscordRoute(destination)
      const expected = canonical.parseDiscordRoute(resource.destination || resource.value)
      if (!actual || actual.kind !== 'CHANNEL') return false
      if (expected?.kind === 'CHANNEL') return actual.routeKey === expected.routeKey
      const stableRoute = stableIdentifier(resource.value, 'discord:channel:')
      return actual.routeKey === (stableRoute || resource.value.replace(/^\/+|\/+$/g, ''))
    }

    if (resource.matchType === 'DOMAIN') {
      const actual = canonical.canonicalizeUrl(destination)
      const expectedHost = canonical.canonicalizeHost(resource.value)
      return actual.ok && Boolean(expectedHost) && canonical.hostMatches(actual.host, expectedHost)
    }
    if (resource.matchType === 'URL_PATTERN') {
      return canonical.matchUrlPattern(destination, resource.value)
    }
    return canonical.exactUrlMatches(destination, resource.value)
  }

  function normalizeAdapterSettings(rawSettings) {
    const settings = rawSettings && typeof rawSettings === 'object' ? rawSettings : {}
    const youtube = settings.youtube && typeof settings.youtube === 'object' ? settings.youtube : settings
    const instagram = settings.instagram && typeof settings.instagram === 'object' ? settings.instagram : settings
    return {
      youtube: {
        hideRecommendations: Boolean(youtube.hideRecommendations ?? youtube.hideYoutubeRecommendations),
        restrictShorts: Boolean(youtube.restrictShorts ?? youtube.restrictYoutubeShorts),
        restrictHome: Boolean(youtube.restrictHome ?? youtube.restrictYoutubeHome),
        restrictUnapprovedVideos: Boolean(youtube.restrictUnapprovedVideos ?? youtube.restrictUnapprovedYoutube),
      },
      instagram: {
        restrictExplore: Boolean(instagram.restrictExplore),
        restrictReels: Boolean(instagram.restrictReels),
      },
    }
  }

  function findApprovedReturnUrl(resources) {
    const preferred = resources.find((resource) =>
      resource.disposition === 'APPROVED' && resource.matchType !== 'DOMAIN' && resourceReturnUrl(resource))
    return preferred ? resourceReturnUrl(preferred) : null
  }

  function resourceReturnUrl(resource) {
    if (resource.destination && canonical.canonicalizeUrl(resource.destination).ok) return resource.destination
    const direct = canonical.canonicalizeUrl(resource.value)
    if (direct.ok) return direct.url
    const videoId = stableIdentifier(resource.value, 'youtube:video:')
    if (videoId && /^[A-Za-z0-9_-]{11}$/.test(videoId)) {
      return `https://www.youtube.com/watch?v=${encodeURIComponent(videoId)}`
    }
    const playlistId = stableIdentifier(resource.value, 'youtube:playlist:')
    if (playlistId && /^[A-Za-z0-9_-]{10,80}$/.test(playlistId)) {
      return `https://www.youtube.com/playlist?list=${encodeURIComponent(playlistId)}`
    }
    const discordRoute = stableIdentifier(resource.value, 'discord:channel:')
    if (discordRoute && /^\d{5,22}\/\d{5,22}$/.test(discordRoute)) {
      return `https://discord.com/channels/${discordRoute}`
    }
    return null
  }

  function stableIdentifier(value, prefix) {
    return typeof value === 'string' && value.startsWith(prefix) ? value.slice(prefix.length) : null
  }

  function inferMatchType(resourceType) {
    if (resourceType === 'DISCORD_CHANNEL') return 'BROWSER_CHANNEL'
    if (resourceType === 'DESKTOP_PROCESS') return 'PROCESS'
    return 'EXACT'
  }

  function inactivePolicy(reason) {
    return {
      schemaVersion: 1,
      active: false,
      inactiveReason: reason,
      sessionId: null,
      status: 'INACTIVE',
      mode: 'GUIDED',
      policyVersion: 0,
      taskId: null,
      taskTitle: 'No active Focus session',
      issuedAtMs: 0,
      leaseExpiresAtMs: 0,
      returnUrl: null,
      resources: [],
      adapterSettings: normalizeAdapterSettings({}),
    }
  }

  function inactiveReason(status, sessionId, leaseExpiresAtMs, now) {
    if (!sessionId) return 'No active Focus session'
    if (TERMINAL_SESSION_STATES.has(status)) return `Focus session is ${status.toLowerCase()}`
    if (!leaseExpiresAtMs || leaseExpiresAtMs <= now) return 'The Focus policy lease expired'
    return 'Focus protection is inactive'
  }

  function decision(outcome, reason, normalizedDestination, policy, matchedResource = null) {
    return {
      decision: outcome,
      reason,
      normalizedDestination,
      sessionId: policy.sessionId,
      policyVersion: policy.policyVersion,
      mode: policy.mode,
      taskTitle: policy.taskTitle,
      returnUrl: policy.returnUrl,
      matchedResourceId: matchedResource?.id || null,
    }
  }

  function normalizeVersion(value) {
    const number = Number(value)
    return Number.isSafeInteger(number) && number >= 0 ? number : 0
  }

  function timestamp(value) {
    if (typeof value === 'number' && Number.isFinite(value)) return value
    if (typeof value !== 'string' || !value) return 0
    const parsed = Date.parse(value)
    return Number.isFinite(parsed) ? parsed : 0
  }

  function scalarString(value) {
    return typeof value === 'string' || typeof value === 'number' ? String(value) : null
  }

  function safeText(value, maximumLength) {
    return String(value).replace(/[\u0000-\u001f\u007f]/g, '').slice(0, maximumLength)
  }

  global.ShinpoPolicy = Object.freeze({
    DECISIONS,
    normalizePolicy,
    normalizeResource,
    evaluateUrl,
    resourceMatches,
    inactivePolicy,
  })
})(globalThis)
