// ViewSim.js

import alfrid, { GL } from 'alfrid';
import fs from 'shaders/sim.frag';
import Config from './Config';


class ViewSim extends alfrid.View {
	
	constructor() {
		const _fs = fs.replace('${NUM}', Config.NUM_HANDS);
		super(alfrid.ShaderLibs.bigTriangleVert, _fs);
		this.time = Math.random() * 0xFF;
	}


	_init() {
		this.mesh = alfrid.Geom.bigTriangle();

		this.shader.bind();
		this.shader.uniform('textureVel', 'uniform1i', 0);
		this.shader.uniform('texturePos', 'uniform1i', 1);
		this.shader.uniform('textureExtra', 'uniform1i', 2);

		this._preHits;
		this._hits;
	}


	render(textureVel, texturePos, textureExtra, mHit, mHits) {
		if(this._hits) {
			this._preHits = this._hits.concat();
		}

		this._hits = [];

		for(let i=0; i<Config.NUM_HANDS; i++) {
			if(mHits[i]) {
				this._hits.push(mHits[i][0], mHits[i][1], mHits[i][2]);
			} else {
				this._hits.push(999, 999, 999);
			}
		} 
		if(!this._preHits) {
			this._preHits = this._hits.concat();
		}


		this.time += .01;
		this.shader.bind();
		this.shader.uniform('time', 'float', this.time);
		this.shader.uniform('maxRadius', 'float', Config.maxRadius);
		this.shader.uniform("uRange", "float", Config.range);
		this.shader.uniform("uHit", "vec3", mHit);
		this.shader.uniform("uHits", "vec3", this._hits);
		this.shader.uniform("uPreHits", "vec3", this._preHits);
		this.shader.uniform("uSkipCount", "float", Config.skipCount);
		textureVel.bind(0);
		texturePos.bind(1);
		textureExtra.bind(2);

		GL.draw(this.mesh);
	}


}

export default ViewSim;