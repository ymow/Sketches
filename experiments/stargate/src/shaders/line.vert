// basic.vert

precision highp float;
attribute vec3 aVertexPosition;
attribute vec2 aTextureCoord;
attribute vec3 aNormal;

uniform mat4 uModelMatrix;
uniform mat4 uViewMatrix;
uniform mat4 uProjectionMatrix;

uniform vec3 uPosition;
uniform vec3 uDirection;

varying vec2 vTextureCoord;
varying vec3 vNormal;

void main(void) {
	vec3 position = mix(vec3(0.0), uDirection, aVertexPosition.x);
	position += uPosition;

    gl_Position = uProjectionMatrix * uViewMatrix * uModelMatrix * vec4(position, 1.0);
    vTextureCoord = aTextureCoord;
    vNormal = aNormal;
}