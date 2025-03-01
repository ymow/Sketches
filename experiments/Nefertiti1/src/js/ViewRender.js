// ViewRender.js

import alfrid, { GL } from 'alfrid';
import vs from '../shaders/render.vert';
import fs from '../shaders/render.frag';

class ViewRender extends alfrid.View {
	constructor() {
		super(vs, fs);
	}

	_init() {
		let positions    = [];
		let coords       = [];
		let indices      = []; 
		let count        = 0;
		let numParticles = params.numParticles;
		let ux, uy;

		for(let j=0; j<numParticles; j++) {
			for(let i=0; i<numParticles; i++) {
				ux = i/numParticles;
				uy = j/numParticles;
				positions.push([ux, uy, 0]);
				indices.push(count);
				count ++;

			}
		}

		this.mesh = new alfrid.Mesh(GL.POINTS);
		this.mesh.bufferVertex(positions);
		this.mesh.bufferIndex(indices);
	}


	render(texture, textureNext, percent) {
		this.shader.bind();
		this.shader.uniform("texture", "uniform1i", 0);
		texture.bind(0);
		this.shader.uniform("textureNext", "uniform1i", 1);
		textureNext.bind(1);
		this.shader.uniform("percent", "uniform1f", percent);
		GL.draw(this.mesh);
	}
}


export default ViewRender;