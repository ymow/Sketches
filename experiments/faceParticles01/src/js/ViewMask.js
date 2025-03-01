import alfrid, { GL } from 'alfrid'
import Assets from './Assets'
import Config from './Config'
import FaceDetector from './FaceDetector'

import vs from 'shaders/mask.vert'
import fs from 'shaders/mask.frag'

class ViewMask extends alfrid.View {
  constructor () {
    super(vs, fs)
  }

  _init () {
    this.mesh = Assets.get('mask')

    FaceDetector.on('result', (o) => this._onResult(o))
    FaceDetector.on('lost', (o) => this._onLost())
    const easing = 0.1
    this._x = new alfrid.EaseNumber(0, easing)
    this._y = new alfrid.EaseNumber(0, easing)
    this._z = new alfrid.EaseNumber(0, 0.05)

    this._rotation = new alfrid.EaseNumber(0, easing)

    this.center = [0, 0, 0]
    this.preCenter = [0, 0, 0]
  }

  _onResult (o) {
    const point0 = o[0]
    const point1 = o[1]

    const dy = point1[1] - point0[1]
    const dx = point1[0] - point0[0]

    const theta = (Math.atan2(dy, dx) - Math.PI / 2)
    this._x.value = -point1[0]
    this._y.value = -point1[1]
    this._z.value = 2

    this._rotation.value = theta
  }

  _onLost () {
    this._rotation.value = 0
    this._x.value = 0
    this._y.value = 0
    this._z.value = 0
  }

  render () {
    this.preCenter = this.center.concat()
    this.center[0] = this._x.value
    this.center[1] = this._y.value
    this.center[2] = this._z.value

    this.shader.bind()
    this.shader.uniform('uPosition', 'vec3', this.center)
    this.shader.uniform('uScale', 'float', 1.0 * Config.maskScale)
    this.shader.uniform('uRotation', 'float', this._rotation.value)
    GL.draw(this.mesh)
  }
}

export default ViewMask
