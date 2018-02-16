'use strict';

Object.defineProperty(exports, "__esModule", {
    value: true
});

var _getIterator2 = require('babel-runtime/core-js/get-iterator');

var _getIterator3 = _interopRequireDefault(_getIterator2);

var _set = require('babel-runtime/core-js/set');

var _set2 = _interopRequireDefault(_set);

var _getPrototypeOf = require('babel-runtime/core-js/object/get-prototype-of');

var _getPrototypeOf2 = _interopRequireDefault(_getPrototypeOf);

var _classCallCheck2 = require('babel-runtime/helpers/classCallCheck');

var _classCallCheck3 = _interopRequireDefault(_classCallCheck2);

var _createClass2 = require('babel-runtime/helpers/createClass');

var _createClass3 = _interopRequireDefault(_createClass2);

var _possibleConstructorReturn2 = require('babel-runtime/helpers/possibleConstructorReturn');

var _possibleConstructorReturn3 = _interopRequireDefault(_possibleConstructorReturn2);

var _inherits2 = require('babel-runtime/helpers/inherits');

var _inherits3 = _interopRequireDefault(_inherits2);

var _sign = require('babel-runtime/core-js/math/sign');

var _sign2 = _interopRequireDefault(_sign);

var _three = require('three');

var THREE = _interopRequireWildcard(_three);

var _MainLoop = require('../../Core/MainLoop');

function _interopRequireWildcard(obj) { if (obj && obj.__esModule) { return obj; } else { var newObj = {}; if (obj != null) { for (var key in obj) { if (Object.prototype.hasOwnProperty.call(obj, key)) newObj[key] = obj[key]; } } newObj.default = obj; return newObj; } }

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

// Note: we could use existing three.js controls (like https://github.com/mrdoob/three.js/blob/dev/examples/js/controls/FirstPersonControls.js)
// but including these controls in itowns allows use to integrate them tightly with itowns.
// Especially the existing controls are expecting a continuous update loop while we have a pausable one (so our controls use .notifyChange when needed)


// Mouse movement handling
function onDocumentMouseDown(event, pointerX, pointerY) {
    event.preventDefault();
    this._isMouseDown = true;

    this._onMouseDownMouseX = pointerX;
    this._onMouseDownMouseY = pointerY;

    this._stateOnMouseDown = this._state.snapshot();
}

function limitRotation(camera3D, rot, verticalFOV) {
    // Limit vertical rotation (look up/down) to make sure the user cannot see
    // outside of the cone defined by verticalFOV
    var limit = THREE.Math.degToRad(verticalFOV - camera3D.fov) * 0.5;
    return THREE.Math.clamp(rot, -limit, limit);
}

function onPointerMove(pointerX, pointerY) {
    if (this._isMouseDown === true) {
        // in rigor we have tan(theta) = tan(cameraFOV) * deltaH / H
        // (where deltaH is the vertical amount we moved, and H the renderer height)
        // we loosely approximate tan(x) by x
        var pxToAngleRatio = THREE.Math.degToRad(this.camera.fov) / this.view.mainLoop.gfxEngine.height;

        // update state based on pointer movement
        this._state.rotateY = (pointerX - this._onMouseDownMouseX) * pxToAngleRatio + this._stateOnMouseDown.rotateY;
        this._state.rotateX = limitRotation(this.camera, (pointerY - this._onMouseDownMouseY) * pxToAngleRatio + this._stateOnMouseDown.rotateX, this.options.verticalFOV);

        applyRotation(this.view, this.camera, this._state);
    }
}

function applyRotation(view, camera3D, state) {
    camera3D.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), camera3D.up);

    camera3D.rotateY(state.rotateY);
    camera3D.rotateX(state.rotateX);

    view.notifyChange(true, camera3D);
}

// Mouse wheel
function onDocumentMouseWheel(event) {
    var delta = 0;
    if (event.wheelDelta !== undefined) {
        delta = -event.wheelDelta;
        // Firefox
    } else if (event.detail !== undefined) {
        delta = event.detail;
    }

    this.camera.fov = THREE.Math.clamp(this.camera.fov + (0, _sign2.default)(delta), 10, Math.min(100, this.options.verticalFOV));

    this.camera.updateProjectionMatrix();

    this._state.rotateX = limitRotation(this.camera, this._state.rotateX, this.options.verticalFOV);

    applyRotation(this.view, this.camera, this._state);
}

function onDocumentMouseUp() {
    this._isMouseDown = false;
}

// Keyboard handling
function onKeyUp(e) {
    var move = MOVEMENTS[e.keyCode];
    if (move) {
        this.moves.delete(move);
        this.view.notifyChange(true);
        e.preventDefault();
    }
}

function onKeyDown(e) {
    var move = MOVEMENTS[e.keyCode];
    if (move) {
        this.moves.add(move);
        this.view.notifyChange(false);
        e.preventDefault();
    }
}

var MOVEMENTS = {
    38: { method: 'translateZ', sign: -1 }, // FORWARD: up key
    40: { method: 'translateZ', sign: 1 }, // BACKWARD: down key
    37: { method: 'translateX', sign: -1 }, // STRAFE_LEFT: left key
    39: { method: 'translateX', sign: 1 }, // STRAFE_RIGHT: right key
    33: { method: 'translateY', sign: 1 }, // UP: PageUp key
    34: { method: 'translateY', sign: -1 } // DOWN: PageDown key
};

var FirstPersonControls = function (_THREE$EventDispatche) {
    (0, _inherits3.default)(FirstPersonControls, _THREE$EventDispatche);

    /**
     * @Constructor
     * @param {View} view
     * @param {object} options
     * @param {boolean} options.focusOnClick - whether or not to focus the renderer domElement on click
     * @param {boolean} options.focusOnMouseOver - whether or not to focus when the mouse is over the domElement
     * @param {boolean} options.moveSpeed - if > 0, pressing the arrow keys will move the camera
     * @param {number} options.verticalFOV - define the max visible vertical angle of the scene in degrees (default 180)
     * @param {number} options.panoramaRatio - alternative way to specify the max vertical angle when using a panorama.
     * You can specify the panorama width/height ratio and the verticalFOV will be computed automatically
     */
    function FirstPersonControls(view) {
        var options = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : {};
        (0, _classCallCheck3.default)(this, FirstPersonControls);

        var _this = (0, _possibleConstructorReturn3.default)(this, (FirstPersonControls.__proto__ || (0, _getPrototypeOf2.default)(FirstPersonControls)).call(this));

        _this.camera = view.camera.camera3D;
        _this.view = view;
        _this.moves = new _set2.default();
        if (options.panoramaRatio) {
            var radius = options.panoramaRatio * 200 / (2 * Math.PI);
            options.verticalFOV = options.panoramaRatio == 2 ? 180 : THREE.Math.radToDeg(2 * Math.atan(200 / (2 * radius)));
        }
        options.verticalFOV = options.verticalFOV || 180;
        options.moveSpeed = options.moveSpeed === undefined ? 10 : options.moveSpeed; // backward or forward move speed in m/s
        _this.options = options;

        _this._isMouseDown = false;
        _this._onMouseDownMouseX = 0;
        _this._onMouseDownMouseY = 0;

        // Compute the correct init state, given the calculus in applyRotation:
        // cam.quaternion = q * r
        // => r = inverse(q) * cam.quaterion
        // q is the quaternion derived from the up vector
        var q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), _this.camera.up);
        q.inverse();
        // compute r
        var r = _this.camera.quaternion.clone().premultiply(q);
        // tranform it to euler
        var e = new THREE.Euler(0, 0, 0, 'YXZ').setFromQuaternion(r);
        // and use it as the initial state
        var self = _this;
        _this._state = {
            rotateX: e.x,
            rotateY: e.y,

            snapshot: function snapshot() {
                return { rotateX: self._state.rotateX, rotateY: self._state.rotateY };
            }
        };

        var domElement = view.mainLoop.gfxEngine.renderer.domElement;
        var bindedPD = onDocumentMouseDown.bind(_this);
        domElement.addEventListener('mousedown', function (e) {
            return bindedPD(e, e.clientX, e.clientY);
        }, false);
        domElement.addEventListener('touchstart', function (e) {
            return bindedPD(e, e.touches[0].pageX, e.touches[0].pageY);
        }, false);
        var bindedPM = onPointerMove.bind(_this);
        domElement.addEventListener('mousemove', function (e) {
            return bindedPM(e.clientX, e.clientY);
        }, false);
        domElement.addEventListener('touchmove', function (e) {
            return bindedPM(e.touches[0].pageX, e.touches[0].pageY);
        }, false);
        domElement.addEventListener('mouseup', onDocumentMouseUp.bind(_this), false);
        domElement.addEventListener('touchend', onDocumentMouseUp.bind(_this), false);
        domElement.addEventListener('keyup', onKeyUp.bind(_this), true);
        domElement.addEventListener('keydown', onKeyDown.bind(_this), true);
        domElement.addEventListener('mousewheel', onDocumentMouseWheel.bind(_this), false);
        domElement.addEventListener('DOMMouseScroll', onDocumentMouseWheel.bind(_this), false); // firefox

        _this.view.addFrameRequester(_MainLoop.MAIN_LOOP_EVENTS.AFTER_CAMERA_UPDATE, _this.update.bind(_this));

        // focus policy
        if (options.focusOnMouseOver) {
            domElement.addEventListener('mouseover', function () {
                return domElement.focus();
            });
        }
        if (options.focusOnClick) {
            domElement.addEventListener('click', function () {
                return domElement.focus();
            });
        }
        return _this;
    }

    (0, _createClass3.default)(FirstPersonControls, [{
        key: 'isUserInteracting',
        value: function isUserInteracting() {
            return this.moves.size !== 0 && !this._isMouseDown;
        }
    }, {
        key: 'update',
        value: function update(dt, updateLoopRestarted) {
            // if we are in a keypressed state, then update position

            // dt will not be relevant when we just started rendering, we consider a 1-frame move in this case
            if (updateLoopRestarted) {
                dt = 16;
            }

            var _iteratorNormalCompletion = true;
            var _didIteratorError = false;
            var _iteratorError = undefined;

            try {
                for (var _iterator = (0, _getIterator3.default)(this.moves), _step; !(_iteratorNormalCompletion = (_step = _iterator.next()).done); _iteratorNormalCompletion = true) {
                    var move = _step.value;

                    if (move.method === 'translateY') {
                        this.camera.position.z += move.sign * this.options.moveSpeed * dt / 1000;
                    } else {
                        this.camera[move.method](move.sign * this.options.moveSpeed * dt / 1000);
                    }
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

            if (this.moves.size || this._isMouseDown) {
                this.view.notifyChange(true);
            }
        }
    }]);
    return FirstPersonControls;
}(THREE.EventDispatcher);

exports.default = FirstPersonControls;