/**
 * SHINPO Focus Atmosphere Engine (Endel-inspired calm focus soundscapes)
 * 
 * Generates procedural, zero-cost, offline-safe ambient soundscapes using the
 * browser's native Web Audio API:
 * - Pure client-side synthesis: 0 network requests, 0 external assets, ₹0 cost.
 * - Non-blocking: Audio runs entirely on the browser audio thread.
 * - Soundscapes: Brown Noise, Pink Noise, Gentle Rain, Ambient Stream, Quiet (Off).
 */

export type AtmosphereSound = 'quiet' | 'brown-noise' | 'pink-noise' | 'gentle-rain' | 'ambient-stream'

export interface AtmosphereConfig {
  sound: AtmosphereSound
  volume: number // 0 to 1
  isPlaying: boolean
}

class FocusAtmosphereService {
  private ctx: AudioContext | null = null
  private masterGain: GainNode | null = null
  private activeSound: AtmosphereSound = 'quiet'
  private isPlaying: boolean = false
  private volume: number = 0.5
  private activeNodes: { stop?: () => void; disconnect: () => void }[] = []

  private getAudioContext(): AudioContext | null {
    if (typeof window === 'undefined') return null
    if (!this.ctx) {
      const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
      if (AudioContextClass) {
        this.ctx = new AudioContextClass()
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {})
    }
    return this.ctx
  }

  public getConfig(): AtmosphereConfig {
    return {
      sound: this.activeSound,
      volume: this.volume,
      isPlaying: this.isPlaying,
    }
  }

  public setVolume(volume: number) {
    this.volume = Math.max(0, Math.min(1, volume))
    if (this.masterGain && this.ctx) {
      this.masterGain.gain.setValueAtTime(this.volume, this.ctx.currentTime)
    }
  }

  public stop() {
    this.isPlaying = false
    this.cleanupNodes()
  }

  public async setSound(sound: AtmosphereSound, autoPlay = true) {
    this.activeSound = sound
    if (sound === 'quiet') {
      this.stop()
      return
    }
    if (autoPlay) {
      await this.play()
    }
  }

  public async play() {
    if (this.activeSound === 'quiet') return
    const ctx = this.getAudioContext()
    if (!ctx) return

    this.cleanupNodes()

    // Master Gain
    this.masterGain = ctx.createGain()
    this.masterGain.gain.setValueAtTime(this.volume, ctx.currentTime)
    this.masterGain.connect(ctx.destination)

    this.isPlaying = true

    switch (this.activeSound) {
      case 'brown-noise':
        this.createBrownNoise(ctx, this.masterGain)
        break
      case 'pink-noise':
        this.createPinkNoise(ctx, this.masterGain)
        break
      case 'gentle-rain':
        this.createGentleRain(ctx, this.masterGain)
        break
      case 'ambient-stream':
        this.createAmbientStream(ctx, this.masterGain)
        break
      default:
        break
    }
  }

  private cleanupNodes() {
    for (const node of this.activeNodes) {
      try {
        if (node.stop) node.stop()
        node.disconnect()
      } catch {
        // Node might already be disconnected
      }
    }
    this.activeNodes = []
  }

  /**
   * Brown Noise: Deep, warm, low-frequency rumble (1/f^2)
   */
  private createBrownNoise(ctx: AudioContext, destination: AudioNode) {
    const bufferSize = 2 * ctx.sampleRate
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate)
    const output = buffer.getChannelData(0)
    let lastOut = 0.0

    for (let i = 0; i < bufferSize; i++) {
      const white = Math.random() * 2 - 1
      output[i] = (lastOut + 0.02 * white) / 1.02
      lastOut = output[i]
      output[i] *= 3.5 // Gain compensation
    }

    const whiteNoise = ctx.createBufferSource()
    whiteNoise.buffer = buffer
    whiteNoise.loop = true

    const filter = ctx.createBiquadFilter()
    filter.type = 'lowpass'
    filter.frequency.value = 800

    whiteNoise.connect(filter)
    filter.connect(destination)
    whiteNoise.start()

    this.activeNodes.push(whiteNoise, filter)
  }

  /**
   * Pink Noise: Balanced spectrum (1/f) using Kellet's algorithm
   */
  private createPinkNoise(ctx: AudioContext, destination: AudioNode) {
    const bufferSize = 2 * ctx.sampleRate
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate)
    const output = buffer.getChannelData(0)
    let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0

    for (let i = 0; i < bufferSize; i++) {
      const white = Math.random() * 2 - 1
      b0 = 0.99886 * b0 + white * 0.0555179
      b1 = 0.99332 * b1 + white * 0.0750759
      b2 = 0.96900 * b2 + white * 0.1538520
      b3 = 0.86650 * b3 + white * 0.3104856
      b4 = 0.55000 * b4 + white * 0.5329522
      b5 = -0.7616 * b5 - white * 0.0168980
      output[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362) * 0.11
      b6 = white * 0.115926
    }

    const source = ctx.createBufferSource()
    source.buffer = buffer
    source.loop = true
    source.connect(destination)
    source.start()

    this.activeNodes.push(source)
  }

  /**
   * Gentle Rain: Bandpass-filtered pink noise modulated by subtle LFO
   */
  private createGentleRain(ctx: AudioContext, destination: AudioNode) {
    const bufferSize = 2 * ctx.sampleRate
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate)
    const output = buffer.getChannelData(0)
    let b0 = 0, b1 = 0, b2 = 0

    for (let i = 0; i < bufferSize; i++) {
      const white = Math.random() * 2 - 1
      b0 = 0.99886 * b0 + white * 0.0555179
      b1 = 0.99332 * b1 + white * 0.0750759
      b2 = 0.96900 * b2 + white * 0.1538520
      output[i] = (b0 + b1 + b2 + white * 0.5362) * 0.12
    }

    const source = ctx.createBufferSource()
    source.buffer = buffer
    source.loop = true

    const bandpass = ctx.createBiquadFilter()
    bandpass.type = 'bandpass'
    bandpass.frequency.value = 1100
    bandpass.Q.value = 0.8

    // LFO for wave modulation
    const lfo = ctx.createOscillator()
    lfo.frequency.value = 0.2 // Slow modulation
    const lfoGain = ctx.createGain()
    lfoGain.gain.value = 250
    lfo.connect(lfoGain)
    lfoGain.connect(bandpass.frequency)

    source.connect(bandpass)
    bandpass.connect(destination)

    source.start()
    lfo.start()

    this.activeNodes.push(source, bandpass, lfo, lfoGain)
  }

  /**
   * Ambient Stream: Warm dual harmonic sine drone with soft filtering
   */
  private createAmbientStream(ctx: AudioContext, destination: AudioNode) {
    const osc1 = ctx.createOscillator()
    osc1.type = 'sine'
    osc1.frequency.value = 174 // Solfeggio frequency for calm grounding

    const osc2 = ctx.createOscillator()
    osc2.type = 'sine'
    osc2.frequency.value = 175.5 // Subtle binaural pulsation

    const filter = ctx.createBiquadFilter()
    filter.type = 'lowpass'
    filter.frequency.value = 350

    const droneGain = ctx.createGain()
    droneGain.gain.value = 0.35

    osc1.connect(filter)
    osc2.connect(filter)
    filter.connect(droneGain)
    droneGain.connect(destination)

    osc1.start()
    osc2.start()

    this.activeNodes.push(osc1, osc2, filter, droneGain)
  }
}

export const focusAtmosphere = new FocusAtmosphereService()

