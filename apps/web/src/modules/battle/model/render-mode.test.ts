import { expect, it } from 'vitest'
import { preferCanvas } from './render-mode'
it('keeps accelerated GPUs on WebGL and routes software rendering to Canvas', () => {
  expect(preferCanvas('ANGLE (Intel UHD Graphics)', true)).toBe(false)
  expect(preferCanvas('ANGLE NVIDIA RTX', true)).toBe(false)
  expect(preferCanvas('ANGLE (Google, Vulkan SwiftShader Device)', true)).toBe(true)
  expect(preferCanvas('Mesa llvmpipe', true)).toBe(true)
  expect(preferCanvas('', false)).toBe(true)
})
