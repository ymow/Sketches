// terrain.vert

#define SHADER_NAME TERRAIN_VERTEX

precision highp float;
attribute vec3 aVertexPosition;
attribute vec2 aTextureCoord;
attribute vec3 aNormal;

uniform mat4 uModelMatrix;
uniform mat4 uViewMatrix;
uniform mat4 uProjectionMatrix;
uniform mat3 uNormalMatrix;
uniform mat3 uModelViewMatrixInverse;
uniform vec3 uPosition;
uniform vec3 uScale;

varying vec2 vTextureCoord;

varying vec3 vNormal;
varying vec3 vPosition;
varying vec3 vWsPosition;
varying vec3 vEyePosition;
varying vec3 vWsNormal;
varying vec4 vViewSpace;


void main(void) {
	vec3 position      		= aVertexPosition * uScale;
	position 				+= uPosition;

	vec4 worldSpacePosition	= uModelMatrix * vec4(position, 1.0);
    vec4 viewSpacePosition	= uViewMatrix * worldSpacePosition;
	
	vec3 N 					= normalize(aNormal / uScale);
    vNormal					= uNormalMatrix * N;
    vPosition				= viewSpacePosition.xyz;
	vWsPosition				= worldSpacePosition.xyz;
	vViewSpace				= viewSpacePosition;

	vec4 eyeDirViewSpace	= viewSpacePosition - vec4( 0, 0, 0, 1 );
	vEyePosition			= -vec3( uModelViewMatrixInverse * eyeDirViewSpace.xyz );
	vWsNormal				= normalize( uModelViewMatrixInverse * vNormal );
	
    gl_Position				= uProjectionMatrix * viewSpacePosition;

	vTextureCoord			= aTextureCoord;
}
