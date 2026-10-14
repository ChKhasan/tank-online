class BattleInputBridge {
  x = 0
  y = 0
  fire = false
  ability = false
  zoom = 90
  zoomStep = 0
  fps = 0
  frameP95 = 0
  updateMs = 0
  renderMs = 0
  renderer = 'WebGL'

  setDirection(x: number, y: number, active: boolean) {
    if (active) { this.x = x; this.y = y }
    else if (this.x === x && this.y === y) { this.x = 0; this.y = 0 }
  }

  pulseAbility() {
    this.ability = true
  }

  consumeAbility() {
    const requested = this.ability
    this.ability = false
    return requested
  }

  reset() {
    this.x = 0; this.y = 0; this.fire = false; this.ability = false; this.zoomStep = 0
  }
}

export const battleInput = new BattleInputBridge()
