import test from 'node:test'
import assert from 'node:assert/strict'
import '../src/lib/canonical-url.js'

const {
  canonicalizeUrl,
  canonicalizeHost,
  hostMatches,
  exactUrlMatches,
  matchUrlPattern,
  parseYouTubeResource,
  parseDiscordRoute,
  parseInstagramRoute,
} = globalThis.ShinpoCanonical

test('canonicalizeUrl normalizes HTTP/HTTPS, query params, and strips hash', () => {
  const result = canonicalizeUrl('https://EXAMPLE.com:443/docs/intro?b=2&a=1#section-3')
  assert.equal(result.ok, true)
  assert.equal(result.host, 'example.com')
  assert.equal(result.pathname, '/docs/intro')
  assert.equal(result.url, 'https://example.com/docs/intro?a=1&b=2')
})

test('canonicalizeUrl rejects invalid or non-http protocols and credentials', () => {
  assert.equal(canonicalizeUrl('ftp://example.com/file').ok, false)
  assert.equal(canonicalizeUrl('javascript:alert(1)').ok, false)
  assert.equal(canonicalizeUrl('https://user:pass@example.com/').ok, false)
})

test('hostMatches checks subdomains properly', () => {
  assert.equal(hostMatches('docs.spring.io', 'spring.io', true), true)
  assert.equal(hostMatches('spring.io', 'spring.io', true), true)
  assert.equal(hostMatches('evilhackerspring.io', 'spring.io', true), false)
  assert.equal(hostMatches('docs.spring.io', 'spring.io', false), false)
})

test('matchUrlPattern supports wildcards and prefixes', () => {
  assert.equal(matchUrlPattern('https://docs.spring.io/spring-boot/docs/index.html', 'https://*.spring.io/spring-boot/*'), true)
  assert.equal(matchUrlPattern('https://spring.io/other', 'https://*.spring.io/spring-boot/*'), false)
  assert.equal(matchUrlPattern('https://github.com/ronartz/SHINPO', 'https://github.com/*'), true)
})

test('parseYouTubeResource handles watch, short, and playlist URLs', () => {
  const watch = parseYouTubeResource('https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=10s')
  assert.equal(watch.route, 'VIDEO')
  assert.equal(watch.videoId, 'dQw4w9WgXcQ')

  const shortLink = parseYouTubeResource('https://youtu.be/dQw4w9WgXcQ')
  assert.equal(shortLink.route, 'VIDEO')
  assert.equal(shortLink.videoId, 'dQw4w9WgXcQ')

  const shorts = parseYouTubeResource('https://www.youtube.com/shorts/dQw4w9WgXcQ')
  assert.equal(shorts.route, 'SHORTS')
  assert.equal(shorts.videoId, 'dQw4w9WgXcQ')

  const playlist = parseYouTubeResource('https://www.youtube.com/playlist?list=PL1234567890abcdef')
  assert.equal(playlist.route, 'PLAYLIST')
  assert.equal(playlist.playlistId, 'PL1234567890abcdef')

  const home = parseYouTubeResource('https://www.youtube.com/')
  assert.equal(home.route, 'HOME')
})

test('parseDiscordRoute extracts channel and direct message routes', () => {
  const channel = parseDiscordRoute('https://discord.com/channels/123456789012345678/987654321098765432')
  assert.equal(channel.kind, 'CHANNEL')
  assert.equal(channel.guildId, '123456789012345678')
  assert.equal(channel.channelId, '987654321098765432')

  const dm = parseDiscordRoute('https://discord.com/channels/@me/987654321098765432')
  assert.equal(dm.kind, 'DIRECT_MESSAGE')
  assert.equal(dm.channelId, '987654321098765432')
})

test('parseInstagramRoute identifies reels vs explore', () => {
  assert.equal(parseInstagramRoute('https://www.instagram.com/reels/C4xyz/').route, 'REELS')
  assert.equal(parseInstagramRoute('https://www.instagram.com/explore/').route, 'EXPLORE')
  assert.equal(parseInstagramRoute('https://www.instagram.com/profile/').route, 'OTHER')
})
