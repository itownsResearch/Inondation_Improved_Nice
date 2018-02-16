'use strict';

Object.defineProperty(exports, "__esModule", {
    value: true
});

var _promise = require('babel-runtime/core-js/promise');

var _promise2 = _interopRequireDefault(_promise);

var _getIterator2 = require('babel-runtime/core-js/get-iterator');

var _getIterator3 = _interopRequireDefault(_getIterator2);

var _three = require('three');

var THREE = _interopRequireWildcard(_three);

var _GLTFLoader = require('./GLTFLoader');

var _GLTFLoader2 = _interopRequireDefault(_GLTFLoader);

var _BatchTable = require('./BatchTable');

var _BatchTable2 = _interopRequireDefault(_BatchTable);

function _interopRequireWildcard(obj) { if (obj && obj.__esModule) { return obj; } else { var newObj = {}; if (obj != null) { for (var key in obj) { if (Object.prototype.hasOwnProperty.call(obj, key)) newObj[key] = obj[key]; } } newObj.default = obj; return newObj; } }

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

var matrixChangeUpVectorZtoY = new THREE.Matrix4().makeRotationX(Math.PI / 2);
// For gltf rotation
var matrixChangeUpVectorZtoX = new THREE.Matrix4().makeRotationZ(-Math.PI / 2);

function B3dmLoader() {
    this.glTFLoader = new _GLTFLoader2.default();
}

function filterUnsupportedSemantics(obj) {
    // see GLTFLoader GLTFShader.prototype.update function
    var supported = ['MODELVIEW', 'MODELVIEWINVERSETRANSPOSE', 'PROJECTION', 'JOINTMATRIX'];

    if (obj.gltfShader) {
        var names = [];
        // eslint-disable-next-line guard-for-in
        for (var name in obj.gltfShader.boundUniforms) {
            names.push(name);
        }
        var _iteratorNormalCompletion = true;
        var _didIteratorError = false;
        var _iteratorError = undefined;

        try {
            for (var _iterator = (0, _getIterator3.default)(names), _step; !(_iteratorNormalCompletion = (_step = _iterator.next()).done); _iteratorNormalCompletion = true) {
                var _name = _step.value;

                var semantic = obj.gltfShader.boundUniforms[_name].semantic;
                if (supported.indexOf(semantic) < 0) {
                    delete obj.gltfShader.boundUniforms[_name];
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
    }
}
// parse for RTC values
function applyOptionalCesiumRTC(data, gltf, textDecoder) {
    var headerView = new DataView(data, 0, 20);
    var contentArray = new Uint8Array(data, 20, headerView.getUint32(12, true));
    var content = textDecoder.decode(new Uint8Array(contentArray));
    var json = JSON.parse(content);
    if (json.extensions && json.extensions.CESIUM_RTC) {
        gltf.position.fromArray(json.extensions.CESIUM_RTC.center);
        gltf.updateMatrixWorld(true);
    }
}

B3dmLoader.prototype.parse = function (buffer, gltfUpAxis, textDecoder) {
    var _this = this;

    if (!buffer) {
        throw new Error('No array buffer provided.');
    }

    var view = new DataView(buffer, 4); // starts after magic

    var byteOffset = 0;
    var b3dmHeader = {};
    var batchTable = {};

    // Magic type is unsigned char [4]
    b3dmHeader.magic = textDecoder.decode(new Uint8Array(buffer, 0, 4));
    if (b3dmHeader.magic) {
        // Version, byteLength, batchTableJSONByteLength, batchTableBinaryByteLength and batchTable types are uint32
        b3dmHeader.version = view.getUint32(byteOffset, true);
        byteOffset += Uint32Array.BYTES_PER_ELEMENT;

        b3dmHeader.byteLength = view.getUint32(byteOffset, true);
        byteOffset += Uint32Array.BYTES_PER_ELEMENT;

        b3dmHeader.FTJSONLength = view.getUint32(byteOffset, true);
        byteOffset += Uint32Array.BYTES_PER_ELEMENT;

        b3dmHeader.FTBinaryLength = view.getUint32(byteOffset, true);
        byteOffset += Uint32Array.BYTES_PER_ELEMENT;

        b3dmHeader.BTJSONLength = view.getUint32(byteOffset, true);
        byteOffset += Uint32Array.BYTES_PER_ELEMENT;

        b3dmHeader.BTBinaryLength = view.getUint32(byteOffset, true);
        byteOffset += Uint32Array.BYTES_PER_ELEMENT;

        if (b3dmHeader.BTJSONLength > 0) {
            var sizeBegin = 28 + b3dmHeader.FTJSONLength + b3dmHeader.FTBinaryLength;
            batchTable = _BatchTable2.default.parse(buffer.slice(sizeBegin, b3dmHeader.BTJSONLength + sizeBegin), textDecoder);
        }
        // TODO: missing feature and batch table
        return new _promise2.default(function (resolve /* , reject */) {
            _this.glTFLoader.parse(buffer.slice(28 + b3dmHeader.FTJSONLength + b3dmHeader.FTBinaryLength + b3dmHeader.BTJSONLength + b3dmHeader.BTBinaryLength), function onload(gltf) {
                var _iteratorNormalCompletion2 = true;
                var _didIteratorError2 = false;
                var _iteratorError2 = undefined;

                try {
                    for (var _iterator2 = (0, _getIterator3.default)(gltf.scenes), _step2; !(_iteratorNormalCompletion2 = (_step2 = _iterator2.next()).done); _iteratorNormalCompletion2 = true) {
                        var scene = _step2.value;

                        scene.traverse(filterUnsupportedSemantics);
                    }
                    // Rotation managed
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

                if (gltfUpAxis === undefined || gltfUpAxis === 'Y') {
                    gltf.scene.applyMatrix(matrixChangeUpVectorZtoY);
                } else if (gltfUpAxis === 'X') {
                    gltf.scene.applyMatrix(matrixChangeUpVectorZtoX);
                }

                // RTC managed
                applyOptionalCesiumRTC(buffer.slice(28 + b3dmHeader.FTJSONLength + b3dmHeader.FTBinaryLength + b3dmHeader.BTJSONLength + b3dmHeader.BTBinaryLength), gltf.scene, textDecoder);

                var b3dm = { gltf: gltf, batchTable: batchTable };
                resolve(b3dm);
            });
        });
    } else {
        throw new Error('Invalid b3dm file.');
    }
};

exports.default = B3dmLoader;