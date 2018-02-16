'use strict';

Object.defineProperty(exports, "__esModule", {
    value: true
});
exports.CONTROL_EVENTS = undefined;

var _create = require('babel-runtime/core-js/object/create');

var _create2 = _interopRequireDefault(_create);

var _keys = require('babel-runtime/core-js/object/keys');

var _keys2 = _interopRequireDefault(_keys);

var _getIterator2 = require('babel-runtime/core-js/get-iterator');

var _getIterator3 = _interopRequireDefault(_getIterator2);

var _promise = require('babel-runtime/core-js/promise');

var _promise2 = _interopRequireDefault(_promise);

var _three = require('three');

var THREE = _interopRequireWildcard(_three);

var _Sphere = require('../../Core/Math/Sphere');

var _Sphere2 = _interopRequireDefault(_Sphere);

var _AnimationPlayer = require('../../Core/AnimationPlayer');

var _AnimationPlayer2 = _interopRequireDefault(_AnimationPlayer);

var _Coordinates = require('../../Core/Geographic/Coordinates');

var _Coordinates2 = _interopRequireDefault(_Coordinates);

var _GlobeTileProcessing = require('../../Process/GlobeTileProcessing');

var _DEMUtils = require('./../../utils/DEMUtils');

var _DEMUtils2 = _interopRequireDefault(_DEMUtils);

var _MainLoop = require('../../Core/MainLoop');

function _interopRequireWildcard(obj) { if (obj && obj.__esModule) { return obj; } else { var newObj = {}; if (obj != null) { for (var key in obj) { if (Object.prototype.hasOwnProperty.call(obj, key)) newObj[key] = obj[key]; } } newObj.default = obj; return newObj; } }

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

// TODO:
// Recast touch for globe
// Fix target problem with pan and panoramic (when target isn't on globe)
// Fix problem with space

// FIXME:
// when move globe in damping orbit, there isn't move!!

// The control's keys
var CONTROL_KEYS = {
    LEFT: 37,
    UP: 38,
    RIGHT: 39,
    BOTTOM: 40,
    SPACE: 32,
    SHIFT: 16,
    CTRL: 17,
    S: 83
};

// TODO: can be optimize for some uses
// This set of controls performs orbiting, dollying (zooming), and panning. It maintains
// the "up" direction as +Y, unlike the TrackballControls. Touch on tablet and phones is
// supported.
//
//    Orbit - left mouse / touch: one finger move
//    Zoom - middle mouse, or mousewheel / touch: two finger spread or squish
//    Pan - right mouse, or arrow keys / touch: three finter swipe

var presiceSlerp = function (qb, t) {
    if (t === 0) {
        return this;
    }

    if (t === 1) {
        return this.copy(qb);
    }

    var x = this._x;
    var y = this._y;
    var z = this._z;
    var w = this._w;

    // http://www.euclideanspace.com/maths/algebra/realNormedAlgebra/quaternions/slerp/

    var cosHalfTheta = w * qb._w + x * qb._x + y * qb._y + z * qb._z;

    if (cosHalfTheta < 0) {
        this._w = -qb._w;
        this._x = -qb._x;
        this._y = -qb._y;
        this._z = -qb._z;

        cosHalfTheta = -cosHalfTheta;
    } else {
        this.copy(qb);
    }

    if (cosHalfTheta >= 1.0) {
        this._w = w;
        this._x = x;
        this._y = y;
        this._z = z;

        return this;
    }

    var sinHalfTheta = Math.sqrt(1.0 - cosHalfTheta * cosHalfTheta);
    var halfTheta = Math.atan2(sinHalfTheta, cosHalfTheta);
    var ratioA = Math.sin((1 - t) * halfTheta) / sinHalfTheta;
    var ratioB = Math.sin(t * halfTheta) / sinHalfTheta;

    this._w = w * ratioA + this._w * ratioB;
    this._x = x * ratioA + this._x * ratioB;
    this._y = y * ratioA + this._y * ratioB;
    this._z = z * ratioA + this._z * ratioB;

    this.onChangeCallback();

    return this;
};

// private members
var EPS = 0.000001;

// Orbit
var rotateStart = new THREE.Vector2();
var rotateEnd = new THREE.Vector2();
var rotateDelta = new THREE.Vector2();
var spherical = new THREE.Spherical(1.0, 0.01, 0);
var snapShotSpherical = new THREE.Spherical(1.0, 0.01, Math.PI * 0.5);
var sphericalDelta = new THREE.Spherical(1.0, 0, 0);
var sphericalTo = new THREE.Spherical();
var orbit = {
    spherical: spherical,
    sphericalDelta: sphericalDelta,
    sphericalTo: sphericalTo,
    scale: 1
};

// Pan
var panStart = new THREE.Vector2();
var panEnd = new THREE.Vector2();
var panDelta = new THREE.Vector2();
var panOffset = new THREE.Vector3();

var offset = new THREE.Vector3();

// Dolly
var dollyStart = new THREE.Vector2();
var dollyEnd = new THREE.Vector2();
var dollyDelta = new THREE.Vector2();

// Globe move
var quatGlobe = new THREE.Quaternion();
var cameraTargetOnGlobe = new THREE.Object3D();
var movingCameraTargetOnGlobe = new THREE.Vector3();
var animatedScale = 0.0;

// Position object on globe
var positionObject = function () {
    var quaterionX = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), Math.PI / 2);
    return function (newPosition, object) {
        object.up = THREE.Object3D.DefaultUp;
        object.position.copy(newPosition);
        object.lookAt(newPosition.clone().multiplyScalar(1.1));
        object.quaternion.multiply(quaterionX);
        object.updateMatrixWorld();
    };
}();

// set new camera target on globe
function setCameraTargetObjectPosition(newPosition) {
    // Compute the new target position
    positionObject(newPosition, cameraTargetOnGlobe);

    cameraTargetOnGlobe.matrixWorldInverse.getInverse(cameraTargetOnGlobe.matrixWorld);
}

var ctrl = {
    progress: 0,
    quatGlobe: quatGlobe,
    qDelta: new THREE.Quaternion(),
    dampingFactor: 0.25,
    target: cameraTargetOnGlobe.position,
    distance: 0,
    lengthTarget: 0,
    lengthCamera: 0
};

ctrl.qDelta.presiceSlerp = presiceSlerp;
quatGlobe.presiceSlerp = presiceSlerp;

// Animation

var enableAnimation = true;

// Animation player
var player = null;
// Save 2 last rotation globe for damping
var lastRotation = [];
// Save the last time of mouse move for damping
var lastTimeMouseMove = 0;

// Expression used to damp camera's moves
var dampingMoveAnimatedExpression = function () {
    var damp = new THREE.Quaternion(0, 0, 0, 1);
    return function (root) {
        root.qDelta.presiceSlerp(damp, root.dampingFactor * 0.2);
        root.quatGlobe.multiply(root.qDelta);
    };
}();

function updateAltitudeCoordinate(coordinate, layer) {
    // TODO : save last tile to boost compute
    var result = _DEMUtils2.default.getElevationValueAt(layer, coordinate);
    var diffAltitude = 0;
    if (result && result.z != coordinate._values[2]) {
        diffAltitude = coordinate.altitude() - result.z;
        coordinate._values[2] = result.z < 0 ? 0 : result.z;
    }
    return diffAltitude;
}

function clampToGround(root) {
    // diff altitude
    if (updateAltitudeCoordinate(root.targetGeoPosition, root.view.wgs84TileLayer) != 0) {
        root.distance = root.lengthTarget - root.targetGeoPosition.as('EPSG:4978').xyz().length();
    }
    // translation
    root.target.setLength(root.lengthTarget - root.distance * root.progress);
    root.snapShotCamera.position.setLength(root.lengthCamera - root.distance * root.progress);
}

// Expression used to animate camera's moves and zoom
function zoomCenterAnimatedExpression(root, progress) {
    // Rotation
    root.quatGlobe.set(0, 0, 0, 1);
    root.progress = 1 - Math.pow(1 - (Math.sin((progress - 0.5) * Math.PI) * 0.5 + 0.5), 2);
    root.quatGlobe.presiceSlerp(root.qDelta, root.progress);
    // clamp
    clampToGround(root);
}

// Expression used to damp camera's moves
var animationOrbitExpression = function (root, progress) {
    root.scale = 1.0 - (1.0 - root.sphericalTo.radius / root.spherical.radius) * progress;
    root.sphericalDelta.theta = root.sphericalTo.theta;
    root.sphericalDelta.phi = root.sphericalTo.phi;
};

// Animations
var animationDampingMove = new _AnimationPlayer.AnimatedExpression({ duration: 120, root: ctrl, expression: dampingMoveAnimatedExpression, name: 'damping-move' });
var animationZoomCenter = new _AnimationPlayer.AnimatedExpression({ duration: 45, root: ctrl, expression: zoomCenterAnimatedExpression, name: 'Zoom Center' });
var animationOrbit = new _AnimationPlayer.AnimatedExpression({ duration: 30, root: orbit, expression: animationOrbitExpression, name: 'set Orbit' });
var dampingOrbitalMvt = new _AnimationPlayer.Animation({ duration: 60, name: 'damping-orbit' });

// Replace matrix float by matrix double
cameraTargetOnGlobe.matrixWorldInverse = new THREE.Matrix4();

// Pan Move
var panVector = new THREE.Vector3();

// Save last transformation
var lastPosition = new THREE.Vector3();
var lastQuaternion = new THREE.Quaternion();

// State control
var state;

// Initial transformation
var initialTarget;
var initialPosition;
var initialZoom;

// picking
var ptScreenClick = new THREE.Vector2();
var sizeRendering = new THREE.Vector2();

// Tangent sphere to ellipsoid
var tSphere = new _Sphere2.default();
tSphere.picking = { position: new THREE.Vector3(), normal: new THREE.Vector3() };

// Set to true to enable target helper
var enableTargetHelper = false;
var pickingHelper = void 0;

// Handle function
var _handlerMouseMove;
var _handlerMouseUp;

// Event
var enableEventPositionChanged = true;

/**
 * Globe control pan event. Fires after camera pan
 * @event GlobeControls#pan-changed
 * @property target {GlobeControls} dispatched on controls
 * @property type {string} orientation-changed
 */
/**
 * Globe control orientation event. Fires when camera's orientation change
 * @event GlobeControls#orientation-changed
 * @property new {object}
 * @property new.tilt {number} the new value of the tilt of the camera
 * @property new.heading {number} the new value of the heading of the camera
 * @property previous {object}
 * @property previous.tilt {number} the previous value of the tilt of the camera
 * @property previous.heading {number} the previous value of the heading of the camera
 * @property target {GlobeControls} dispatched on controls
 * @property type {string} orientation-changed
 */
/**
* Globe control range event. Fires when camera's range to target change
* @event GlobeControls#range-changed
* @property new {object}
* @property new.range {number} the new value of the range
* @property previous {object}
* @property previous.range {number} the previous value of the range
* @property target {GlobeControls} dispatched on controls
* @property type {string} range-changed
*/
/**
* Globe control camera's target event. Fires when camera's target change
* @event GlobeControls#camera-target-changed
* @property new {object}
* @property new.cameraTarget {Coordinates} the new camera's target coordinates
* @property new.cameraTarget.crs {string} the crs of the camera's target coordinates
* @property new.cameraTarget.values {array}
* @property new.cameraTarget.values.0 {number} the new X coordinates
* @property new.cameraTarget.values.1 {number} the new Y coordinates
* @property new.cameraTarget.values.2 {number} the new Z coordinates
* @property new.heading {number} the new value of the heading of the camera
* @property previous {object}
* @property previous.cameraTarget {Coordinates} the previous camera's target coordinates
* @property previous.cameraTarget.crs {string} the crs of the camera's target coordinates
* @property previous.cameraTarget.values {array}
* @property previous.cameraTarget.values.0 {number} the previous X coordinates
* @property previous.cameraTarget.values.1 {number} the previous Y coordinates
* @property previous.cameraTarget.values.2 {number} the previous Z coordinates
* @property target {GlobeControls} dispatched on controls
* @property type {string} camera-target-changed
*/

/**
 * globe controls events
 * @property PAN_CHANGED {string} Fires after camera pan
 * @property ORIENTATION_CHANGED {string} Fires when camera's orientation change
 * @property RANGE_CHANGED {string} Fires when camera's range to target change
 * @property CAMERA_TARGET_CHANGED {string} Fires when camera's target change
 */

var CONTROL_EVENTS = exports.CONTROL_EVENTS = {
    PAN_CHANGED: 'pan-changed',
    ORIENTATION_CHANGED: 'orientation-changed',
    RANGE_CHANGED: 'range-changed',
    CAMERA_TARGET_CHANGED: 'camera-target-changed'
};

// SnapCamera saves transformation's camera
// It's use to globe move
function SnapCamera(camera) {
    camera.updateMatrixWorld();

    this.matrixWorld = new THREE.Matrix4();
    this.projectionMatrix = new THREE.Matrix4();
    this.invProjectionMatrix = new THREE.Matrix4();
    this.position = new THREE.Vector3();

    this.init = function (camera) {
        this.matrixWorld.copy(camera.matrixWorld);
        this.projectionMatrix.copy(camera.projectionMatrix);
        this.position.copy(camera.position);
        this.invProjectionMatrix.getInverse(this.projectionMatrix);
    };

    this.init(camera);

    this.shot = function (objectToSnap) {
        objectToSnap.updateMatrixWorld();
        this.matrixWorld.copy(objectToSnap.matrixWorld);
        this.position.copy(objectToSnap.position);
    };

    var matrix = new THREE.Matrix4();

    this.updateRay = function (ray, mouse) {
        ray.origin.copy(this.position);
        ray.direction.set(mouse.x, mouse.y, 0.5);
        matrix.multiplyMatrices(this.matrixWorld, this.invProjectionMatrix);
        ray.direction.applyMatrix4(matrix);
        ray.direction.sub(ray.origin).normalize();
    };
}

var snapShotCamera = null;

function defer() {
    var deferedPromise = {};
    deferedPromise.promise = new _promise2.default(function (resolve, reject) {
        deferedPromise.resolve = resolve;
        deferedPromise.reject = reject;
    });
    return deferedPromise;
}

var initPromise = void 0;

/* globals document,window */

/**
 * @class
 * @param {GlobeView} view
 * @param {*} target
 * @param {number} radius
 * @param {options} options
 */
function GlobeControls(view, target, radius) {
    var _this = this;

    var options = arguments.length > 3 && arguments[3] !== undefined ? arguments[3] : {};

    player = new _AnimationPlayer2.default();
    this._view = view;
    this.camera = view.camera.camera3D;
    this.domElement = view.mainLoop.gfxEngine.renderer.domElement;

    snapShotCamera = new SnapCamera(this.camera);
    ctrl.snapShotCamera = snapShotCamera;
    ctrl.view = view;

    this.waitSceneLoaded = function () {
        this._view.notifyChange();
        var deferedPromise = defer();
        this._view.mainLoop.addEventListener('command-queue-empty', function () {
            deferedPromise.resolve();
        });
        return deferedPromise.promise;
    };

    // Set to false to disable this control
    this.enabled = true;

    // This option actually enables dollying in and out; left as "zoom" for
    // backwards compatibility
    this.zoomSpeed = options.zoomSpeed || 2.0;

    // Limits to how far you can dolly in and out ( PerspectiveCamera only )
    this.minDistance = options.minDistance || 300;
    this.maxDistance = options.maxDistance || radius * 8.0;

    // Limits to how far you can zoom in and out ( OrthographicCamera only )
    this.minZoom = 0;
    this.maxZoom = Infinity;

    // Set to true to disable this control
    this.rotateSpeed = options.rotateSpeed || 0.25;

    // Set to true to disable this control
    this.keyPanSpeed = 7.0; // pixels moved per arrow key push

    // Set to true to automatically rotate around the target
    this.autoRotate = false;
    this.autoRotateSpeed = 2.0; // 30 seconds per round when fps is 60

    // How far you can orbit vertically, upper and lower limits.
    // Range is 0 to Math.PI radians.
    // TODO Warning minPolarAngle = 0.01 -> it isn't possible to be perpendicular on Globe
    this.minPolarAngle = 0.01; // radians
    this.maxPolarAngle = Math.PI * 0.47; // radians

    // How far you can orbit horizontally, upper and lower limits.
    // If set, must be a sub-interval of the interval [ - Math.PI, Math.PI ].
    this.minAzimuthAngle = -Infinity; // radians
    this.maxAzimuthAngle = Infinity; // radians

    // Set collision options
    this.handleCollision = typeof options.handleCollision !== 'undefined' ? options.handleCollision : true;
    this.minDistanceCollision = 60;

    // Set to true to disable use of the keys
    this.enableKeys = true;

    // Enable Damping
    this.enableDamping = true;

    // Radius tangent sphere
    tSphere.setRadius(radius);
    spherical.radius = tSphere.radius;

    sizeRendering.copy(view.mainLoop.gfxEngine.getWindowSize());
    sizeRendering.FOV = this.camera.fov;
    // Note A
    // TODO: test before remove test code
    // so camera.up is the orbit axis
    // var quat = new THREE.Quaternion().setFromUnitVectors(camera.up, new THREE.Vector3(0, 1, 0));
    // var quatInverse = quat.clone().inverse();

    this.startEvent = {
        type: 'start'
    };
    this.endEvent = {
        type: 'end'
    };

    this.updateCamera = function () {
        snapShotCamera.init(this.camera);
        sizeRendering.width = this.domElement.clientWidth;
        sizeRendering.height = this.domElement.clientHeight;
        sizeRendering.FOV = this.camera.fov;
    };

    this._view.addFrameRequester(_MainLoop.MAIN_LOOP_EVENTS.AFTER_CAMERA_UPDATE, function () {
        var dim = _this._view.mainLoop.gfxEngine.getWindowSize();
        var sizeDiff = dim.width != sizeRendering.width || dim.height != sizeRendering.height;
        if (sizeDiff) {
            _this.updateCamera();
        }
    });

    this.getAutoRotationAngle = function () {
        return 2 * Math.PI / 60 / 60 * this.autoRotateSpeed;
    };

    this.getDollyScale = function () {
        return Math.pow(0.95, this.zoomSpeed);
    };

    this.rotateLeft = function (angle) {
        if (angle === undefined) {
            angle = this.getAutoRotationAngle();
        }
        sphericalDelta.theta -= angle;
    };

    this.rotateUp = function (angle) {
        if (angle === undefined) {
            angle = this.getAutoRotationAngle();
        }

        sphericalDelta.phi -= angle;
    };

    // pass in distance in world space to move left
    this.panLeft = function (distance) {
        var te = this.camera.matrix.elements;

        // get X column of matrix
        panOffset.set(te[0], te[1], te[2]);
        panOffset.multiplyScalar(-distance);

        panVector.add(panOffset);
    };

    // pass in distance in world space to move up
    this.panUp = function (distance) {
        var te = this.camera.matrix.elements;

        // get Y column of matrix
        panOffset.set(te[4], te[5], te[6]);
        panOffset.multiplyScalar(distance);

        panVector.add(panOffset);
    };

    // pass in x,y of change desired in pixel space,
    // right and down are positive
    this.mouseToPan = function (deltaX, deltaY) {
        var element = this.domElement === document ? this.domElement.body : this.domElement;

        if (this.camera instanceof THREE.PerspectiveCamera) {
            // perspective
            var position = this.camera.position;

            // var offset = position.clone().sub(this.target);
            var offset = position.clone().sub(this.getCameraTargetPosition());

            var targetDistance = offset.length();

            // half of the fov is center to top of screen
            targetDistance *= Math.tan(this.camera.fov / 2 * Math.PI / 180.0);

            // we actually don't use screenWidth, since perspective camera is fixed to screen height
            this.panLeft(2 * deltaX * targetDistance * this.camera.aspect / element.clientWidth);
            this.panUp(2 * deltaY * targetDistance / element.clientHeight);
        } else if (this.camera instanceof THREE.OrthographicCamera) {
            // orthographic
            this.panLeft(deltaX * (this.camera.right - this.camera.left) / element.clientWidth);
            this.panUp(deltaY * (this.camera.top - this.camera.bottom) / element.clientHeight);
        }
    };

    this.dollyIn = function (dollyScale) {
        if (dollyScale === undefined) {
            dollyScale = this.getDollyScale();
        }

        if (this.camera instanceof THREE.PerspectiveCamera) {
            orbit.scale /= dollyScale;
        } else if (this.camera instanceof THREE.OrthographicCamera) {
            this.camera.zoom = Math.max(this.minZoom, Math.min(this.maxZoom, this.camera.zoom * dollyScale));
            this.camera.updateProjectionMatrix();
            this._view.notifyChange(true, this.camera);
        }
    };

    this.dollyOut = function (dollyScale) {
        if (dollyScale === undefined) {
            dollyScale = this.getDollyScale();
        }

        if (this.camera instanceof THREE.PerspectiveCamera) {
            orbit.scale *= dollyScale;
        } else if (this.camera instanceof THREE.OrthographicCamera) {
            this.camera.zoom = Math.max(this.minZoom, Math.min(this.maxZoom, this.camera.zoom / dollyScale));
            this.camera.updateProjectionMatrix();
            this._view.notifyChange(true, this.camera);
        }
    };

    var quaterPano = new THREE.Quaternion();
    var quaterAxis = new THREE.Quaternion();
    var axisX = new THREE.Vector3(1, 0, 0);
    var minDistanceZ = 0;

    var getMinDistanceCameraBoundingSphereObbsUp = function (tile) {
        if (tile.level > 10 && tile.children.length == 1 && tile.geometry) {
            var obb = tile.OBB();
            var sphereCamera = { position: _this.camera.position.clone(), radius: _this.minDistanceCollision };
            if (obb.isSphereAboveXYBox(sphereCamera)) {
                minDistanceZ = Math.min(sphereCamera.position.z - obb.box3D.max.z, minDistanceZ);
            }
        }
    };

    var update = function () {
        // We compute distance between camera's bounding sphere and geometry's obb up face
        if (this.handleCollision) {
            // We check distance to the ground/surface geometry
            // add minDistanceZ between camera's bounding and tiles's oriented bounding box (up face only)
            // Depending on the distance of the camera with obbs, we add a slowdown or constrain to the movement.
            // this constraint or deceleration is suitable for two types of movement MOVE_GLOBE and ORBIT.
            // This constraint or deceleration inversely proportional to the camera/obb distance
            if (this._view.wgs84TileLayer) {
                minDistanceZ = Infinity;
                var _iteratorNormalCompletion = true;
                var _didIteratorError = false;
                var _iteratorError = undefined;

                try {
                    for (var _iterator = (0, _getIterator3.default)(this._view.wgs84TileLayer.level0Nodes), _step; !(_iteratorNormalCompletion = (_step = _iterator.next()).done); _iteratorNormalCompletion = true) {
                        var tile = _step.value;

                        tile.traverse(getMinDistanceCameraBoundingSphereObbsUp);
                    }
                } catch (err) {
                    _didIteratorError = true;
                    _iteratorError = err;
                } finally {
                    try {
                        if (!_iteratorNormalCompletion && _iterator.return) {
                            _iterator.return();
                        }
                    } finally {
                        if (_didIteratorError) {
                            throw _iteratorError;
                        }
                    }
                }
            }
        }
        // MOVE_GLOBE
        // Rotate globe with mouse
        if (state === this.states.MOVE_GLOBE) {
            if (minDistanceZ < 0) {
                cameraTargetOnGlobe.translateY(-minDistanceZ);
                snapShotCamera.position.setLength(snapShotCamera.position.length() - minDistanceZ);
            } else if (minDistanceZ < this.minDistanceCollision) {
                var inerty = 1.0 - minDistanceZ / this.minDistanceCollision;
                var translateY = this.minDistanceCollision * inerty;
                cameraTargetOnGlobe.translateY(translateY);
                snapShotCamera.position.setLength(snapShotCamera.position.length() + translateY);
            }
            movingCameraTargetOnGlobe.copy(this.getCameraTargetPosition()).applyQuaternion(quatGlobe);
            this.camera.position.copy(snapShotCamera.position).applyQuaternion(quatGlobe);
            // combine zoom with move globe
            if (ctrl.progress > 0) {
                this.camera.position.lerp(movingCameraTargetOnGlobe, ctrl.progress * animatedScale);
            }
            this.camera.up.copy(movingCameraTargetOnGlobe.clone().normalize());
            // PAN
            // Move camera in projection plan
        } else if (state === this.states.PAN) {
            this.camera.position.add(panVector);
            movingCameraTargetOnGlobe.add(panVector);
            this.camera.up.copy(movingCameraTargetOnGlobe.clone().normalize());
            // PANORAMIC
            // Move target camera
        } else if (state === this.states.PANORAMIC) {
            // TODO: this part must be reworked
            this.camera.worldToLocal(movingCameraTargetOnGlobe);
            var normal = this.camera.position.clone().normalize().applyQuaternion(this.camera.quaternion.clone().inverse());
            quaterPano.setFromAxisAngle(normal, sphericalDelta.theta).multiply(quaterAxis.setFromAxisAngle(axisX, sphericalDelta.phi));
            movingCameraTargetOnGlobe.applyQuaternion(quaterPano);
            this.camera.localToWorld(movingCameraTargetOnGlobe);
            this.camera.up.copy(movingCameraTargetOnGlobe.clone().normalize());
        } else {
            // ZOOM/ORBIT
            // Move Camera around the target camera

            // TODO: test before remove test code see (Note A)
            // offset.applyQuaternion( quat );

            // get camera position in local space of target
            offset.copy(this.camera.position).applyMatrix4(cameraTargetOnGlobe.matrixWorldInverse);

            // angle from z-axis around y-axis
            if (sphericalDelta.theta || sphericalDelta.phi) {
                spherical.setFromVector3(offset);
            }

            if (this.autoRotate && state === this.states.NONE) {
                this.rotateLeft(this.getAutoRotationAngle());
            }
            // far underground
            var dynamicRadius = spherical.radius * Math.sin(this.minPolarAngle);
            var slowdownLimit = dynamicRadius * 8;
            var contraryLimit = dynamicRadius * 2;
            var minContraintPhi = -0.01;

            if (minDistanceZ < slowdownLimit && minDistanceZ > contraryLimit && sphericalDelta.phi > 0) {
                // slowdown zone : slowdown sphericalDelta.phi
                var slowdownZone = slowdownLimit - contraryLimit;
                // the deeper the camera is in this zone, the bigger the factor is
                var slowdownFactor = 1 - (slowdownZone - (minDistanceZ - contraryLimit)) / slowdownZone;
                // apply slowdown factor on tilt mouvement
                sphericalDelta.phi *= slowdownFactor * slowdownFactor;
            } else if (minDistanceZ < contraryLimit && minDistanceZ > -contraryLimit && sphericalDelta.phi > minContraintPhi) {
                // calculation of the angle of rotation which allows to leave this zone
                var contraryPhi = -Math.asin((contraryLimit - minDistanceZ) * 0.25 / spherical.radius);
                // clamp contraryPhi to make a less brutal exit

                // contraint zone : contraint sphericalDelta.phi
                contraryPhi = THREE.Math.clamp(contraryPhi, minContraintPhi, 0);
                // the deeper the camera is in this zone, the bigger the factor is
                var contraryFactor = 1 - (contraryLimit - minDistanceZ) / (2 * contraryLimit);
                sphericalDelta.phi = THREE.Math.lerp(sphericalDelta.phi, contraryPhi, contraryFactor);
                minDistanceZ -= Math.sin(sphericalDelta.phi) * spherical.radius;
            }
            spherical.theta += sphericalDelta.theta;
            spherical.phi += sphericalDelta.phi;

            // restrict spherical.theta to be between desired limits
            spherical.theta = Math.max(this.minAzimuthAngle, Math.min(this.maxAzimuthAngle, spherical.theta));

            // restrict spherical.phi to be between desired limits
            spherical.phi = Math.max(this.minPolarAngle, Math.min(this.maxPolarAngle, spherical.phi));

            spherical.radius = offset.length() * orbit.scale;

            // restrict spherical.phi to be betwee EPS and PI-EPS
            spherical.makeSafe();

            // restrict radius to be between desired limits
            spherical.radius = Math.max(this.minDistance, Math.min(this.maxDistance, spherical.radius));

            offset.setFromSpherical(spherical);

            // if camera is underground, so move up camera
            if (minDistanceZ < 0) {
                offset.y -= minDistanceZ;
                spherical.setFromVector3(offset);
                sphericalDelta.phi = 0;
            }

            // rotate point back to "camera-up-vector-is-up" space
            // offset.applyQuaternion( quatInverse );
            this.camera.position.copy(cameraTargetOnGlobe.localToWorld(offset));
        }

        this.camera.lookAt(movingCameraTargetOnGlobe);

        if (!this.enableDamping) {
            sphericalDelta.theta = 0;
            sphericalDelta.phi = 0;
        } else {
            sphericalDelta.theta *= 1 - ctrl.dampingFactor;
            sphericalDelta.phi *= 1 - ctrl.dampingFactor;
        }

        orbit.scale = 1;
        panVector.set(0, 0, 0);

        // update condition is:
        // min(camera displacement, camera rotation in radians)^2 > EPS
        // using small-angle approximation cos(x/2) = 1 - x^2 / 8

        if (lastPosition.distanceToSquared(this.camera.position) > EPS || 8 * (1 - lastQuaternion.dot(this.camera.quaternion)) > EPS) {
            this._view.notifyChange(true, this.camera);

            lastPosition.copy(this.camera.position);
            lastQuaternion.copy(this.camera.quaternion);
        }
        // Launch animationdamping if mouse stops these movements
        if (this.enableDamping && state === this.states.ORBIT && player.isStopped() && (sphericalDelta.theta > EPS || sphericalDelta.phi > EPS)) {
            player.playLater(dampingOrbitalMvt, 2);
        }
    }.bind(this);

    this.getSphericalDelta = function () {
        return sphericalDelta;
    };

    var direction = new THREE.Vector3();
    var coordTarget = new _Coordinates2.default(this._view.referenceCrs, 0, 0, 0);
    var coordTile = new _Coordinates2.default(this._view.referenceCrs, 0, 0, 0);
    var reposition = new THREE.Vector3();
    var delta = 0.001;

    var updateCameraTargetOnGlobe = function () {
        var previousCameraTargetOnGlobe = cameraTargetOnGlobe.position.clone();

        direction.subVectors(movingCameraTargetOnGlobe, this.camera.position);

        var pickingPosition = view.getPickingPositionFromDepth();

        // Position movingCameraTargetOnGlobe on DME
        if (pickingPosition) {
            var distanceTarget = pickingPosition.distanceTo(this.camera.position);
            direction.setLength(distanceTarget);
            movingCameraTargetOnGlobe.addVectors(this.camera.position, direction);
        }
        // correction of depth error
        var tileCrs = this._view.wgs84TileLayer.extent.crs();
        coordTarget._normal = null;
        coordTile._normal = null;
        coordTarget.set(this._view.referenceCrs, movingCameraTargetOnGlobe).as(tileCrs, coordTile);
        updateAltitudeCoordinate(coordTile, this._view.wgs84TileLayer);
        coordTile.as(this._view.referenceCrs).xyz(reposition);
        direction.setLength(reposition.distanceTo(this.camera.position));
        movingCameraTargetOnGlobe.addVectors(this.camera.position, direction);

        setCameraTargetObjectPosition(movingCameraTargetOnGlobe);

        // update spherical from target
        offset.copy(this.camera.position);
        offset.applyMatrix4(cameraTargetOnGlobe.matrixWorldInverse);
        spherical.setFromVector3(offset);

        if (enableEventPositionChanged) {
            if (state === this.states.ORBIT && (Math.abs(snapShotSpherical.phi - spherical.phi) > delta || Math.abs(snapShotSpherical.theta - spherical.theta) > delta)) {
                this.dispatchEvent({
                    type: CONTROL_EVENTS.ORIENTATION_CHANGED,
                    previous: {
                        tilt: snapShotSpherical.phi * 180 / Math.PI,
                        heading: snapShotSpherical.theta * 180 / Math.PI
                    },
                    new: {
                        tilt: spherical.phi * 180 / Math.PI,
                        heading: spherical.theta * 180 / Math.PI
                    }
                });
            } else if (state === this.states.PAN) {
                this.dispatchEvent({
                    type: CONTROL_EVENTS.PAN_CHANGED
                });
            }

            var previousRange = snapShotSpherical.radius;
            var newRange = this.getRange();
            if (Math.abs(newRange - previousRange) / previousRange > 0.001) {
                this.dispatchEvent({
                    type: CONTROL_EVENTS.RANGE_CHANGED,
                    previous: { range: previousRange },
                    new: { range: newRange }
                });
            }

            if (cameraTargetOnGlobe.position.distanceTo(previousCameraTargetOnGlobe) / spherical.radius > delta) {
                this.dispatchEvent({
                    type: CONTROL_EVENTS.CAMERA_TARGET_CHANGED,
                    previous: { cameraTarget: new _Coordinates2.default(this._view.referenceCrs, previousCameraTargetOnGlobe) },
                    new: { cameraTarget: new _Coordinates2.default(this._view.referenceCrs, cameraTargetOnGlobe.position) }
                });
            }
            snapShotSpherical.copy(spherical);
        }

        state = this.states.NONE;
        lastRotation = [];
    };

    // Update helper
    var updateHelper = function () {};

    this.getPickingPositionOnSphere = function () {
        return tSphere.picking.position;
    };

    // Update radius's sphere : the sphere must cross the point
    // Return intersection with mouse and sphere
    var updateSpherePicking = function () {
        var mouse = new THREE.Vector2();
        var ray = new THREE.Ray();

        return function (point, screenCoord) {
            tSphere.setRadius(point.length());

            mouse.x = screenCoord.x / sizeRendering.width * 2 - 1;
            mouse.y = -(screenCoord.y / sizeRendering.height) * 2 + 1;

            snapShotCamera.updateRay(ray, mouse);
            // pick position on tSphere
            var its = tSphere.intersectWithRay(ray);
            if (its != undefined) {
                tSphere.picking.position.copy(its);
                tSphere.picking.normal = tSphere.picking.position.clone().normalize();

                lastRotation.push(tSphere.picking.normal);
                updateHelper.bind(this)(tSphere.picking.position, pickingHelper);
            }
        };
    }();

    var onMouseMove = function () {
        var ray = new THREE.Ray();
        var mouse = new THREE.Vector2();

        return function (event) {
            if (player.isPlaying()) {
                player.stop();
            }
            if (this.enabled === false) return;

            event.preventDefault();

            var staticPos = window.getComputedStyle(event.target.parentElement).position !== 'static';
            var bounds = staticPos ? event.target.getBoundingClientRect() : { left: 0, top: 0 };
            var x = event.clientX - event.target.offsetLeft - bounds.left;
            var y = event.clientY - event.target.offsetTop - bounds.top;

            if (state === this.states.ORBIT || state === this.states.PANORAMIC) {
                rotateEnd.set(x, y);
                rotateDelta.subVectors(rotateEnd, rotateStart);

                this.rotateLeft(2 * Math.PI * rotateDelta.x / sizeRendering.width * this.rotateSpeed);
                // rotating up and down along whole screen attempts to go 360, but limited to 180
                this.rotateUp(2 * Math.PI * rotateDelta.y / sizeRendering.height * this.rotateSpeed);

                rotateStart.copy(rotateEnd);
            } else if (state === this.states.DOLLY) {
                dollyEnd.set(x, y);
                dollyDelta.subVectors(dollyEnd, dollyStart);

                if (dollyDelta.y > 0) {
                    this.dollyIn();
                } else if (dollyDelta.y < 0) {
                    this.dollyOut();
                }

                dollyStart.copy(dollyEnd);
            } else if (state === this.states.PAN) {
                panEnd.set(x, y);
                panDelta.subVectors(panEnd, panStart);

                this.mouseToPan(panDelta.x, panDelta.y);

                panStart.copy(panEnd);
            } else if (state === this.states.MOVE_GLOBE) {
                mouse.x = x / sizeRendering.width * 2 - 1;
                mouse.y = -(y / sizeRendering.height) * 2 + 1;

                snapShotCamera.updateRay(ray, mouse);

                var intersection = tSphere.intersectWithRay(ray);

                // If there's intersection then move globe else we stop the move
                if (intersection) {
                    var normalizedIntersection = intersection.normalize();
                    quatGlobe.setFromUnitVectors(normalizedIntersection, tSphere.picking.normal);
                    // backups last move globe for damping
                    lastRotation.push(normalizedIntersection.clone());
                    lastTimeMouseMove = Date.now();
                    // Remove unnecessary movements backups
                    if (lastRotation.length > 2) {
                        lastRotation.splice(0, 1);
                    }
                } else {
                    onMouseUp.bind(this)();
                }
            }

            if (state !== this.states.NONE) {
                update();
            }
        };
    }();

    this.states = {
        NONE: {},
        ORBIT: {
            mouseButton: THREE.MOUSE.LEFT,
            keyboard: CONTROL_KEYS.CTRL,
            enable: true
        },
        DOLLY: {
            mouseButton: THREE.MOUSE.MIDDLE,
            enable: true
        },
        PAN: {
            mouseButton: THREE.MOUSE.RIGHT,
            up: CONTROL_KEYS.UP,
            bottom: CONTROL_KEYS.BOTTOM,
            left: CONTROL_KEYS.LEFT,
            right: CONTROL_KEYS.RIGHT,
            enable: true
        },
        TOUCH_ROTATE: {
            finger: 1
        },
        TOUCH_DOLLY: {
            finger: 2
        },
        TOUCH_PAN: {
            finger: 3
        },
        MOVE_GLOBE: {
            mouseButton: THREE.MOUSE.LEFT,
            enable: true
        },
        PANORAMIC: {
            mouseButton: THREE.MOUSE.LEFT,
            keyboard: CONTROL_KEYS.SHIFT,
            enable: true
        },
        SELECT: {
            mouseButton: THREE.MOUSE.LEFT,
            keyboard: CONTROL_KEYS.S,
            enable: true
        }
    };

    Object.defineProperty(this.states.TOUCH_ROTATE, 'enable', { get: function get() {
            return _this.states.ORBIT.enable;
        },
        set: function set() {
            throw new Error('Use ORBIT.enable to enable or disable TOUCH_ROTATE');
        }
    });

    Object.defineProperty(this.states.TOUCH_DOLLY, 'enable', { get: function get() {
            return _this.states.DOLLY.enable;
        },
        set: function set() {
            throw new Error('Use DOLLY.enable to enable or disable TOUCH_DOLLY');
        }
    });

    Object.defineProperty(this.states.TOUCH_PAN, 'enable', { get: function get() {
            return _this.states.PAN.enable;
        },
        set: function set() {
            throw new Error('Use PAN.enable to enable or disable TOUCH_PAN');
        }
    });

    state = this.states.NONE;

    var inputToState = function (mouseButton, keyboard) {
        var _iteratorNormalCompletion2 = true;
        var _didIteratorError2 = false;
        var _iteratorError2 = undefined;

        try {
            for (var _iterator2 = (0, _getIterator3.default)((0, _keys2.default)(_this.states)), _step2; !(_iteratorNormalCompletion2 = (_step2 = _iterator2.next()).done); _iteratorNormalCompletion2 = true) {
                var key = _step2.value;

                var _state = _this.states[key];
                if (_state.enable && _state.mouseButton === mouseButton && _state.keyboard === keyboard) {
                    return _state;
                }
            }
        } catch (err) {
            _didIteratorError2 = true;
            _iteratorError2 = err;
        } finally {
            try {
                if (!_iteratorNormalCompletion2 && _iterator2.return) {
                    _iterator2.return();
                }
            } finally {
                if (_didIteratorError2) {
                    throw _iteratorError2;
                }
            }
        }

        return _this.states.NONE;
    };

    var touchToState = function (finger) {
        var _iteratorNormalCompletion3 = true;
        var _didIteratorError3 = false;
        var _iteratorError3 = undefined;

        try {
            for (var _iterator3 = (0, _getIterator3.default)((0, _keys2.default)(_this.states)), _step3; !(_iteratorNormalCompletion3 = (_step3 = _iterator3.next()).done); _iteratorNormalCompletion3 = true) {
                var key = _step3.value;

                var _state2 = _this.states[key];
                if (_state2.enable && finger == _state2.finger) {
                    return _state2;
                }
            }
        } catch (err) {
            _didIteratorError3 = true;
            _iteratorError3 = err;
        } finally {
            try {
                if (!_iteratorNormalCompletion3 && _iterator3.return) {
                    _iterator3.return();
                }
            } finally {
                if (_didIteratorError3) {
                    throw _iteratorError3;
                }
            }
        }

        return _this.states.NONE;
    };

    var onMouseDown = function (event) {
        var _this2 = this;

        player.stop().then(function () {
            if (_this2.enabled === false) return;
            event.preventDefault();
            state = inputToState(event.button, currentKey, _this2.states);

            var staticPos = window.getComputedStyle(event.target.parentElement).position !== 'static';
            var bounds = staticPos ? event.target.getBoundingClientRect() : { left: 0, top: 0 };
            var x = event.clientX - event.target.offsetLeft - bounds.left;
            var y = event.clientY - event.target.offsetTop - bounds.top;

            switch (state) {
                case _this2.states.ORBIT:
                case _this2.states.PANORAMIC:
                    rotateStart.set(x, y);
                    break;
                case _this2.states.SELECT:
                    // If the key 'S' is down, the engine selects node under mouse
                    _this2._view.selectNodeAt(new THREE.Vector2(x, y));
                    break;
                case _this2.states.MOVE_GLOBE:
                    {
                        snapShotCamera.shot(_this2.camera);
                        ptScreenClick.x = x;
                        ptScreenClick.y = y;

                        var point = view.getPickingPositionFromDepth(ptScreenClick);
                        lastRotation = [];
                        // update tangent sphere which passes through the point
                        if (point) {
                            ctrl.range = _this2.getRange();
                            updateSpherePicking.bind(_this2)(point, ptScreenClick);
                        } else {
                            state = _this2.states.NONE;
                        }
                        break;
                    }
                case _this2.states.DOLLY:
                    dollyStart.set(x, y);
                    break;
                case _this2.states.PAN:
                    panStart.set(x, y);
                    break;
                default:
            }
            if (state != _this2.states.NONE) {
                _this2.domElement.addEventListener('mousemove', _handlerMouseMove, false);
                _this2.domElement.addEventListener('mouseup', _handlerMouseUp, false);
                _this2.domElement.addEventListener('mouseleave', _handlerMouseUp, false);
                _this2.dispatchEvent(_this2.startEvent);
            }
        });
    };

    var onMouseUp = function () /* event */{
        var _this3 = this;

        if (this.enabled === false) return;

        this.domElement.removeEventListener('mousemove', _handlerMouseMove, false);
        this.domElement.removeEventListener('mouseup', _handlerMouseUp, false);
        this.domElement.removeEventListener('mouseleave', _handlerMouseUp, false);
        this.dispatchEvent(this.endEvent);

        player.stop();

        // Launch damping movement for :
        //      * this.states.ORBIT
        //      * this.states.MOVE_GLOBE
        if (this.enableDamping) {
            if (state === this.states.ORBIT && (sphericalDelta.theta > EPS || sphericalDelta.phi > EPS)) {
                player.play(dampingOrbitalMvt).then(function () {
                    return _this3.resetControls();
                });
            } else if (state === this.states.MOVE_GLOBE && lastRotation.length === 2 && Date.now() - lastTimeMouseMove < 50 && !lastRotation[1].equals(lastRotation[0])) {
                // animation since mouse up event occurs less than 50ms after the last mouse move
                ctrl.qDelta.setFromUnitVectors(lastRotation[1], lastRotation[0]);
                player.play(animationDampingMove).then(function () {
                    return _this3.resetControls();
                });
            } else {
                updateCameraTargetOnGlobe.bind(this)();
            }
        } else {
            updateCameraTargetOnGlobe.bind(this)();
        }
    };

    var wheelTimer = void 0;
    var onMouseWheel = function (event) {
        var _this4 = this;

        clearTimeout(wheelTimer);
        player.stop().then(function () {
            if (!_this4.enabled || !_this4.states.DOLLY.enable) return;

            event.preventDefault();
            event.stopPropagation();

            var delta = 0;

            // WebKit / Opera / Explorer 9
            if (event.wheelDelta !== undefined) {
                delta = event.wheelDelta;
                // Firefox
            } else if (event.detail !== undefined) {
                delta = -event.detail;
            }

            if (delta > 0) {
                _this4.dollyOut();
            } else if (delta < 0) {
                _this4.dollyIn();
            }

            var previousRange = _this4.getRange();
            update();
            var newRange = _this4.getRange();
            if (Math.abs(newRange - previousRange) / previousRange > 0.001 && enableEventPositionChanged) {
                _this4.dispatchEvent({
                    type: CONTROL_EVENTS.RANGE_CHANGED,
                    previous: { range: previousRange },
                    new: { range: newRange }
                });
            }
            snapShotSpherical.copy(spherical);

            // Prevent updating target as long as the wheel rotates
            wheelTimer = setTimeout(function () {
                _this4.waitSceneLoaded().then(function () {
                    if (state == _this4.states.NONE) {
                        _this4.updateCameraTransformation();
                    }
                });
            }, 250);

            _this4.dispatchEvent(_this4.startEvent);
            _this4.dispatchEvent(_this4.endEvent);
        });
    };

    var onKeyUp = function () {
        if (this.enabled === false || this.enableKeys === false) return;

        if (state === this.states.PAN) {
            updateCameraTargetOnGlobe.bind(this)();
        }
        currentKey = undefined;
    };

    var currentKey = void 0;

    var onKeyDown = function (event) {
        var _this5 = this;

        player.stop().then(function () {
            if (_this5.enabled === false || _this5.enableKeys === false) return;
            currentKey = event.keyCode;
            switch (event.keyCode) {
                case _this5.states.PAN.up:
                    _this5.mouseToPan(0, _this5.keyPanSpeed);
                    state = _this5.states.PAN;
                    update();
                    break;
                case _this5.states.PAN.bottom:
                    _this5.mouseToPan(0, -_this5.keyPanSpeed);
                    state = _this5.states.PAN;
                    update();
                    break;
                case _this5.states.PAN.left:
                    _this5.mouseToPan(_this5.keyPanSpeed, 0);
                    state = _this5.states.PAN;
                    update();
                    break;
                case _this5.states.PAN.right:
                    _this5.mouseToPan(-_this5.keyPanSpeed, 0);
                    state = _this5.states.PAN;
                    update();
                    break;
                default:
            }
        });
    };

    var onTouchStart = function (event) {
        if (this.enabled === false) return;

        state = touchToState(event.touches.length);

        if (state !== this.states.NONE) {
            switch (state) {

                case this.states.TOUCH_ROTATE:
                    rotateStart.set(event.touches[0].pageX, event.touches[0].pageY);
                    break;

                case this.states.TOUCH_DOLLY:
                    var dx = event.touches[0].pageX - event.touches[1].pageX;
                    var dy = event.touches[0].pageY - event.touches[1].pageY;
                    var distance = Math.sqrt(dx * dx + dy * dy);
                    dollyStart.set(0, distance);
                    break;

                case this.states.TOUCH_PAN:
                    panStart.set(event.touches[0].pageX, event.touches[0].pageY);
                    break;
                default:
            }

            this.dispatchEvent(this.startEvent);
        }
    };

    var onTouchMove = function (event) {
        if (this.enabled === false) return;

        event.preventDefault();
        event.stopPropagation();

        var element = this.domElement === document ? this.domElement.body : this.domElement;

        switch (event.touches.length) {

            case this.states.TOUCH_ROTATE.finger:
                if (state !== this.states.TOUCH_ROTATE) return;

                rotateEnd.set(event.touches[0].pageX, event.touches[0].pageY);
                rotateDelta.subVectors(rotateEnd, rotateStart);

                // rotating across whole screen goes 360 degrees around
                this.rotateLeft(2 * Math.PI * rotateDelta.x / element.clientWidth * this.rotateSpeed);
                // rotating up and down along whole screen attempts to go 360, but limited to 180
                this.rotateUp(2 * Math.PI * rotateDelta.y / element.clientHeight * this.rotateSpeed);

                rotateStart.copy(rotateEnd);

                update();
                break;

            case this.states.TOUCH_DOLLY.finger:
                if (state !== this.states.TOUCH_DOLLY) return;

                var dx = event.touches[0].pageX - event.touches[1].pageX;
                var dy = event.touches[0].pageY - event.touches[1].pageY;
                var distance = Math.sqrt(dx * dx + dy * dy);

                dollyEnd.set(0, distance);
                dollyDelta.subVectors(dollyEnd, dollyStart);

                if (dollyDelta.y > 0) {
                    this.dollyOut();
                } else if (dollyDelta.y < 0) {
                    this.dollyIn();
                }

                dollyStart.copy(dollyEnd);

                update();
                break;

            case this.states.TOUCH_PAN.finger:
                if (state !== this.states.TOUCH_PAN) return;

                panEnd.set(event.touches[0].pageX, event.touches[0].pageY);
                panDelta.subVectors(panEnd, panStart);

                this.mouseToPan(panDelta.x, panDelta.y);

                panStart.copy(panEnd);

                update();
                break;

            default:

                state = this.states.NONE;

        }
    };

    var onTouchEnd = function () /* event */{
        if (this.enabled === false) return;

        this.dispatchEvent(this.endEvent);
        state = this.states.NONE;
        currentKey = undefined;
    };

    // Callback launched when player is stopped
    this.resetControls = function () {
        animatedScale = 0.0;
        lastRotation.splice(0);
        ctrl.progress = 0;
        updateCameraTargetOnGlobe.bind(this)();
    };

    // update object camera position
    this.updateCameraTransformation = function (controlState) {
        var updateCameraTarget = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : true;

        var bkDamping = this.enableDamping;
        this.enableDamping = false;
        state = controlState || this.states.ORBIT;
        update();
        if (updateCameraTarget) {
            updateCameraTargetOnGlobe.bind(this)();
        }
        this.enableDamping = bkDamping;
    };

    this.dispose = function () {
        // this.domElement.removeEventListener( 'contextmenu', onContextMenu, false );
        this.domElement.removeEventListener('mousedown', onMouseDown, false);
        this.domElement.removeEventListener('mousewheel', onMouseWheel, false);
        this.domElement.removeEventListener('DOMMouseScroll', onMouseWheel, false); // firefox

        this.domElement.removeEventListener('touchstart', onTouchStart, false);
        this.domElement.removeEventListener('touchend', onTouchEnd, false);
        this.domElement.removeEventListener('touchmove', onTouchMove, false);

        this.domElement.removeEventListener('mousemove', onMouseMove, false);
        this.domElement.removeEventListener('mouseup', onMouseUp, false);

        window.removeEventListener('keydown', onKeyDown, false);

        // this.dispatchEvent( { type: 'dispose' } ); // should this be added here?
    };

    // Instance all
    this.domElement.addEventListener('contextmenu', function (event) {
        event.preventDefault();
    }, false);
    this.domElement.addEventListener('mousedown', onMouseDown.bind(this), false);
    this.domElement.addEventListener('mousewheel', onMouseWheel.bind(this), false);
    this.domElement.addEventListener('dblclick', function (event) {
        if (this.enabled === false) return;

        if (!this.isAnimationEnabled()) {
            // eslint-disable-next-line no-console
            console.warn('double click without animation is disabled, waiting fix in future refactoring');
            return;
        }

        // Double click throws move camera's target with animation
        if (!currentKey) {
            var staticPos = window.getComputedStyle(event.target.parentElement).position !== 'static';
            var bounds = staticPos ? event.target.getBoundingClientRect() : { left: 0, top: 0 };
            ptScreenClick.x = event.clientX - event.target.offsetLeft - bounds.left;
            ptScreenClick.y = event.clientY - event.target.offsetTop - bounds.top;

            var point = view.getPickingPositionFromDepth(ptScreenClick);

            if (point) {
                animatedScale = 0.6;
                this.setCameraTargetPosition(point);
            }
        }
    }.bind(this), false);
    this.domElement.addEventListener('DOMMouseScroll', onMouseWheel.bind(this), false); // firefox

    this.domElement.addEventListener('touchstart', onTouchStart.bind(this), false);
    this.domElement.addEventListener('touchend', onTouchEnd.bind(this), false);
    this.domElement.addEventListener('touchmove', onTouchMove.bind(this), false);

    // refresh control for each animation's frame
    player.addEventListener('animation-frame', update.bind(this));

    function isAnimationWithoutDamping(animation) {
        return animation && !(animation.name === 'damping-move' || animation.name === 'damping-orbit');
    }

    player.addEventListener('animation-started', function (e) {
        if (isAnimationWithoutDamping(e.animation)) {
            _this.dispatchEvent({
                type: 'animation-started'
            });
        }
    });

    player.addEventListener('animation-ended', function (e) {
        if (isAnimationWithoutDamping(e.animation)) {
            _this.dispatchEvent({
                type: 'animation-ended'
            });
        }
    });

    // TODO: Why windows
    window.addEventListener('keydown', onKeyDown.bind(this), false);
    window.addEventListener('keyup', onKeyUp.bind(this), false);

    // Reset key/mouse when window loose focus
    window.addEventListener('blur', function () {
        onKeyUp.bind(_this)();
        onMouseUp.bind(_this)();
    });

    // Initialisation Globe Target and movingGlobeTarget
    setCameraTargetObjectPosition(target);
    movingCameraTargetOnGlobe.copy(target);
    this.camera.up.copy(target.clone().normalize());
    this._view.scene.add(cameraTargetOnGlobe);
    spherical.radius = movingCameraTargetOnGlobe.distanceTo(this.camera.position);

    update();

    // Start position
    initialTarget = cameraTargetOnGlobe.clone();
    initialPosition = this.camera.position.clone();
    initialZoom = this.camera.zoom;
    snapShotSpherical.copy(spherical);

    _handlerMouseMove = onMouseMove.bind(this);
    _handlerMouseUp = onMouseUp.bind(this);

    initPromise = this.waitSceneLoaded().then(function () {
        _this.updateCameraTransformation();
    });
}

GlobeControls.prototype = (0, _create2.default)(THREE.EventDispatcher.prototype);
GlobeControls.prototype.constructor = GlobeControls;

function getRangeFromScale(scale, pitch) {
    // Screen pitch, in millimeters
    pitch = (pitch || 0.28) / 1000;
    var alpha = sizeRendering.FOV / 180 * Math.PI * 0.5;
    // Invert one unit projection (see getDollyScale)
    var range = pitch * sizeRendering.height / (scale * 2 * Math.tan(alpha));

    return range;
}

// # # # # # # # # # # # # # # # # # # # # # # # # # # # # # # # # # # # #

/**
 * Changes the tilt of the current camera, in degrees.
 * <iframe width="100%" height="400" src="http://jsfiddle.net/iTownsIGN/p6t76zox/embedded/" allowfullscreen="allowfullscreen" frameborder="0"></iframe>
 * @param {number}  tilt
 * @param {boolean} isAnimated
 * @return {Promise<void>}
 */
GlobeControls.prototype.setTilt = function (tilt, isAnimated) {
    return this.setOrbitalPosition({ tilt: tilt }, isAnimated);
};

/**
 * Changes the heading of the current camera, in degrees.
 * <iframe width="100%" height="400" src="http://jsfiddle.net/iTownsIGN/rxe4xgxj/embedded/" allowfullscreen="allowfullscreen" frameborder="0"></iframe>
 * @param {number} heading
 * @param {boolean} isAnimated
 * @return {Promise<void>}
 */
GlobeControls.prototype.setHeading = function (heading, isAnimated) {
    return this.setOrbitalPosition({ heading: heading }, isAnimated);
};

/**
 * Sets the "range": the distance in meters between the camera and the current central point on the screen.
 * <iframe width="100%" height="400" src="http://jsfiddle.net/iTownsIGN/Lt3jL5pd/embedded/" allowfullscreen="allowfullscreen" frameborder="0"></iframe>
 * @param {number} range
 * @param {boolean} isAnimated
 * @return {Promise<void>}
 */
GlobeControls.prototype.setRange = function (range, isAnimated) {
    return this.setOrbitalPosition({ range: range }, isAnimated);
};

/**
 * Sets orientation angles of the current camera, in degrees.
 * <iframe width="100%" height="400" src="http://jsfiddle.net/iTownsIGN/9qr2mogh/embedded/" allowfullscreen="allowfullscreen" frameborder="0"></iframe>
 * @param {{tilt:number,heading:number,range:number}} position
 * @param {boolean}  isAnimated
 * @return {Promise<void>}
 */
GlobeControls.prototype.setOrbitalPosition = function (position, isAnimated) {
    var _this6 = this;

    return initPromise.then(function () {
        var geoPosition = _this6.getCameraTargetGeoPosition();
        var altitude = geoPosition.altitude();
        isAnimated = isAnimated === undefined ? _this6.isAnimationEnabled() : isAnimated;
        var deltaPhi = position.tilt === undefined ? 0 : position.tilt * Math.PI / 180 - _this6.getTiltRad();
        var deltaTheta = position.heading === undefined ? 0 : position.heading * Math.PI / 180 - _this6.getHeadingRad();
        var deltaRange = position.range === undefined ? 0 : position.range - _this6.getRange();
        if (position.range) {
            _this6._view.wgs84TileLayer.postUpdate = function () {
                updateAltitudeCoordinate(geoPosition, _this6._view.wgs84TileLayer);
                var errorRange = altitude - geoPosition.altitude();
                if (errorRange != 0) {
                    if (isAnimated && player.isPlaying()) {
                        sphericalTo.radius -= errorRange;
                    } else {
                        position.range -= errorRange;
                        _this6.moveOrbitalPosition(position.range - _this6.getRange(), 0, 0, false);
                    }
                    altitude = geoPosition.altitude();
                }
            };
        }
        return _this6.moveOrbitalPosition(deltaRange, deltaTheta, deltaPhi, isAnimated).then(function () {
            _this6.waitSceneLoaded().then(function () {
                _this6.updateCameraTransformation();
                _this6._view.wgs84TileLayer.postUpdate = function () {};
            });
        });
    });
};

var destSpherical = new THREE.Spherical();

GlobeControls.prototype.moveOrbitalPosition = function (deltaRange, deltaTheta, deltaPhi, isAnimated) {
    var _this7 = this;

    isAnimated = isAnimated === undefined ? this.isAnimationEnabled() : isAnimated;
    var range = deltaRange + this.getRange();
    var cd = this.enableDamping;
    this.enableDamping = false;
    if (isAnimated) {
        destSpherical.theta = deltaTheta + spherical.theta;
        destSpherical.phi = deltaPhi + spherical.phi;
        sphericalTo.radius = range;
        sphericalTo.theta = deltaTheta / animationOrbit.duration;
        sphericalTo.phi = deltaPhi / animationOrbit.duration;
        state = this.states.ORBIT;
        return player.play(animationOrbit).then(function () {
            sphericalTo.theta = 0;
            sphericalTo.phi = 0;
            _this7.enableDamping = cd;
        });
    } else {
        sphericalDelta.theta = deltaTheta;
        sphericalDelta.phi = deltaPhi;
        orbit.scale = range / this.getRange();
        this.updateCameraTransformation(this.states.ORBIT, false);
        this.enableDamping = cd;
        return _promise2.default.resolve();
    }
};

/**
 * Returns the {@linkcode Coordinates} of the globe point targeted by the camera in EPSG:4978 projection. See {@linkcode Coordinates} for conversion
 * <iframe width="100%" height="400" src="http://jsfiddle.net/iTownsIGN/4tjgnv7z/embedded/" allowfullscreen="allowfullscreen" frameborder="0"></iframe>
 * @return {THREE.Vector3} position
 */
GlobeControls.prototype.getCameraTargetPosition = function () {
    return cameraTargetOnGlobe.position;
};

/**
 * Make the camera aim a point in the globe
 *
 * @param {THREE.Vector3} position - the position on the globe to aim, in EPSG:4978 projection
 * @param {boolean} isAnimated - if we should animate the move
 * @return {Promise<void>}
 */
GlobeControls.prototype.setCameraTargetPosition = function (position, isAnimated) {
    var _this8 = this;

    if (!ctrl.targetGeoPosition) {
        ctrl.targetGeoPosition = new _Coordinates2.default('EPSG:4978', position).as('EPSG:4326');
    }

    isAnimated = isAnimated === undefined ? this.isAnimationEnabled() : isAnimated;

    snapShotCamera.shot(this.camera);

    ptScreenClick.x = this.domElement.width / 2;
    ptScreenClick.y = this.domElement.height / 2;

    var vFrom = this.getCameraTargetPosition().clone().normalize();
    var vTo = position.clone().normalize();

    ctrl.lengthTarget = cameraTargetOnGlobe.position.length();
    ctrl.distance = ctrl.lengthTarget - position.length();
    ctrl.lengthCamera = snapShotCamera.position.length();

    if (position.range) {
        animatedScale = 1.0 - position.range / this.getRange();
    }

    if (isAnimated) {
        ctrl.qDelta.setFromUnitVectors(vFrom, vTo);
        state = this.states.MOVE_GLOBE;
        return player.play(animationZoomCenter).then(function () {
            _this8.resetControls();
            _this8.waitSceneLoaded().then(function () {
                animatedScale = 0;
                if (player.isStopped()) {
                    _this8.updateCameraTransformation();
                    ctrl.targetGeoPosition = null;
                }
            });
        });
    } else {
        ctrl.progress = 1.0;
        quatGlobe.setFromUnitVectors(vFrom, vTo);
        this.updateCameraTransformation(this.states.MOVE_GLOBE, false);
        this._view.wgs84TileLayer.postUpdate = function () {
            clampToGround(ctrl);
            _this8.updateCameraTransformation(_this8.states.MOVE_GLOBE, false);
        };
        return this.waitSceneLoaded().then(function () {
            _this8.updateCameraTransformation(_this8.states.MOVE_GLOBE);
            _this8._view.wgs84TileLayer.postUpdate = function () {};
            ctrl.targetGeoPosition = null;
            ctrl.progress = 0.0;
        });
    }
};

/**
 * Returns the "range": the distance in meters between the camera and the current central point on the screen.
 * <iframe width="100%" height="400" src="http://jsfiddle.net/iTownsIGN/Lbt1vfek/embedded/" allowfullscreen="allowfullscreen" frameborder="0"></iframe>
 * @return {number} number
 */
GlobeControls.prototype.getRange = function () {
    return this.getCameraTargetPosition().distanceTo(this.camera.position);
};

/**
 * Returns the tilt of the current camera in degrees.
 * <iframe width="100%" height="400" src="http://jsfiddle.net/iTownsIGN/kcx0of9j/embedded/" allowfullscreen="allowfullscreen" frameborder="0"></iframe>
 * @return {Angle} number - The angle of the rotation in degrees.
 */
GlobeControls.prototype.getTilt = function () {
    return spherical.phi * 180 / Math.PI;
};

/**
 * Returns the heading of the current camera in degrees.
 * <iframe width="100%" height="400" src="http://jsfiddle.net/iTownsIGN/pxv1Lw16/embedded/" allowfullscreen="allowfullscreen" frameborder="0"></iframe>
 * @return {Angle} number - The angle of the rotation in degrees.
 */
GlobeControls.prototype.getHeading = function () {
    return (THREE.Math.radToDeg(spherical.theta) + 360) % 360;
};

GlobeControls.prototype.getTiltRad = function () {
    return spherical.phi;
};

GlobeControls.prototype.getHeadingRad = function () {
    return spherical.theta;
};

GlobeControls.prototype.getPolarAngle = function () {
    return spherical.phi;
};

GlobeControls.prototype.getAzimuthalAngle = function () {
    return spherical.theta;
};

GlobeControls.prototype.moveTarget = function () {
    return movingCameraTargetOnGlobe;
};

/**
 * Displaces the central point to a specific amount of pixels from its current position.
 * <iframe width="100%" height="400" src="http://jsfiddle.net/iTownsIGN/1z7q3c4z/embedded/" allowfullscreen="allowfullscreen" frameborder="0"></iframe>
 * The view flies to the desired coordinate, i.e.is not teleported instantly. Note : The results can be strange in some cases, if ever possible, when e.g.the camera looks horizontally or if the displaced center would not pick the ground once displaced.
 * @param      {vector}  pVector  The vector
 * @return {Promise<void>}
 */
GlobeControls.prototype.pan = function (pVector) {
    var _this9 = this;

    this.mouseToPan(pVector.x, pVector.y);
    this.updateCameraTransformation(this.states.PAN);
    return this.waitSceneLoaded().then(function () {
        _this9.updateCameraTransformation();
    });
};

/**
 * Returns the orientation angles of the current camera, in degrees.
 * <iframe width="100%" height="400" src="http://jsfiddle.net/iTownsIGN/okfj460p/embedded/" allowfullscreen="allowfullscreen" frameborder="0"></iframe>
 * @return {Array<number>}
 */
GlobeControls.prototype.getCameraOrientation = function () {
    var tiltCam = this.getTilt();
    var headingCam = this.getHeading();
    return [tiltCam, headingCam];
};

/**
 * Returns the camera location projected on the ground in lat,lon. See {@linkcode Coordinates} for conversion.
 * <iframe width="100%" height="400" src="http://jsfiddle.net/iTownsIGN/mjv7ha02/embedded/" allowfullscreen="allowfullscreen" frameborder="0"></iframe>
 * @return {Coordinates} position
 */

GlobeControls.prototype.getCameraLocation = function () {
    return new _Coordinates2.default('EPSG:4978', this.camera.position).as('EPSG:4326');
};

/**
 * Retuns the {@linkcode Coordinates} of the central point on screen in lat,lon. See {@linkcode Coordinates} for conversion.
 * <iframe width="100%" height="400" src="http://jsfiddle.net/iTownsIGN/4tjgnv7z/embedded/" allowfullscreen="allowfullscreen" frameborder="0"></iframe>
 * @return {Position} position
 */

GlobeControls.prototype.getCameraTargetGeoPosition = function () {
    return new _Coordinates2.default(this._view.referenceCrs, this.getCameraTargetPosition()).as('EPSG:4326');
};

/**
 * Sets the animation enabled.
 * @param      {boolean}  enable  enable
 */
GlobeControls.prototype.setAnimationEnabled = function (enable) {
    enableAnimation = enable;
};

/**
 * Determines if animation enabled.
 * @return     {boolean}  True if animation enabled, False otherwise.
 */
GlobeControls.prototype.isAnimationEnabled = function () {
    return enableAnimation;
};

/**
 * Returns the actual zoom. The zoom will always be between the [getMinZoom(), getMaxZoom()].
 * <iframe width="100%" height="400" src="http://jsfiddle.net/iTownsIGN/o3Lvanfe/embedded/" allowfullscreen="allowfullscreen" frameborder="0"></iframe>
 * @return     {number}  The zoom .
 */
GlobeControls.prototype.getZoom = function () {
    return (0, _GlobeTileProcessing.computeTileZoomFromDistanceCamera)(this.getRange(), this._view);
};

/**
 * Sets the current zoom, which is an index in the logical scales predefined for the application.
 * The higher the zoom, the closer to the ground.
 * The zoom is always in the [getMinZoom(), getMaxZoom()] range.
 * <iframe width="100%" height="400" src="http://jsfiddle.net/iTownsIGN/7cvno086/embedded/" allowfullscreen="allowfullscreen" frameborder="0"></iframe>
 * @param      {number}  zoom    The zoom
 * @param      {boolean}  isAnimated  Indicates if animated
 * @return     {Promise}
 */
GlobeControls.prototype.setZoom = function (zoom, isAnimated) {
    isAnimated = isAnimated === undefined ? this.isAnimationEnabled() : isAnimated;
    var range = (0, _GlobeTileProcessing.computeDistanceCameraFromTileZoom)(zoom, this._view);
    return this.setRange(range, isAnimated);
};

/**
 * Return the current zoom scale at the central point of the view.
 * This function compute the scale of a map
 * <iframe width="100%" height="400" src="http://jsfiddle.net/iTownsIGN/0p609qbu/embedded/" allowfullscreen="allowfullscreen" frameborder="0"></iframe>
 * @param      {number}  pitch   Screen pitch, in millimeters ; 0.28 by default
 * @return     {number}  The zoom scale.
 */
GlobeControls.prototype.getScale = function (pitch) {
    // TODO: Why error div size height in Chrome?
    // Screen pitch, in millimeters
    pitch = (pitch || 0.28) / 1000;
    var FOV = sizeRendering.FOV / 180 * Math.PI * 0.5;
    // projection one unit on screen
    var unitProjection = sizeRendering.height / (2 * this.getRange() * Math.tan(FOV));
    return pitch * unitProjection;
};

/**
 * To convert the projection in meters on the globe of a number of pixels of screen
 * @param      {number} pixels count pixels to project
 * @param      {number} pixelPitch Screen pixel pitch, in millimeters (default = 0.28 mm / standard pixel size of 0.28 millimeters as defined by the OGC)
 * @return     {number} projection in meters on globe
 */
GlobeControls.prototype.pixelsToMeters = function (pixels) {
    var pixelPitch = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : 0.28;

    var scaled = this.getScale(pixelPitch);

    return pixels * pixelPitch / scaled / 1000;
};

/**
 * To convert the projection a number of horizontal pixels of screen to longitude degree WGS84 on the globe
 * @param      {number} pixels count pixels to project
 * @param      {number} pixelPitch Screen pixel pitch, in millimeters (default = 0.28 mm / standard pixel size of 0.28 millimeters as defined by the OGC)
 * @return     {number} projection in degree on globe
 */
// TODO : Move tools in GlobeView or a new GlobeUtils files
GlobeControls.prototype.pixelsToDegrees = function (pixels) {
    var pixelPitch = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : 0.28;

    var chord = this.pixelsToMeters(pixels, pixelPitch);
    var radius = (0, _Coordinates.ellipsoidSizes)().x;
    return THREE.Math.radToDeg(2 * Math.asin(chord / (2 * radius)));
};

/**
 * Projection on screen in pixels of length in meter on globe
 * @param      {number}  value Length in meter on globe
 * @param      {number}  pixelPitch Screen pixel pitch, in millimeters (default = 0.28 mm / standard pixel size of 0.28 millimeters as defined by the OGC)
 * @return     {number}  projection in pixels on screen
 */
GlobeControls.prototype.metersToPixels = function (value) {
    var pixelPitch = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : 0.28;

    var scaled = this.getScale(pixelPitch);
    pixelPitch /= 1000;
    return value * scaled / pixelPitch;
};

/**
 * Changes the zoom of the central point of screen so that screen acts as a map with a specified scale.
 *  The view flies to the desired zoom scale;
 * <iframe width="100%" height="400" src="http://jsfiddle.net/iTownsIGN/0w4mfdb6/embedded/" allowfullscreen="allowfullscreen" frameborder="0"></iframe>
 * @param      {number}  scale  The scale
 * @param      {number}  pitch  The pitch
 * @param      {boolean}  isAnimated  Indicates if animated
 * @return     {Promise}
 */
// TODO pas de scale supérieur à 0.05....
GlobeControls.prototype.setScale = function (scale, pitch, isAnimated) {
    isAnimated = isAnimated === undefined ? this.isAnimationEnabled() : isAnimated;
    var range = getRangeFromScale(scale);
    return this.setRange(range, isAnimated);
};

/**
 * Changes the center of the scene on screen to the specified in lat, lon. See {@linkcode Coordinates} for conversion.
 * <iframe width="100%" height="400" src="http://jsfiddle.net/iTownsIGN/zrdgzz26/embedded/" allowfullscreen="allowfullscreen" frameborder="0"></iframe>
 * @function
 * @memberOf GlobeControls
 * @param {Object} coordinates - The globe coordinates in EPSG_4326 projection to aim to
 * @param {number} coordinates.latitude
 * @param {number} coordinates.longitude
 * @param {number} coordinates.range
 * @param {boolean}  isAnimated - if the movement should be animated
 * @return {Promise} A promise that resolves when the next 'globe initilazed' event fires.
 */
GlobeControls.prototype.setCameraTargetGeoPosition = function (coordinates, isAnimated) {
    var _this10 = this;

    return initPromise.then(function () {
        isAnimated = isAnimated === undefined ? _this10.isAnimationEnabled() : isAnimated;
        ctrl.targetGeoPosition = new _Coordinates.C.EPSG_4326(coordinates.longitude, coordinates.latitude, 0);
        updateAltitudeCoordinate(ctrl.targetGeoPosition, _this10._view.wgs84TileLayer);
        var position = ctrl.targetGeoPosition.as('EPSG:4978').xyz();
        position.range = coordinates.range;
        return _this10.setCameraTargetPosition(position, isAnimated);
    });
};

/**
 * Changes the center of the scene on screen to the specified in lat, lon. See {@linkcode Coordinates} for conversion.
 * This function allows to change the central position, the zoom, the range, the scale and the camera orientation at the same time.
 * The zoom has to be between the [getMinZoom(), getMaxZoom()].
 * Zoom parameter is ignored if range is set
 * Scale is ignored if range or Zoom is set.
 * <iframe width="100%" height="400" src="http://jsfiddle.net/iTownsIGN/9su6v2qz/embedded/" allowfullscreen="allowfullscreen" frameborder="0"></iframe>
 * @param {Position} position
 * @param {number}  position.longitude  Coordinate longitude WGS84 in degree
 * @param {number}  position.latitude  Coordinate latitude WGS84 in degree
 * @param {number}  [position.tilt]  Camera tilt in degree
 * @param {number}  [position.heading]  Camera heading in degree
 * @param {number}  [position.range]  The camera distance to the target center
 * @param {number}  [position.zoom]  zoom,  ignored if range is set
 * @param {number}  [position.scale]  scale,  ignored if the zoom or range is set. For a scale of 1/500 it is necessary to write 0,002.
 * @param {boolean}  isAnimated  Indicates if animated
 * @return {Promise}
 */
GlobeControls.prototype.setCameraTargetGeoPositionAdvanced = function (position, isAnimated) {
    var _this11 = this;

    isAnimated = isAnimated === undefined ? this.isAnimationEnabled() : isAnimated;
    if (position.zoom) {
        position.range = (0, _GlobeTileProcessing.computeDistanceCameraFromTileZoom)(position.zoom, this._view);
    } else if (position.scale) {
        position.range = getRangeFromScale(position.scale);
    }
    enableEventPositionChanged = false;
    return this.setCameraTargetGeoPosition(position, isAnimated).then(function () {
        enableEventPositionChanged = true;
        return _this11.setOrbitalPosition(position, isAnimated);
    });
};

/**
 * Pick a position on the globe at the given position in lat,lon. See {@linkcode Coordinates} for conversion.
 * @param {number | MouseEvent} mouse - The x-position inside the Globe element or a mouse event.
 * @param {number=} y - The y-position inside the Globe element.
 * @return {Coordinates} position
 */
GlobeControls.prototype.pickGeoPosition = function (mouse, y) {
    var screenCoords = {
        x: mouse,
        y: y
    };

    if (mouse instanceof MouseEvent) {
        var staticPos = window.getComputedStyle(mouse.target.parentElement).position !== 'static';
        var bounds = staticPos ? mouse.target.getBoundingClientRect() : { left: 0, top: 0 };
        screenCoords.x = mouse.clientX - mouse.target.offsetLeft - bounds.left;
        screenCoords.y = mouse.clientY - mouse.target.offsetTop - bounds.top;
    }

    var pickedPosition = this._view.getPickingPositionFromDepth(screenCoords);

    if (!pickedPosition) {
        return;
    }

    return new _Coordinates2.default('EPSG:4978', pickedPosition).as('EPSG:4326');
};

// # # # # # # # # # # # # # # # # # # # # # # # # # # # # # # # # # # # #

GlobeControls.prototype.reset = function () {
    // TODO not reset target globe
    state = this.states.NONE;

    this.target.copy(initialTarget);
    this.camera.position.copy(initialPosition);
    this.camera.zoom = initialZoom;

    this.camera.updateProjectionMatrix();
    this._view.notifyChange(true);

    this.updateCameraTransformation();
};

exports.default = GlobeControls;