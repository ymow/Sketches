// ViewRender.js

import alfrid, { GL } from 'alfrid'
import vs from 'shaders/render.vert'
import fs from 'shaders/renderShadow.frag'
import Config from './Config'

class ViewRender extends alfrid.View {
  constructor () {
    super(vs, fs)
    this.time = Math.random() * 0xFFF
  }

  _init () {
    const positions = []
    const coords = []
    const indices = []
    let count = 0
    const numParticles = Config.numParticles
    let ux, uy

    for (let j = 0; j < numParticles; j++) {
      for (let i = 0; i < numParticles; i++) {
        ux = i / numParticles
        uy = j / numParticles
        positions.push([ux, uy, 0])
        indices.push(count)
        count++
      }
    }

    this.mesh = new alfrid.Mesh(GL.POINTS)
    this.mesh.bufferVertex(positions)
    this.mesh.bufferIndex(indices)
  }

  render (textureCurr, textureNext, p, textureExtra, textureDebug) {
    this.time += 0.1
    this.shader.bind()

    this.shader.uniform('textureCurr', 'uniform1i', 0)
    textureCurr.bind(0)

    this.shader.uniform('textureNext', 'uniform1i', 1)
    textureNext.bind(1)

    this.shader.uniform('textureExtra', 'uniform1i', 2)
    textureExtra.bind(2)

    this.shader.uniform('textureDebug', 'uniform1i', 3)
    textureDebug.bind(3)

    this.shader.uniform('uViewport', 'vec2', [GL.width, GL.height])
    this.shader.uniform('percent', 'float', p)
    this.shader.uniform('time', 'float', this.time)
    this.shader.uniform('uRotation', 'float', 0)
    GL.draw(this.mesh)
  }
}

export default ViewRender
