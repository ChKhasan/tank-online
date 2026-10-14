import Phaser from 'phaser'
import { BattleScene } from './BattleScene'
import { detectCanvasFallback } from './render-mode'
import { battleInput } from './battle-input'

export function createBattleGame(parent: HTMLElement) {
  const canvasFallback = detectCanvasFallback()
  battleInput.renderer = canvasFallback ? 'Canvas 2D' : 'WebGL'
  return new Phaser.Game({
    type: canvasFallback ? Phaser.CANVAS : Phaser.WEBGL,
    parent,
    width: parent.clientWidth,
    height: parent.clientHeight,
    backgroundColor: '#101713',
    transparent: false,
    antialias: true,
    pixelArt: false,
    scene: [BattleScene],
    scale: { mode: Phaser.Scale.RESIZE, autoCenter: Phaser.Scale.CENTER_BOTH },
    // Keep smooth texture filtering, but avoid full-canvas multisample AA.
    // It is particularly expensive with browser software WebGL renderers.
    render: { powerPreference: 'high-performance', antialiasGL: false },
  })
}
