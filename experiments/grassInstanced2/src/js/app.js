import '../scss/global.scss';
import alfrid, { Camera } from 'alfrid';
import SceneApp from './SceneApp';
import AssetsLoader from 'assets-loader';
// import dat from 'dat-gui';
import Stats from 'stats.js';

const GL = alfrid.GL;

window.params = {
	gamma:2.2,
	exposure:5,
	grassRange: 10,
	pushStrength: 1.0,
};

const assets = [
	{ id:'grass', url:'assets/img/grass.png' },
	{ id:'sky', url:'assets/img/background.jpg' },
];

if(document.body) {
	_init();
} else {
	window.addEventListener('DOMContentLoaded', _init);	
}


function _init() {

	//	LOADING ASSETS
	if(assets.length > 0) {
		document.body.classList.add('isLoading');

		let loader = new AssetsLoader({
			assets:assets
		}).on('error', function (error) {
			console.error(error);
		}).on('progress', function (p) {
			// console.log('Progress : ', p);
			let loader = document.body.querySelector('.Loading-Bar');
			if(loader) loader.style.width = (p * 100).toFixed(2) + '%';
		}).on('complete', _onImageLoaded)
		.start();	
	} else {
		_init3D();
	}

}


function _onImageLoaded(o) {
	//	ASSETS
	console.log('Image Loaded : ', o);
	window.assets = o;
	const loader = document.body.querySelector('.Loading-Bar');
	loader.style.width = '100%';

	_init3D();

	setTimeout(()=> {
		document.body.classList.remove('isLoading');
	}, 250);
}



function _init3D() {
	//	CREATE CANVAS
	let canvas = document.createElement('canvas');
	canvas.className = 'Main-Canvas';
	document.body.appendChild(canvas);

	//	INIT 3D TOOL
	GL.init(canvas);

	//	INIT DAT-GUI
	// window.gui = new dat.GUI({ width:300 });

	//	CREATE SCENE
	let scene = new SceneApp();
	
	// gui.add(params, 'pushStrength', 0, 5);
/*
	const stats = new Stats();
	document.body.appendChild(stats.domElement);
	alfrid.Scheduler.addEF(()=> {
		stats.update();
	});
*/
}