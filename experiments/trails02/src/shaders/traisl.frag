// copy.frag

#define SHADER_NAME SIMPLE_TEXTURE

precision highp float;
varying vec2 vTextureCoord;
varying vec3 vNormal;
varying vec3 vColor;
varying vec3 vDebug;
varying vec4 vShadowCoord;

uniform sampler2D textureShadow;
uniform vec3 uLight;
uniform vec2 uMapSize;


#pragma glslify: diffuse = require(glsl-utils/diffuse.glsl)


float rand(vec4 seed4) {
	float dot_product = dot(seed4, vec4(12.9898,78.233,45.164,94.673));
	return fract(sin(dot_product) * 43758.5453);
}


#define NUM_LEVEL 1

float PCFShadow(sampler2D depths, vec2 size, vec4 shadowCoord) {
	float result = 0.0;
	float bias = 0.005;
	vec2 uv = shadowCoord.xy;
	float total = 1.0;

	for(int x=-NUM_LEVEL; x<=NUM_LEVEL; x++){
		for(int y=-NUM_LEVEL; y<=NUM_LEVEL; y++){
			vec2 off = vec2(x,y) + rand(vec4(gl_FragCoord.xy, float(x), float(y)));
			off /= size;

			float d = texture2D(depths, uv + off).r;
			if(d < shadowCoord.z - bias) {
				result += 1.0;
			}

			total ++;

		}
	}

	float d = texture2D(depths, uv).r;
	if(d < shadowCoord.z - bias) {
		result += 1.0;
	}

	return 1.0 -result/total;

}

void main(void) {
	if(vDebug.x < 0.0) {
			discard;
	}

	float _diffuse = diffuse(vNormal, uLight, .65);

	vec4 shadowCoord    = vShadowCoord / vShadowCoord.w;
	float s             = PCFShadow(textureShadow, uMapSize, shadowCoord);
	s                   = mix(s, 1.0, .5);

	gl_FragColor = vec4(vColor * _diffuse * s * 1.25, 1.0);
    // gl_FragColor = vec4(vec3(s), 1.0);
}