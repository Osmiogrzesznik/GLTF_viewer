import * as THREE from '../../build/three.module.js';
console.log('./../build/three.module. OK');
import Stats from '../jsm/libs/stats.module.js';
import {
	OrbitControls
} from '../jsm/controls/OrbitControls.js';
import {
	GLTFLoader
} from '../jsm/loaders/GLTFLoader.js';
import {
	RGBELoader
} from '../jsm/loaders/RGBELoader.js';

import {
	KTX2Loader
} from '../jsm/loaders/KTX2Loader.js';
import {
	DRACOLoader
} from '../jsm/loaders/DRACOLoader.js';
import {
	MeshoptDecoder
} from '../jsm/libs/meshopt_decoder.module.js';
import {
	OutlinePass
}
from '../jsm/postprocessing/OutlinePass.js';
import {
	EffectComposer
} from '../jsm/postprocessing/EffectComposer.js';
import {
	RenderPass
} from '../jsm/postprocessing/RenderPass.js';
import {
	ShaderPass
} from '../jsm/postprocessing/ShaderPass.js';
import {
	GammaCorrectionShader
} from '../jsm/shaders/GammaCorrectionShader.js'
// import {
// 	RoughnessMipmapper
// } from '../jsm/utils/RoughnessMipmapper.js';



import {
	environments
} from '../environment/index.js';
import {
	GUI
} from './dat.gui.module.js';


console.log('importing aviewer');
window.THREE = THREE;

const DEFAULT_CAMERA = '[default]';

const IS_IOS = isIOS();

//TODO 
/*
AS THEere are 3 car mpdels, of which some do not contain all parts
it is worth considering either rearranging the stricture
of app or make auto tweening between models
TODO: tweening
*/

// glTF texture types. `envMap` is deliberately omitted, as it's used internally
// by the loader but not part of the glTF format.
const MAP_NAMES = [
	'map',
	'aoMap',
	'emissiveMap',
	'glossinessMap',
	'metalnessMap',
	'normalMap',
	'roughnessMap',
	'specularMap',
];

const Preset = {
	ASSET_GENERATOR: 'assetgenerator'
};

//Cache.enabled = true;

// TODO: loading screen
export class Viewer {

	constructor(el, options) {
		this.el = el;
		console.log(el);
		// debugger;
		this.options = options;
		this.customAnimations = options.customAnimations;
		this.interactor = options.interactor
		this.timeoutIdOfautoPresentationNext = null
		this.lights = [];
		this.content = null;
		this.mixer = null;
		this.clips = [];
		this.gui = null;
		this.helper = null;
		this.cameraStartHelper = null;
		this.raycaster = new THREE.Raycaster();
		this.pointer = new THREE.Vector2();
		this.pointerOrig = new THREE.Vector2();

		this.popup = document.getElementById('popup')

		this.state = {
			nextToLookAt: null,
			autoPresentation: true,
			autoPresentationIndex: 0,
			selectedDefect: null,
			markerMeshesStates: {},
			marker_rotation: 0,
			lookAtPartStates: {},
			lookedAt: null,
			lookedAtCenter: new THREE.Vector3(),
			lastLookedAtCenter: new THREE.Vector3(),
			environment: options.preset === Preset.ASSET_GENERATOR ?
				environments.find((e) => e.id === 'autoshop_01_1k').name : environments[1].name,
			background: false,
			playbackSpeed: 1.0,
			actionStates: {},
			camera: DEFAULT_CAMERA,
			wireframe: false,
			skeleton: false,
			grid: false,

			// Lights
			tweening: false,
			addLights: true,
			exposure: 1.0,
			textureEncoding: 'sRGB',
			ambientIntensity: 0.3,
			marker_color: 0xFFFFFF,
			directIntensity: 0.8 * Math.PI, // TODO(#116)
			directColor: 0xFFFFFF,
			bgColor1: '#0a0a0a',
			bgColor2: '#000000',
			bgColor0: new THREE.Color('#000'),
		};

		this.prevTime = 0;

		this.stats = new Stats();
		this.stats.dom.height = '48px';
		[].forEach.call(this.stats.dom.children, (child) => (child.style.display = ''));

		this.scene = new THREE.Scene();

		const fov = options.preset === Preset.ASSET_GENERATOR ?
			0.8 * 180 / Math.PI :
			80;

		this.defaultCamera = new THREE.PerspectiveCamera(fov, el.clientWidth / el.clientHeight, 0.005, 1000);
		this.defaultCamera.name = DEFAULT_CAMERA;
		this.activeCamera = this.defaultCamera;
		this.scene.add(this.defaultCamera);
		// this.scene.fog = new THREE.Fog(0x000000, 10, 100);
		this.scene.background = new THREE.Color('#000000'); // red

		this.renderer = window.renderer = new THREE.WebGLRenderer({
			antialias: true
		});
		this.renderer.domElement.style.opacity = 1;
		this.renderer.gammaFactor = 0;









		this.renderer.physicallyCorrectLights = true;
		this.renderer.outputEncoding = THREE.sRGBEncoding;
		this.renderer.setClearColor(0xcccccc);
		this.renderer.setPixelRatio(window.devicePixelRatio);
		this.renderer.setSize(el.clientWidth, el.clientHeight);

		this.pmremGenerator = new THREE.PMREMGenerator(this.renderer);
		this.pmremGenerator.compileEquirectangularShader();

		this.controls = new OrbitControls(this.defaultCamera, this.renderer.domElement);
		this.controls.autoRotate = false;
		this.controls.autoRotateSpeed = -1;
		this.controls.screenSpacePanning = true;

		// this.vignette = createBackground({
		// 	aspect: this.defaultCamera.aspect,
		// 	grainScale: IS_IOS ? 0 : 0.001, // mattdesl/three-vignette-background#1
		// 	colors: [this.state.bgColor1, this.state.bgColor2]
		// });
		// this.vignette.name = 'Vignette';
		// this.vignette.renderOrder = -1;

		this.el.appendChild(this.renderer.domElement);
		this.renderer.domElement.addEventListener('pointerup', function (e) {
			this.onPointerUpHandler(e)
		}.bind(this));
		this.renderer.domElement.addEventListener('pointerdown', function (e) {
			this.onPointerDownHandler(e)
		}.bind(this));

		this.cameraCtrl = null;
		this.cameraFolder = null;
		this.animFolder = null;
		this.animCtrls = [];
		this.lookkAtPartCtrls = [];
		this.defectCtrls = [];
		this.morphFolder = null;
		this.morphCtrls = [];
		this.skeletonHelpers = [];
		this.gridHelper = null;
		this.axesHelper = null;
		this.markers = [];
		this.originialMarkerMeshes = {};

		this.addAxesHelper();
		this.addGUI();
		if (options.kiosk) this.gui.close();

		this.animate = this.animate.bind(this);
		requestAnimationFrame(this.animate);
		window.addEventListener('resize', this.resize.bind(this), false);

		//--------------------------------------------------OUTLINE
		this.composer = new EffectComposer(this.renderer);
		this.renderPass = new RenderPass(this.scene, this.activeCamera);
		this.composer.addPass(this.renderPass);

		this.outlinePass = new OutlinePass(new THREE.Vector2(window.innerWidth, window.innerHeight), this.scene, this.activeCamera);
		this.gammaCorrection = new ShaderPass(GammaCorrectionShader);
		this.composer.addPass(this.outlinePass);
		this.composer.addPass(this.gammaCorrection);
		//todo add to gui settings

		this.outlinePass.visibleEdgeColor.set(0x0088ff);
		this.outlinePass.edgeStrength = 5;

		this.outlinePass.edgeGlow = 1;
		this.outlinePass.pulsePeriod = 3;
		//this.outlinePass.overlayMaterial.blending = THREE.SubtractiveBlending;


	}
	autoPresentationNext(dir = 1) {

		window.clearTimeout(this.timeoutIdOfautoPresentationNext);
		let arr = this.labeledMeshes;
		this.state.autoPresentationIndex += dir;
		let ind = this.state.autoPresentationIndex;
		console.log({
			ind,
			arr,
		})
		if ((ind > arr.length - 1)) {
			this.state.autoPresentationIndex = ind = 1;
		}
		if ((ind <= 0)) {
			this.state.autoPresentationIndex = ind = arr.length - 1;
		}
		this.focusActiveCameraOnObject(arr[ind]);
	}
	animate(time) {

		requestAnimationFrame(this.animate);

		const dt = (time - this.prevTime) / 1000;
		if (this.customAnimations) {
			this.customAnimations.update(time);
		}
		this.controls.update();
		this.stats.update();
		this.mixer && this.mixer.update(dt);
		this.render(time);

		this.prevTime = time;

	}
	onPointerDownHandler(event) {

		this.controls.enabled = true;
		tweenCamPos.pause()
		tweenControlsTarget.pause()
		window.clearTimeout(this.timeoutIdOfautoPresentationNext);


	}
	onPointerUpHandler(event) {
		this.timeoutIdOfautoPresentationNext = window.setTimeout(f => this.autoPresentationNext(), Math.abs(this.rotspeed) * 10);
		tweenCamPos.resume()
		tweenControlsTarget.resume()

		// this.autoPresentation = false;
		//marker placement should be on hover
		// turn off or modify click listener, turn hover on
		// add click listener that actually saves the place of the marker
		// and clones the marker mesh to continue placing
		// this way is easy to add longer creases etc.
		//only clicking
		// debugger;
		this.scene.traverse(node => {
			// console.log(node)
			node.updateMatrixWorld()
		});
		this.activeCamera.updateProjectionMatrix()

		this.pointer.x = (event.clientX / this.el.clientWidth) * 2 - 1;
		this.pointer.y = -(event.clientY / this.el.clientHeight) * 2 + 1;
		this.pointerOrig.x = event.clientX;
		this.pointerOrig.y = event.clientY;

		// debugger;
		// console.log(this.pointer)
		this.raycaster.setFromCamera(this.pointer, this.activeCamera);

		// calculate objects intersecting the picking ray
		const intersects = this.raycaster.intersectObjects(this.content.children, false);

		// for (let i = 0; i < intersects.length; i++) {
		if (!intersects.length) {
			//was just rotating - no object!
			window.clearTimeout(this.timeoutIdOfautoPresentationNext);
			// this.focusActiveCameraOnObject(clickedObject);

			return
		}
		if (intersects.length) {
			let clickedObject = intersects[0].object;
			if (!this.interactor.canBeInteracted(clickedObject)) {
				return;
			}

			this.interactor.interact(clickedObject, this)


			window.clearTimeout(this.timeoutIdOfautoPresentationNext);
			this.focusActiveCameraOnObject(clickedObject);
			this.popup.style.left = this.pointer.x
			this.popup.style.top = this.pointer.y
			// console.log(intersects)

			// if (this.labeledMeshes.includes(u.parent.parent)) {
			// 	u = u.parent.parent;
			// } else if (this.labeledMeshes.includes(u.parent)) {
			// 	u = u.parent;
			// } else if (this.labeledMeshes.includes(u)) {
			// 	u = u;
			// } else {
			// 	u = null;
			// }


			//tween to new position now everything works





		}

	}
	placeMarkerClone() {

		if (!this.state.selectedDefect) {
			console.log('first choose type of defect')
			return;
		}
		let sd = window.sd = this.state.selectedDefect;
		let csd = sd.clone()
		this.scene.add(csd)
		this.markers.push(csd)
		let guiObj = {}
		this.placedCount++
		guiObj[csd.name] = () => {
			window.m = csd
			console.log('EDITING placed marker')
		};
		this.placedFolder.add(guiObj, csd.name)
		// localStorage.setItem("part Defects", )
	}
	placeMarker(intersects) {

		let helper = this.state.selectedDefect;
		helper.position.set(0, 0, 0);
		helper.lookAt(intersects[0].face.normal);
		let v = intersects[0].point.clone()
		let o = intersects[0].object.position.clone();
		intersects[0].object.updateMatrixWorld()
		// v.negate()
		//v.add(intersects[0].object.position.clone())
		helper.position.copy(v);
		window.d = v.clone().add(o.clone().negate())
		window.v = v.clone()
		window.o = o;
		window.intersects = intersects;
		window.helper = helper;
	}
	enterPlacingMarkerState(consideredMarker) {


		// this.renderer.domElement.addEventListener('pointermove', function (e) {
		// 	this.onPointerUpHandler(e)
		// }.bind(this));
		// TODO: 2 cases :
		/* 	- no marker was selected and now one is selected
			- different marker was selected
			- allow for change of placement of added marker
		*/
		if (this.state.selectedDefect) {
			/*
			if state was placingDefects and marker was placed, ask : are you happy with current marker
			add marker , save part state to db and proceed with new marker
			*/
			/*
			if state was placingDefects and marker was not placed , just reset what is needed and continue
			*/
		}
	}

	focusActiveCameraOnObject(obj) {
		if (this.activeCamera.name !== DEFAULT_CAMERA) {
			return;
		}
		let camera = this.activeCamera;

		// let camera = this.cam_dummy;


		// TODO : tween to new position - its a must
		// TODO : automatic presentation mode where app cycles itself through parts
		// because each part has different size generate maybe camera orbit animations in blender  just the positions for respective focus parts 
		// and use these empties in  three js as positions, on click would stop the animation
		// TODO : animate NOT looked at centre box , but position (look at position - blender 'origin' )
		// TODO: on finish to keep camera distanced to animated element try to calculate worldTolocal and parent camera in onComplete callback of GSAP
		camera.parent = null;

		if (!obj) {
			throw Error("no object for focusActiveCameraOnObject")
			this.controls.reset();
			return;

		} else {
			this.state.lookedAt = obj;
			this.popup = document.getElementById('popup')
			this.popup.style.position = "absolute";
			this.popup.style.left = this.pointerOrig.x + "px";
			this.popup.style.top = this.pointerOrig.y + "px";

			popup.innerText = `obj:${obj.name} x:${this.pointerOrig.x} y:${this.pointerOrig.y}`;
			// this.focusActiveCameraOnObject(obj)
			///update selection state
			let changedCheckboxName = obj.name;
			// reset all checkbox states to false
			Object.keys(this.state.lookAtPartStates).forEach(nm => this.state.lookAtPartStates[nm] = false);
			//set currently clicked to true
			this.state.lookAtPartStates[changedCheckboxName] = true;

			this.outlinePass.selectedObjects[0] = obj;

			// this.controls.AutoRotate = true;
			// this.controls.rotateSpeed
			if (this.mixer) {
				// this.mixer.stopAllAction()
				let clickedObjectActionName = obj.name.replace(/_/g, " ") + "Action"
				this.clips.forEach((clip) => {
					if (clip.name === clickedObjectActionName) {
						// this.mixer.clipAction(clip).reset().play()
					} else {
						// debugger;
						// this.mixer.clipAction(clip).reset().play();
						// this.state.actionStates[clip.name] = true;
					}
				});
				// debugger;

				//this.mixer.clipAction().reset()
				// this.state.





			}
			const box = new THREE.Box3().setFromObject(obj);
			const size = box.getSize(new THREE.Vector3()).length();
			//if (lookedatcenter is either null or wrong ar start)
			const center = box.getCenter(new THREE.Vector3());
			this.state.lastLookedAtCenter = this.state.lookedAtCenter;
			this.state.lookedAtCenter = center;


			let tweenedLookedAtCenter = this.state.lastLookedAtCenter;
			this.state.tweenedLookedAtCenter = tweenedLookedAtCenter;
			// this.controls.reset();
			this.controls.maxDistance = camera.position.distanceTo(center);

			this.controls.target = tweenedLookedAtCenter;
			let nuLookedAtCenter = center;
			// TODO TEST ON SOME VISIBLE OBJECT
			window.c = this.controls
			var controls = this.controls;
			this.controls.autoRotate = this.state.autoPresentation


			//TODO 
			/*
			two world coordinates to be calculated
*/
			// TODO : w trybie auto po tym jak czesc odjedzie obrot 360 stopni
			let tweenDuration = 5;
			let cameraEndPos = new THREE.Vector3();
			cameraEndPos.copy(center);
			cameraEndPos.y += this.options.autoCamera.minHeight + (Math.random() * maxHeight);
			cameraEndPos.x -= size * 60;
			cameraEndPos.z += size * 50;

			// console.log('position before parenting', this.cam_dummy.localToWorld(new THREE.Vector3(0, 0, 0)));
			// this.cam_dummy.parent = obj;
			// this.cam_dummy.updateWorldMatrix();
			// console.log('position after parenting', this.cam_dummy.localToWorld(new THREE.Vector3(0, 0, 0)));
			// this.cam_dummy.parent = null;
			// this.cam_dummy.lookAt(tweenedLookedAtCenter);
			// this.cam_dummy.updateWorldMatrix();

			// tween two coordinates : 
			/* camera.position AND tweenedLookedAtCenter */


			window.tweenCamPos = gsap.to(camera.position, {
				duration: tweenDuration,
				y: cameraEndPos.y,
				x: cameraEndPos.x,
				z: cameraEndPos.z,
				ease: 'power1.inOut',
				onStart: f => {

					// this.controls.autoRotateSpeed = -this.controls.autoRotateSpeed
					controls.autoRotate = false;
					this.state.tweening = true;
					controls.enabled = false;
				},
				onUpdate: f => {
					// console.log({
					// 	camera.position
					// });
					// controls.update();
				},
				onComplete: f => {
					controls.autoRotate = true;
					controls.enabled = true;
					this.state.tweening = false;
					if (this.state.autoPresentation) {
						window.clearTimeout(this.timeoutIdOfautoPresentationNext);
						this.timeoutIdOfautoPresentationNext = window.setTimeout(f => this.autoPresentationNext(), Math.abs(this.rotspeed) * 5000);
					}
				}
			});

			window.tweenControlsTarget = gsap.to(controls.target, {
				duration: tweenDuration,
				y: nuLookedAtCenter.y,
				x: nuLookedAtCenter.x,
				z: nuLookedAtCenter.z,
				ease: 'power1.inOut',
				onStart: f => {
					this.state.tweening = true;
					// controls.enabled = false;
				},
				onUpdate: f => {
					// controls.update();
					// console.log(tweenedLookedAtCenter);
				},
				onComplete: f => {
					controls.enabled = true;
					this.state.tweening = false;

				}
			});
		}
		// this.activeCamera.p
		//this.activeCamera.position.set(200, 0, -100)


		//outline
		// debugger

		//TODO: selectedObjects should be both on hover and selection - this way you can see if click will result in selection
	}


	render() {

		// not in render
		//________________________________________
		if (this.labels && this.labels.length) {

			this.labels.forEach(label => {

				label.lookAt(this.activeCamera.position)
				// label.lookAt(this.cam_dummy.position)
			})
		}


		//this never executes ? 
		// if (this.state.lookedAt) {
		// 	// console.log(this.state.lookedAt.position)
		// 	if (this.state.tweening) {
		// 		this.controls.target = this.state.tweenedLookedAtCenter;
		// 		this.activeCamera.lookAt(this.state.tweenedLookedAtCenter)
		// 		// this.cam_dummy.lookAt(this.state.tweenedLookedAtCenter)
		// 		//this.cam_dummy.lookAt(this.state.lookedAt.position)

		// 	}
		// 	//this.controls.enabled = false;
		// 	// console.log(this.state.lookedAt.position);
		// 	else {
		// 		// TODO : camera ends up looking at original position of the object not at animated one
		// 		let box = new THREE.Box3().setFromObject(this.state.lookedAt);
		// 		let center = box.getCenter(new THREE.Vector3());
		// 		this.controls.target = this.state.lookedAt.position;
		// 		// this.controls.update();
		// 		// this.activeCamera.lookAt(center)
		// 		// this.cam_dummy.lookAt(this.state.lookedAt.position);
		// 	}

		// 	// this.activeCamera.position.copy(this.state.lookedAt.position)
		// }
		//not in render
		//_________________________________

		//this.renderer.render(this.scene, this.activeCamera);
		this.composer.render();


		//here look at stored selected object
		if (this.state.grid) {
			this.axesCamera.position.copy(this.defaultCamera.position)
			this.axesCamera.lookAt(this.axesScene.position)
			//here look at stored selected object
			this.axesRenderer.render(this.axesScene, this.axesCamera);
		}
	}

	resize() {

		const {
			clientHeight,
			clientWidth
		} = this.el.parentElement;

		this.defaultCamera.aspect = clientWidth / clientHeight;
		this.defaultCamera.updateProjectionMatrix();

		this.activeCamera.aspect = clientWidth / clientHeight;
		this.activeCamera.updateProjectionMatrix();
		// this.vignette.style({
		// 	aspect: this.defaultCamera.aspect
		// });
		this.renderer.setSize(clientWidth, clientHeight);
		this.composer.setSize(clientWidth, clientHeight);

		this.axesCamera.aspect = this.axesDiv.clientWidth / this.axesDiv.clientHeight;
		this.axesCamera.updateProjectionMatrix();
		this.axesRenderer.setSize(this.axesDiv.clientWidth, this.axesDiv.clientHeight);
	}

	load(url, rootPath, assetMap) {


		const baseURL = THREE.LoaderUtils.extractUrlBase(url);

		// Load.
		return new Promise((resolve, reject) => {



			// Intercept and override relative URLs.
			// manager.setURLModifier((url, path) => {

			// 	// URIs in a glTF file may be escaped, or not. Assume that assetMap is
			// 	// from an un-escaped source, and decode all URIs before lookups.
			// 	// See: https://github.com/donmccurdy/three-gltf-viewer/issues/146
			// 	const normalizedURL = rootPath + decodeURI(url)
			// 		.replace(baseURL, '')
			// 		.replace(/^(\.?\/)/, '');

			// 	if (assetMap.has(normalizedURL)) {
			// 		const blob = assetMap.get(normalizedURL);
			// 		const blobURL = URL.createObjectURL(blob);
			// 		blobURLs.push(blobURL);
			// 		return blobURL;
			// 	}

			// 	return (path || '') + url;

			// });

			const loader = new GLTFLoader().setPath("")
				.setCrossOrigin('anonymous')
				// .setDRACOLoader(
				// 	new DRACOLoader().setDecoderPath('assets/wasm/')
				// )
				// .setKTX2Loader(
				// 	new KTX2Loader()
				// 	.setTranscoderPath('assets/wasm/')
				// 	.detectSupport(this.renderer)
				// )
				.setMeshoptDecoder(MeshoptDecoder);

			const blobURLs = [];

			loader.load(url, (gltf) => {

				const scene = gltf.scene || gltf.scenes[0];
				const clips = gltf.animations || [];

				if (!scene) {
					// Valid, but not supported by this viewer.
					throw new Error(
						'This model contains no scene, and cannot be viewed here. However,' +
						' it may contain individual 3D resources.'
					);
				}

				this.setContent(scene, clips);

				blobURLs.forEach(URL.revokeObjectURL);

				// See: https://github.com/google/draco/issues/349
				// DRACOLoader.releaseDecoderModule();
				this.interactor.progressFinished();
				resolve(gltf);

			}, xhri => {
				//xhri - XMLHttpRequest instance

				this.interactor.progressUpdate(xhri);

			}, reject);

		});

	}

	/**
	 * @param {THREE.Object3D} object
	 * @param {Array<THREE.AnimationClip} clips
	 */
	setContent(object, clips) {

		this.clear();
		this.scene.add(object);
		this.content = object;

		this.state.addLights = true;
		this.cameraStartHelper = object.getObjectByName("cameraStartHelper");
		// let sponge = object.getObjectByName("Sponge230");

		this.content.traverse((node) => {
			if (this.customAnimations) {
				this.customAnimations.prepare(node)
			}

			if (node.name === "cameraStartHelper") {
				this.cameraStartHelper = node
			}
			if (node.isLight) {
				this.state.addLights = false;
			} else if (node.isMesh) {
				// TODO(https://github.com/mrdoob/three.js/pull/18235): Clean up.
				node.material.depthWrite = !node.material.transparent;

			}
		});

		if (this.customAnimations) {
			this.customAnimations.onAfterPrepare(clips)
		}


		this.cam_dummy = object.getObjectByName("cam_dummy")
		if (!this.cam_dummy) {
			this.cam_dummy = new THREE.Object3D()

		}
		const box = new THREE.Box3().setFromObject(object);
		const size = box.getSize(new THREE.Vector3()).length();

		let center = box.getCenter(new THREE.Vector3());

		// this.controls.reset();
		this.controls.maxDistance = size * 20;
		this.activeCamera.near = size / 100;
		this.activeCamera.far = size * 100;
		this.activeCamera.updateProjectionMatrix();

		this.rotspeed = -2
		this.controls.autoRotateSpeed = this.rotspeed;




		if (this.options.cameraOptions) {

			this.activeCamera.position.fromArray(this.options.options.cameraOptions.position);
			this.state.lookedAtCenter = this.labeledMeshes[0].position.clone()
			this.controls.target.copy(this.state.lookedAtCenter);
			this.activeCamera.position.fromArray(this.options.options.cameraOptions.position);


		} else {
			if (this.cameraStartHelper) {
				this.activeCamera.position.copy(this.cameraStartHelper.position);
				this.state.lookedAtCenter = center
				this.controls.target.copy(this.state.lookedAtCenter);
			} else {
				this.activeCamera.position.copy(center);
				this.defaultCamera.position.x -= size / 2.0;
				this.defaultCamera.position.y -= size / 5.0;
				this.defaultCamera.position.z -= size / 2.0;
				this.state.lookedAtCenter = center
				this.controls.target.copy(this.state.lookedAtCenter);
			}

		}
		this.setCamera(DEFAULT_CAMERA);

		this.axesCamera.position.copy(this.activeCamera.position)
		this.axesCamera.lookAt(this.axesScene.position)
		this.axesCamera.near = size / 100;
		this.axesCamera.far = size * 100;
		this.axesCamera.updateProjectionMatrix();
		this.axesCorner.scale.set(size, size, size);





		this.setClips(clips);

		this.updateLights();
		this.updateGUI();
		this.updateEnvironment();
		this.updateTextureEncoding();
		this.updateDisplay();

		window.content = this.content;
		console.info('[glTF Viewer] THREE.Scene exported as `window.content`.');
		this.printGraph(this.content);
		this.scene.background.set('#000000');

		// added - on start there was blank screen, this makes 
		this.resize.bind(this)()

		if (this.state.autoPresentation) {
			const box = new THREE.Box3().setFromObject(this.labeledMeshes[0]);
			const center = box.getCenter(new THREE.Vector3());
			const size = box.getSize(new THREE.Vector3()).length();
			this.controls.maxDistance = this.activeCamera.position.distanceTo(center);
			this.controls.target.copy(center)
			this.state.lookedAtCenter = center;
			// this.state.lookedAtCenter = this.labeledMeshes[0].position;
			// this.activeCamera.lookAt(this.labeledMeshes[1]);

			window.tweenFirstZoom = gsap.to(this.controls, {
				maxDistance: size * 2, // target min distance
				duration: 6,
				overwrite: 'auto',
				ease: 'power1.out',
				onComplete: () => {
					window.clearTimeout(this.timeoutIdOfautoPresentationNext);
					this.timeoutIdOfautoPresentationNext = window.setTimeout(f => this.autoPresentationNext(), Math.abs(this.rotspeed) * 10);
					// this.controls.reset()
					//this.controls.maxDistance = 10 // reset to initial min distance

				},
			})

			// window.setTimeout(f => this.autoPresentationNext(), 5000);
		}
	}

	printGraph(node) {

		console.group(' <' + node.type + '> ' + node.name);
		node.children.forEach((child) => this.printGraph(child));
		console.groupEnd();

	}

	/**
	 * @param {Array<THREE.AnimationClip} clips
	 */
	setClips(clips) {
		if (this.mixer) {
			this.mixer.stopAllAction();
			this.mixer.uncacheRoot(this.mixer.getRoot());
			this.mixer = null;
		}

		this.clips = clips;
		if (!clips.length) return;

		this.mixer = new THREE.AnimationMixer(this.content);
	}

	playAllClips() {
		this.clips.forEach((clip) => {
			this.mixer.clipAction(clip).reset().play();
			this.state.actionStates[clip.name] = true;
		});
	}

	/**
	 * @param {string} name
	 */
	setCamera(name) {

		if (name === DEFAULT_CAMERA) {
			this.controls.enabled = true;
			this.activeCamera = this.defaultCamera;
		} else {
			this.controls.enabled = false;
			this.content.traverse((node) => {
				if (node.isCamera && node.name === name) {
					this.activeCamera = node;
				}
			});
		}
	}

	updateTextureEncoding() {
		const encoding = this.state.textureEncoding === 'sRGB' ?
			THREE.sRGBEncoding :
			THREE.LinearEncoding;
		traverseMaterials(this.content, (material) => {
			if (material.map) material.map.encoding = encoding;
			if (material.emissiveMap) material.emissiveMap.encoding = encoding;
			if (material.map || material.emissiveMap) material.needsUpdate = true;
		});
	}

	updateLights() {
		const state = this.state;
		const lights = this.lights;

		if (state.addLights && !lights.length) {
			this.addLights();
		} else if (!state.addLights && lights.length) {
			this.removeLights();
		}

		this.renderer.toneMappingExposure = state.exposure;

		if (lights.length === 2) {
			lights[0].intensity = state.ambientIntensity;
			lights[0].color.setHex(state.ambientColor);
			lights[1].intensity = state.directIntensity;
			lights[1].color.setHex(state.directColor);
		}
	}

	addLights() {
		const state = this.state;

		if (this.options.preset === Preset.ASSET_GENERATOR) {
			const hemiLight = new THREE.HemisphereLight();
			hemiLight.name = 'hemi_light';
			this.scene.add(hemiLight);
			this.lights.push(hemiLight);
			return;
		}

		const light1 = new THREE.AmbientLight(state.ambientColor, state.ambientIntensity);
		light1.name = 'ambient_light';
		this.defaultCamera.add(light1);

		const light2 = new THREE.DirectionalLight(state.directColor, state.directIntensity);
		light2.position.set(0.5, 0, 0.866); // ~60º
		light2.name = 'main_light';
		this.defaultCamera.add(light2);

		this.lights.push(light1, light2);
	}

	removeLights() {

		this.lights.forEach((light) => light.parent.remove(light));
		this.lights.length = 0;

	}

	updateEnvironment() {

		const environment = environments.filter((entry) => entry.name === this.state.environment)[0];

		this.getCubeMapTexture(environment).then(({
			envMap
		}) => {

			// if ((!envMap || !this.state.background) && this.activeCamera === this.defaultCamera) {
			// 	this.scene.add(this.vignette);
			// } else {
			// 	this.scene.remove(this.vignette);
			// }

			this.scene.environment = envMap;
			this.scene.background = this.state.background ? envMap : this.state.bgColor0;

		});

	}

	getCubeMapTexture(environment) {
		const {
			path
		} = environment;

		// no envmap
		if (!path) return Promise.resolve({
			envMap: null
		});

		return new Promise((resolve, reject) => {

			new RGBELoader()
				.setDataType(THREE.UnsignedByteType)
				.load(path, (texture) => {

					const envMap = this.pmremGenerator.fromEquirectangular(texture).texture;
					this.pmremGenerator.dispose();

					resolve({
						envMap
					});

				}, undefined, reject);

		});

	}

	updateDisplay() {
		if (this.skeletonHelpers.length) {
			this.skeletonHelpers.forEach((helper) => this.scene.remove(helper));
		}

		traverseMaterials(this.content, (material) => {
			material.wireframe = this.state.wireframe;
		});

		this.content.traverse((node) => {
			if (node.isMesh && node.skeleton && this.state.skeleton) {
				const helper = new THREE.SkeletonHelper(node.skeleton.bones[0].parent);
				helper.material.linewidth = 3;
				this.scene.add(helper);
				this.skeletonHelpers.push(helper);
			}
		});

		if (this.state.grid !== Boolean(this.gridHelper)) {
			if (this.state.grid) {
				this.gridHelper = new THREE.GridHelper();
				this.axesHelper = new THREE.AxesHelper();
				this.axesHelper.renderOrder = 999;
				this.axesHelper.onBeforeRender = (renderer) => renderer.clearDepth();
				this.scene.add(this.gridHelper);
				this.scene.add(this.axesHelper);
			} else {
				this.scene.remove(this.gridHelper);
				this.scene.remove(this.axesHelper);
				this.gridHelper = null;
				this.axesHelper = null;
				this.axesRenderer.clear();
			}
		}
	}

	updateBackground() {
		this.scene.background.set(this.state.bgColor1)
		console.log(this.state.bgColor1)
		// this.vignette.style({
		// 	colors: [this.state.bgColor1, this.state.bgColor2]
		// });
	}

	/**
	 * Adds AxesHelper.
	 *
	 * See: https://stackoverflow.com/q/16226693/1314762
	 */
	addAxesHelper() {
		this.axesDiv = document.createElement('div');
		this.el.appendChild(this.axesDiv);
		this.axesDiv.classList.add('axes');

		const {
			clientWidth,
			clientHeight
		} = this.axesDiv;

		this.axesScene = new THREE.Scene();
		this.axesCamera = new THREE.PerspectiveCamera(50, clientWidth / clientHeight, 0.1, 10);
		this.axesScene.add(this.axesCamera);

		this.axesRenderer = new THREE.WebGLRenderer({
			alpha: true
		});
		this.axesRenderer.setPixelRatio(window.devicePixelRatio);
		this.axesRenderer.setSize(this.axesDiv.clientWidth, this.axesDiv.clientHeight);

		this.axesCamera.up = this.defaultCamera.up;

		this.axesCorner = new THREE.AxesHelper(5);
		this.axesScene.add(this.axesCorner);
		this.axesDiv.appendChild(this.axesRenderer.domElement);
	}

	addGUI() {
		//here loop through all objects and allow selection,
		//to focus the orbit controls targeting selected object
		//base it on looping through clips activate animatiin 
		const gui = this.gui = new GUI({
			autoPlace: false,
			width: 260,
			hideable: true
		});

		// Display controls.
		const partFolder = gui.addFolder('Part')
		this.partFolder = partFolder;
		this.defectFolder = gui.addFolder('Add Defect')
		this.defectFolder.add(this.state, 'marker_rotation', 0, 180),
			this.defectFolder.addColor(this.state, 'marker_color'),

			//marker placement should be on hover
			// turn off click listener, turn hover on
			// add click listener that actually saves the place of the marker
			// and clones the marker mesh to continue placing
			// this way looks better feels better is easy to add longer creases etc.
			//only clicking
			//TODO: add rotation and scale controls
			this.placedFolder = gui.addFolder('placed');



		this.defectFolder.add({
			place: () => {
				if (!this.state.selectedDefect) {
					return;
				}
				this.placeMarkerClone()

			}
		}, 'place');

		const dispFolder = gui.addFolder('Display');
		const envBackgroundCtrl = dispFolder.add(this.state, 'background');
		envBackgroundCtrl.onChange(() => this.updateEnvironment());
		const wireframeCtrl = dispFolder.add(this.state, 'wireframe');
		wireframeCtrl.onChange(() => this.updateDisplay());
		const gridCtrl = dispFolder.add(this.state, 'grid');
		gridCtrl.onChange(() => this.updateDisplay());
		dispFolder.add(this.controls, 'autoRotate');
		dispFolder.add(this.controls, 'screenSpacePanning');
		const bgColor1Ctrl = dispFolder.addColor(this.state, 'bgColor1', 0, 1);
		bgColor1Ctrl.onChange(() => this.updateBackground());



		// Lighting controls.
		const lightFolder = gui.addFolder('Lighting');
		const envMapCtrl = lightFolder.add(this.state, 'environment', environments.map((env) => env.name));
		envMapCtrl.onChange(() => this.updateEnvironment());
		[
			lightFolder.add(this.state, 'addLights').listen(),
			lightFolder.add(this.state, 'directIntensity', 0, 4), // TODO(#116)
			lightFolder.addColor(this.state, 'directColor'),
		].forEach((ctrl) => ctrl.onChange(() => this.updateLights()));

		// Animation controls.
		this.animFolder = gui.addFolder('Animation');
		this.animFolder.domElement.style.display = 'none';
		const playbackSpeedCtrl = this.animFolder.add(this.state, 'playbackSpeed', 0, 1);
		playbackSpeedCtrl.onChange((speed) => {
			if (this.mixer) this.mixer.timeScale = speed;
		});
		this.animFolder.add({
			playAll: () => this.playAllClips()
		}, 'playAll');

		// Morph target controls.
		this.morphFolder = gui.addFolder('Morph Targets');
		this.morphFolder.domElement.style.display = 'none';

		// Camera controls.
		this.cameraFolder = gui.addFolder('Cameras');
		this.cameraFolder.domElement.style.display = 'none';

		// Stats.
		const perfFolder = gui.addFolder('Performance');
		const perfLi = document.createElement('li');
		this.stats.dom.style.position = 'static';
		perfLi.appendChild(this.stats.dom);
		perfLi.classList.add('gui-stats');
		perfFolder.__ul.appendChild(perfLi);

		const guiWrap = document.createElement('div');
		this.el.appendChild(guiWrap);
		guiWrap.classList.add('gui-wrap');
		guiWrap.appendChild(gui.domElement);
		gui.close();

	}

	updateGUI() {
		this.cameraFolder.domElement.style.display = 'none';

		this.morphCtrls.forEach((ctrl) => ctrl.remove());
		this.morphCtrls.length = 0;
		this.morphFolder.domElement.style.display = 'none';

		this.animCtrls.forEach((ctrl) => ctrl.remove());
		this.animCtrls.length = 0;
		this.animFolder.domElement.style.display = 'none';

		const cameraNames = [];
		const morphMeshes = [];
		const labeledMeshes = [];
		const generatedObjects = [];
		this.labels = generatedObjects;
		this.labeledMeshes = labeledMeshes;
		this.labeledMeshesDict = {};


		this.content.children.forEach((node) => {
			if (node.isMesh && node.userData.cameraFocusable) {
				labeledMeshes.push(node)
				this.labeledMeshesDict[node.name] = node;
			}
		});


		this.content.traverse((node) => {
			if (node.name.startsWith("_generated_line")) {
				generatedObjects.push(node);
				//these have to lookAt Camera
			}

			if (node.isMesh) {
				if (node.morphTargetInfluences) {
					morphMeshes.push(node);
				}
				if (node.name.startsWith('label.')) {
					labelMeshes.push(node.name)
					// not sure what is it
				}
				if (node.userData.isMarker) {
					this.originialMarkerMeshes[node.name] = node;
					this.state.markerMeshesStates[node.name] = false;
				}

			}
			if (node.isCamera) {
				node.name = node.name || `VIEWER__camera_${cameraNames.length + 1}`;
				cameraNames.push(node.name);
			}
		});

		// this.labels.forEach(label => {
		// 	// label.up = new THREE.Vector3(1, 1, 0)
		// 	// label.lookAt(this.activeCamera.position)

		// })

		if (cameraNames.length) {
			this.cameraFolder.domElement.style.display = '';
			if (this.cameraCtrl) this.cameraCtrl.remove();
			const cameraOptions = [DEFAULT_CAMERA].concat(cameraNames);
			this.cameraCtrl = this.cameraFolder.add(this.state, 'camera', cameraOptions);
			this.cameraCtrl.onChange((name) => this.setCamera(name));
		}

		if (morphMeshes.length) {
			this.morphFolder.domElement.style.display = '';
			morphMeshes.forEach((mesh) => {
				if (mesh.morphTargetInfluences.length) {
					const nameCtrl = this.morphFolder.add({
						name: mesh.name || 'Untitled'
					}, 'name');
					this.morphCtrls.push(nameCtrl);
				}
				for (let i = 0; i < mesh.morphTargetInfluences.length; i++) {
					const ctrl = this.morphFolder.add(mesh.morphTargetInfluences, i, 0, 1, 0.01).listen();
					Object.keys(mesh.morphTargetDictionary).forEach((key) => {
						if (key && mesh.morphTargetDictionary[key] === i) ctrl.name(key);
					});
					this.morphCtrls.push(ctrl);
				}
			});
		}

		if (labeledMeshes.length) {
			this.partFolder.domElement.style.display = '';
			//TODO: tutaj bedzie sie dzialo , 
			/* TUTAJ czy w ten sposob mozna bedzie odpalac animacje na klikniecie */
			const lookAtPartStates = this.state.lookAtPartStates = {};
			labeledMeshes.forEach(labeledMesh => {
				this.state.lookAtPartStates[labeledMesh.name] = false;

				const ctrl = this.partFolder.add(lookAtPartStates, labeledMesh.name).listen();
				ctrl.onChange((nulookAtState) => {
					this.state.lookedAt = nulookAtState ? labeledMesh : null;
					this.focusActiveCameraOnObject(this.state.lookedAt);
				});
				this.lookkAtPartCtrls.push(ctrl)
			});
		};
		var markerMeshesNames = Object.keys(this.originialMarkerMeshes);
		if (markerMeshesNames.length) {
			this.defectFolder.domElement.style.display = '';
			//TODO: tutaj bedzie sie dzialo , 
			/* TUTAJ czy w ten sposob mozna bedzie odpalac animacje na klikniecie */
			const selectedDefect = this.state.selectedDefect = null;
			markerMeshesNames.forEach(markerMeshName => {
				this.state.markerMeshesStates[markerMeshName] = false;
				const consideredMarker = this.originialMarkerMeshes[markerMeshName]
				//TODO ROTATION CTRL , JUST LOCAL ROTATION
				// \TODO scale ctrl scale in on¬
				const ctrl = this.defectFolder.add(this.state.markerMeshesStates, markerMeshName).listen();
				ctrl.onChange((nuSelectedDefectState) => {
					///update selection state

					let changedCheckboxName = consideredMarker.name;
					// reset all checkbox states to false
					Object.keys(this.state.markerMeshesStates).forEach(nm => this.state.markerMeshesStates[nm] = false);
					//set currently clicked to true/flase if just turned off
					this.state.markerMeshesStates[changedCheckboxName] = nuSelectedDefectState;
					if (this.state.selectedDefect) {
						let oldm = this.state.selectedDefect
						let num = consideredMarker
						num.position.copy(oldm.position)
						num.rotation.copy(oldm.rotation)
						this.state.selectedDefect.position.set(0, 0, 0)
						this.state.selectedDefect.rotation.set(0, 0, 0)
						this.state.selectedDefect.updateMatrix()

					}
					this.state.selectedDefect = nuSelectedDefectState ? consideredMarker : null;

					this.enterPlacingMarkerState(consideredMarker);
				});
				this.defectCtrls.push(ctrl)
			});
		};

		if (this.clips.length) {
			this.animFolder.domElement.style.display = '';

			//TODO: tutaj bedzie sie dzialo , 
			/* TUTAJ czy w ten sposob mozna bedzie odpalac animacje na klikniecie */
			const actionStates = this.state.actionStates = {};
			this.clips.forEach((clip, clipIndex) => {
				actionStates[clip.name] = true;

				let action = this.mixer.clipAction(clip);
				action.play();
				// debugger;
				let actionNameConvertedToMeshName = clip.name.replace(" ", "_").replace("Action", "");
				if (this.labeledMeshesDict.hasOwnProperty(actionNameConvertedToMeshName)) {
					this.labeledMeshesDict[actionNameConvertedToMeshName].userData = {};
					this.labeledMeshesDict[actionNameConvertedToMeshName].userData.action = action;
				}


				const ctrl = this.animFolder.add(actionStates, clip.name).listen();
				ctrl.onChange((playAnimation) => {
					action = action || this.mixer.clipAction(clip);
					action.setEffectiveTimeScale(1);
					playAnimation ? action.play() : action.stop();
				});
				this.animCtrls.push(ctrl);
			});


			// Play other clips when enabled.
			//TODO: tutaj bedzie sie dzialo , 
			/* TUTAJ czy w ten sposob mozna bedzie odpalac animacje na klikniecie w liste czesci */



		}




	}

	clear() {

		if (!this.content) return;

		this.scene.remove(this.content);

		// dispose geometry
		this.content.traverse((node) => {

			if (!node.isMesh) return;

			node.geometry.dispose();

		});

		// dispose textures
		traverseMaterials(this.content, (material) => {

			MAP_NAMES.forEach((map) => {

				if (material[map]) material[map].dispose();

			});

		});

	}

};

function traverseMaterials(object, callback) {
	object.traverse((node) => {
		if (!node.isMesh) return;
		const materials = Array.isArray(node.material) ?
			node.material : [node.material];
		materials.forEach(callback);
	});
}

// https://stackoverflow.com/a/9039885/1314762
function isIOS() {
	return [
			'iPad Simulator',
			'iPhone Simulator',
			'iPod Simulator',
			'iPad',
			'iPhone',
			'iPod'
		].includes(navigator.platform)
		// iPad on iOS 13 detection
		||
		(navigator.userAgent.includes('Mac') && 'ontouchend' in document);
}

//export default Viewer;