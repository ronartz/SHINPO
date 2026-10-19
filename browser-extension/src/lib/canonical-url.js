(function installCanonicalUrl(global) {
  'use strict'

  const MAX_URL_LENGTH = 8192
  const YOUTUBE_VIDEO_ID = /^[A-Za-z0-9_-]{11}$/
  const YOUTUBE_PLAYLIST_ID = /^[A-Za-z0-9_-]{10,80}$/
  const DISCORD_ID = /^\d{5,22}$/

  function canonicalizeUrl(input) {
    if (typeof input !== 'string' || input.length === 0 || input.length > MAX_URL_LENGTH) {
      return invalid('URL is missing or too long')
    }

    let parsed
    try {
      parsed = new URL(input)
    } catch {
      return invalid('URL is invalid')
    }

    if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
      return invalid('Only HTTP and HTTPS destinations are supported')
    }
    if (parsed.username || parsed.password) {
      return invalid('URLs containing credentials are not supported')
    }

    const host = parsed.hostname.toLowerCase().replace(/\.+$/, '')
    if (!host || host.includes('*')) {
      return invalid('URL hostname is invalid')
    }

    parsed.hostname = host
    parsed.hash = ''
    if ((parsed.protocol === 'https:' && parsed.port === '443') ||
        (parsed.protocol === 'http:' && parsed.port === '80')) {
      parsed.port = ''
    }

    const sortedParameters = [...parsed.searchParams.entries()]
      .sort(([leftKey, leftValue], [rightKey, rightValue]) =>
        leftKey.localeCompare(rightKey) || leftValue.localeCompare(rightValue))
    parsed.search = ''
    for (const [key, value] of sortedParameters) {
      parsed.searchParams.append(key, value)
    }

    return {
      ok: true,
      url: parsed.href,
      scheme: parsed.protocol.slice(0, -1),
      host,
      port: parsed.port,
      origin: parsed.origin,
      pathname: parsed.pathname || '/',
      search: parsed.search,
      searchParams: parsed.searchParams,
    }
  }

  function canonicalizeHost(input) {
    if (typeof input !== 'string' || input.length === 0 || input.length > 253) {
      return null
    }
    const candidate = input.includes('://') ? input : `https://${input}`
    const canonical = canonicalizeUrl(candidate)
    if (!canonical.ok) return null
    if (canonical.pathname !== '/' || canonical.search) return null
    return canonical.host
  }

  function hostMatches(host, ruleHost, includeSubdomains = true) {
    if (typeof host !== 'string' || typeof ruleHost !== 'string') return false
    const normalizedHost = host.toLowerCase().replace(/\.+$/, '')
    const normalizedRule = ruleHost.toLowerCase().replace(/\.+$/, '')
    return normalizedHost === normalizedRule ||
      (includeSubdomains && normalizedHost.endsWith(`.${normalizedRule}`))
  }

  function exactUrlMatches(destination, ruleValue) {
    const left = canonicalizeUrl(destination)
    const right = canonicalizeUrl(ruleValue)
    return left.ok && right.ok && left.url === right.url
  }

  function matchUrlPattern(destination, pattern) {
    const canonical = canonicalizeUrl(destination)
    const compiled = compileUrlPattern(pattern)
    if (!canonical.ok || !compiled) return false
    if (canonical.scheme !== compiled.scheme || canonical.port !== compiled.port) return false
    if (!hostMatches(canonical.host, compiled.host, compiled.includeSubdomains)) return false
    if (!compiled.includeSubdomains && canonical.host !== compiled.host) return false
    if (compiled.pathPrefix !== null) {
      return canonical.pathname.startsWith(compiled.pathPrefix)
    }
    return canonical.pathname === compiled.pathname && canonical.search === compiled.search
  }

  function compileUrlPattern(pattern) {
    if (typeof pattern !== 'string' || pattern.length > MAX_URL_LENGTH || pattern.includes('#')) {
      return null
    }
    const matched = pattern.match(/^(https?):\/\/(\*\.)?([^/:?#*]+)(?::(\d{1,5}))?(\/[^#]*)?$/i)
    if (!matched) return null
    const [, schemeRaw, wildcard, hostRaw, portRaw = '', suffix = '/'] = matched
    const host = canonicalizeHost(hostRaw)
    if (!host) return null
    const wildcardCount = (suffix.match(/\*/g) || []).length
    if (wildcardCount > 1 || (wildcardCount === 1 && !suffix.endsWith('*'))) return null

    const portNumber = portRaw ? Number(portRaw) : null
    if (portNumber !== null && (portNumber < 1 || portNumber > 65535)) return null
    const scheme = schemeRaw.toLowerCase()
    const port = (scheme === 'https' && portRaw === '443') || (scheme === 'http' && portRaw === '80')
      ? ''
      : portRaw

    if (wildcardCount === 1) {
      const prefixUrl = canonicalizeUrl(`${scheme}://${host}${port ? `:${port}` : ''}${suffix.slice(0, -1)}`)
      if (!prefixUrl.ok) return null
      return {
        scheme,
        host,
        port,
        includeSubdomains: Boolean(wildcard),
        pathname: null,
        search: null,
        pathPrefix: prefixUrl.pathname,
      }
    }

    const exact = canonicalizeUrl(`${scheme}://${host}${port ? `:${port}` : ''}${suffix}`)
    if (!exact.ok) return null
    return {
      scheme,
      host,
      port,
      includeSubdomains: Boolean(wildcard),
      pathname: exact.pathname,
      search: exact.search,
      pathPrefix: null,
    }
  }

  function parseYouTubeResource(input) {
    const canonical = canonicalizeUrl(input)
    if (!canonical.ok) return null
    const isYouTube = hostMatches(canonical.host, 'youtube.com')
    const isShortHost = canonical.host === 'youtu.be'
    if (!isYouTube && !isShortHost) return null

    let videoId = null
    let playlistId = canonical.searchParams.get('list')
    if (isShortHost) {
      videoId = canonical.pathname.split('/').filter(Boolean)[0] || null
    } else if (canonical.pathname === '/watch') {
      videoId = canonical.searchParams.get('v')
    } else {
      const route = canonical.pathname.split('/').filter(Boolean)
      if (route[0] === 'shorts' || route[0] === 'embed' || route[0] === 'live') {
        videoId = route[1] || null
      }
    }

    if (videoId && !YOUTUBE_VIDEO_ID.test(videoId)) videoId = null
    if (playlistId && !YOUTUBE_PLAYLIST_ID.test(playlistId)) playlistId = null

    let route = 'OTHER'
    if (canonical.pathname.startsWith('/shorts/')) route = 'SHORTS'
    else if (canonical.pathname === '/' || canonical.pathname === '/feed/trending') route = 'HOME'
    else if (canonical.pathname === '/watch' || canonical.pathname.startsWith('/embed/') || canonical.pathname.startsWith('/live/') || (isShortHost && videoId)) route = 'VIDEO'
    else if (canonical.pathname === '/playlist') route = 'PLAYLIST'

    return { canonical, videoId, playlistId, route }
  }

  function parseDiscordRoute(input) {
    const canonical = canonicalizeUrl(input)
    if (!canonical.ok ||
        (!hostMatches(canonical.host, 'discord.com') && !hostMatches(canonical.host, 'discordapp.com'))) {
      return null
    }
    const segments = canonical.pathname.split('/').filter(Boolean)
    if (segments[0] !== 'channels' || segments.length < 3) {
      return { canonical, kind: 'OTHER', guildId: null, channelId: null }
    }
    const guildId = segments[1]
    const channelId = segments[2]
    if ((guildId !== '@me' && !DISCORD_ID.test(guildId)) || !DISCORD_ID.test(channelId)) {
      return { canonical, kind: 'INVALID_CHANNEL', guildId: null, channelId: null }
    }
    return {
      canonical,
      kind: guildId === '@me' ? 'DIRECT_MESSAGE' : 'CHANNEL',
      guildId,
      channelId,
      routeKey: `${guildId}/${channelId}`,
    }
  }

  function parseInstagramRoute(input) {
    const canonical = canonicalizeUrl(input)
    if (!canonical.ok || !hostMatches(canonical.host, 'instagram.com')) return null
    const firstSegment = canonical.pathname.split('/').filter(Boolean)[0] || ''
    const route = firstSegment === 'explore'
      ? 'EXPLORE'
      : (firstSegment === 'reels' || firstSegment === 'reel' ? 'REELS' : 'OTHER')
    return { canonical, route }
  }

  function invalid(error) {
    return { ok: false, error }
  }

  global.ShinpoCanonical = Object.freeze({
    canonicalizeUrl,
    canonicalizeHost,
    hostMatches,
    exactUrlMatches,
    matchUrlPattern,
    compileUrlPattern,
    parseYouTubeResource,
    parseDiscordRoute,
    parseInstagramRoute,
  })
})(globalThis)
