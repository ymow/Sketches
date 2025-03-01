// ViewAddVel.js

import alfrid, { GL } from 'alfrid';

const frag = require('../shaders/addvel.frag');

class ViewAddVel extends alfrid.View {
	
	constructor() {
		super(alfrid.ShaderLibs.bigTriangleVert, frag);
	}


	_init() {
		this.mesh = alfrid.Geom.bigTriangle();
	}


	render(texturePos, textureVel, textureOrigin) {
		this.shader.bind();

		this.shader.uniform('texturePos', 'uniform1i', 0);
		texturePos.bind(0);

		this.shader.uniform('textureVel', 'uniform1i', 1);
		textureVel.bind(1);

		this.shader.uniform("textureOrigin", "uniform1i", 2);
		textureOrigin.bind(2);

		GL.draw(this.mesh);
	}

}

export default ViewAddVel;