// copy.frag

#define SHADER_NAME SIMPLE_TEXTURE

precision highp float;
varying vec3 vNormal;

uniform float offset;


const vec3 color0 = vec3(1.0);
const vec3 color1 = vec3(1.0, .8, .6);


const vec3 LIGHT = vec3(1.0, .8, .6);

float diffuse(vec3 N, vec3 L) {
	return max(dot(N, normalize(L)), 0.0);
}


vec3 diffuse(vec3 N, vec3 L, vec3 C) {
	return diffuse(N, L) * C;
}

void main(void) {
	float d = diffuse(vNormal, LIGHT);
	d = mix(d, 1.0, .5);


	vec3 color = mix(color0, color1, offset);
    gl_FragColor = vec4(vec3(d) * color, 1.0);
}