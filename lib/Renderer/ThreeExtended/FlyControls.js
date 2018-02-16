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

var _three = require('three');

var THREE = _interopRequireWildcard(_three);

var _MainLoop = require('../../Core/MainLoop');

function _interopRequireWildcard(obj) { if (obj && obj.__esModule) { return obj; } else { var newObj = {}; if (obj != null) { for (var key in obj) { if (Object.prototype.hasOwnProperty.call(obj, key)) newObj[key] = obj[key]; } } newObj.default = obj; return newObj; } }

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

var MOVEMENTS = {
    38: { method: 'translateZ', sign: -1 }, // FORWARD: up key
    40: { method: 'translateZ', sign: 1 }, // BACKWARD: down key
    37: { method: 'translateX', sign: -1 }, // STRAFE_LEFT: left key
    39: { method: 'translateX', sign: 1 }, // STRAFE_RIGHT: right key
    33: { method: 'rotateZ', sign: 1, noSpeed: true }, // UP: PageUp key
    34: { method: 'rotateZ', sign: -1, noSpeed: true }, // DOWN: PageDown key
    wheelup: { method: 'translateZ', sign: 1, oneshot: true }, // WHEEL up
    wheeldown: { method: 'translateZ', sign: -1, oneshot: true } // WHEEL down
};

function onDocumentMouseDown(event) {
    event.preventDefault();
    this._isMouseDown = true;

    this._onMouseDownMouseX = event.clientX;
    this._onMouseDownMouseY = event.clientY;
}

function onTouchStart(event) {
    event.preventDefault();
    this._isMouseDown = true;

    this._onMouseDownMouseX = event.touches[0].pageX;
    this._onMouseDownMouseY = event.touches[0].pageY;
}

function onPointerMove(pointerX, pointerY) {
    if (this._isMouseDown === true) {
        // in rigor we have tan(theta) = tan(cameraFOV) * deltaH / H
        // (where deltaH is the vertical amount we moved, and H the renderer height)
        // we loosely approximate tan(x) by x
        var pxToAngleRatio = THREE.Math.degToRad(this._camera3D.fov) / this.view.mainLoop.gfxEngine.height;
        this._camera3D.rotateY((pointerX - this._onMouseDownMouseX) * pxToAngleRatio);
        this._camera3D.rotateX((pointerY - this._onMouseDownMouseY) * pxToAngleRatio);
        this._onMouseDownMouseX = pointerX;
        this._onMouseDownMouseY = pointerY;
        this.view.notifyChange(false, this._camera3D);
    }
}

function onDocumentMouseUp() {
    this._isMouseDown = false;
}

function onKeyUp(e) {
    var move = MOVEMENTS[e.keyCode];
    if (move) {
        this.moves.delete(move);
        e.preventDefault();
    }
}

function onKeyDown(e) {
    var move = MOVEMENTS[e.keyCode];
    if (move) {
        this.moves.add(move);
        this.view.notifyChange(false, this);
        e.preventDefault();
    }
}

function onDocumentMouseWheel(event) {
    var delta = 0;
    if (event.wheelDelta !== undefined) {
        delta = event.wheelDelta;
        // Firefox
    } else if (event.detail !== undefined) {
        delta = -event.detail;
    }
    if (delta < 0) {
        this.moves.add(MOVEMENTS.wheelup);
    } else {
        this.moves.add(MOVEMENTS.wheeldown);
    }

    this.view.notifyChange(false, this);
}

/**
 * First-Person controls (at least a possible declination of it).
 *
 * Bindings:
 * - up + down keys: forward/backward
 * - left + right keys: strafing movements
 * - PageUp + PageDown: roll movement
 * - mouse click+drag: pitch and yaw movements (as looking at a panorama, not as in FPS games for instance)
 */

var FlyControls = function (_THREE$EventDispatche) {
    (0, _inherits3.default)(FlyControls, _THREE$EventDispatche);

    /**
     * @Constructor
     * @param {View} view
     * @param {object} options
     * @param {boolean} options.focusOnClick - whether or not to focus the renderer domElement on click
     * @param {boolean} options.focusOnMouseOver - whether or not to focus when the mouse is over the domElement
     */
    function FlyControls(view) {
        var options = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : {};
        (0, _classCallCheck3.default)(this, FlyControls);

        var _this = (0, _possibleConstructorReturn3.default)(this, (FlyControls.__proto__ || (0, _getPrototypeOf2.default)(FlyControls)).call(this));

        var domElement = view.mainLoop.gfxEngine.renderer.domElement;
        _this.view = view;
        _this.options = options;
        _this._camera3D = view.camera.camera3D;
        _this.moves = new _set2.default();
        _this.moveSpeed = 10; // backward or forward move speed in m/s

        _this._onMouseDownMouseX = 0;
        _this._onMouseDownMouseY = 0;

        _this._isMouseDown = false;

        domElement.addEventListener('mousedown', onDocumentMouseDown.bind(_this), false);
        domElement.addEventListener('touchstart', onTouchStart.bind(_this), false);
        var bindedPM = onPointerMove.bind(_this);
        domElement.addEventListener('mousemove', function (e) {
            return bindedPM(e.clientX, e.clientY);
        }, false);
        domElement.addEventListener('touchmove', function (e) {
            return bindedPM(e.touches[0].pageX, e.touches[0].pageY);
        }, false);
        domElement.addEventListener('mouseup', onDocumentMouseUp.bind(_this), false);
        domElement.addEventListener('touchend', onDocumentMouseUp.bind(_this), false);
        domElement.addEventListener('mousewheel', onDocumentMouseWheel.bind(_this), false);
        domElement.addEventListener('DOMMouseScroll', onDocumentMouseWheel.bind(_this), false); // firefox
        domElement.addEventListener('keyup', onKeyUp.bind(_this), true);
        domElement.addEventListener('keydown', onKeyDown.bind(_this), true);

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

    (0, _createClass3.default)(FlyControls, [{
        key: 'isUserInteracting',
        value: function isUserInteracting() {
            return this.moves.size !== 0 || this._isMouseDown;
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
                    var _move = _step.value;

                    this._camera3D[_move.method](_move.sign * (_move.noSpeed ? 1 : this.moveSpeed) * dt / 1000);
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

            if (this.moves.size > 0 || this._isMouseDown) {
                this.view.notifyChange(true, this._camera3D);

                var _iteratorNormalCompletion2 = true;
                var _didIteratorError2 = false;
                var _iteratorError2 = undefined;

                try {
                    for (var _iterator2 = (0, _getIterator3.default)(this.moves), _step2; !(_iteratorNormalCompletion2 = (_step2 = _iterator2.next()).done); _iteratorNormalCompletion2 = true) {
                        var move = _step2.value;

                        if (move.oneshot) {
                            this.moves.delete(move);
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
            }
        }
    }]);
    return FlyControls;
}(THREE.EventDispatcher);

exports.default = FlyControls;