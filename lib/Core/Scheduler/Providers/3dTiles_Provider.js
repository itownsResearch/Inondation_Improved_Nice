'use strict';

Object.defineProperty(exports, "__esModule", {
    value: true
});

var _promise = require('babel-runtime/core-js/promise');

var _promise2 = _interopRequireDefault(_promise);

var _typeof2 = require('babel-runtime/helpers/typeof');

var _typeof3 = _interopRequireDefault(_typeof2);

var _create = require('babel-runtime/core-js/object/create');

var _create2 = _interopRequireDefault(_create);

var _getIterator2 = require('babel-runtime/core-js/get-iterator');

var _getIterator3 = _interopRequireDefault(_getIterator2);

exports.patchMaterialForLogDepthSupport = patchMaterialForLogDepthSupport;

var _three = require('three');

var THREE = _interopRequireWildcard(_three);

var _Provider = require('./Provider');

var _Provider2 = _interopRequireDefault(_Provider);

var _B3dmLoader = require('../../../Renderer/ThreeExtended/B3dmLoader');

var _B3dmLoader2 = _interopRequireDefault(_B3dmLoader);

var _PntsLoader = require('../../../Renderer/ThreeExtended/PntsLoader');

var _PntsLoader2 = _interopRequireDefault(_PntsLoader);

var _Fetcher = require('./Fetcher');

var _Fetcher2 = _interopRequireDefault(_Fetcher);

var _OBB = require('../../../Renderer/ThreeExtended/OBB');

var _OBB2 = _interopRequireDefault(_OBB);

var _Extent = require('../../Geographic/Extent');

var _Extent2 = _interopRequireDefault(_Extent);

var _MathExtended = require('../../Math/MathExtended');

var _MathExtended2 = _interopRequireDefault(_MathExtended);

var _Capabilities = require('../../System/Capabilities');

var _Capabilities2 = _interopRequireDefault(_Capabilities);

var _PrecisionQualifier = "precision highp float;\nprecision highp int;\n";

var _PrecisionQualifier2 = _interopRequireDefault(_PrecisionQualifier);

var _dTilesProcessing = require('../../../Process/3dTilesProcessing');

function _interopRequireWildcard(obj) { if (obj && obj.__esModule) { return obj; } else { var newObj = {}; if (obj != null) { for (var key in obj) { if (Object.prototype.hasOwnProperty.call(obj, key)) newObj[key] = obj[key]; } } newObj.default = obj; return newObj; } }

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function $3dTilesIndex(tileset, baseURL) {
    var counter = 0;
    this.index = {};
    var inverseTileTransform = new THREE.Matrix4();
    var recurse = function (node, baseURL, parent) {
        // compute transform (will become Object3D.matrix when the object is downloaded)
        node.transform = node.transform ? new THREE.Matrix4().fromArray(node.transform) : undefined;

        // The only reason to store _worldFromLocalTransform is because of extendTileset where we need the
        // transform chain for one node.
        node._worldFromLocalTransform = node.transform;
        if (parent && parent._worldFromLocalTransform) {
            if (node.transform) {
                node._worldFromLocalTransform = new THREE.Matrix4().multiplyMatrices(parent._worldFromLocalTransform, node.transform);
            } else {
                node._worldFromLocalTransform = parent._worldFromLocalTransform;
            }
        }

        // getBox only use inverseTileTransform for volume.region so let's not
        // compute the inverse matrix each time
        if (node.viewerRequestVolume && node.viewerRequestVolume.region || node.boundingVolume && node.boundingVolume.region) {
            if (node._worldFromLocalTransform) {
                inverseTileTransform.getInverse(node._worldFromLocalTransform);
            } else {
                inverseTileTransform.identity();
            }
        }

        node.viewerRequestVolume = node.viewerRequestVolume ? getBox(node.viewerRequestVolume, inverseTileTransform) : undefined;
        node.boundingVolume = getBox(node.boundingVolume, inverseTileTransform);

        this.index[counter] = node;
        node.tileId = counter;
        node.baseURL = baseURL;
        counter++;
        if (node.children) {
            var _iteratorNormalCompletion = true;
            var _didIteratorError = false;
            var _iteratorError = undefined;

            try {
                for (var _iterator = (0, _getIterator3.default)(node.children), _step; !(_iteratorNormalCompletion = (_step = _iterator.next()).done); _iteratorNormalCompletion = true) {
                    var child = _step.value;

                    recurse(child, baseURL, node);
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
    }.bind(this);
    recurse(tileset.root, baseURL);

    this.extendTileset = function (tileset, nodeId, baseURL) {
        recurse(tileset.root, baseURL, this.index[nodeId]);
        this.index[nodeId].children = [tileset.root];
    };
}

function $3dTiles_Provider() {
    _Provider2.default.call(this);
}

$3dTiles_Provider.prototype = (0, _create2.default)(_Provider2.default.prototype);

$3dTiles_Provider.prototype.constructor = $3dTiles_Provider;

$3dTiles_Provider.prototype.removeLayer = function () {};

$3dTiles_Provider.prototype.preprocessDataLayer = function (layer, view, scheduler) {
    layer.sseThreshold = layer.sseThreshold || 16;
    layer.cleanupDelay = layer.cleanupDelay || 1000;

    layer._cleanableTiles = [];
    return _Fetcher2.default.json(layer.url, layer.networkOptions).then(function (tileset) {
        layer.tileset = tileset;
        var urlPrefix = layer.url.slice(0, layer.url.lastIndexOf('/') + 1);
        layer.tileIndex = new $3dTilesIndex(tileset, urlPrefix);
        layer.asset = tileset.asset;
        return (0, _dTilesProcessing.init3dTilesLayer)(view, scheduler, layer, tileset.root);
    });
};

function getBox(volume, inverseTileTransform) {
    if (volume.region) {
        var region = volume.region;
        var extent = new _Extent2.default('EPSG:4326', _MathExtended2.default.radToDeg(region[0]), _MathExtended2.default.radToDeg(region[2]), _MathExtended2.default.radToDeg(region[1]), _MathExtended2.default.radToDeg(region[3]));
        var box = _OBB2.default.extentToOBB(extent, region[4], region[5]);
        // update position
        box.position.add(extent.center().as('EPSG:4978').xyz());
        // compute box.matrix from box.position/rotation.
        box.updateMatrix();
        // at this point box.matrix = box.epsg4978_from_local, so
        // we transform it in parent_from_local by using parent's epsg4978_from_local
        // which from our point of view is epsg4978_from_parent.
        // box.matrix = (epsg4978_from_parent ^ -1) * epsg4978_from_local
        //            =  parent_from_epsg4978 * epsg4978_from_local
        //            =  parent_from_local
        box.matrix.premultiply(inverseTileTransform);
        // update position, rotation and scale
        box.matrix.decompose(box.position, box.quaternion, box.scale);
        return { region: box };
    } else if (volume.box) {
        // TODO: only works for axis aligned boxes
        var _box = volume.box;
        // box[0], box[1], box[2] = center of the box
        // box[3], box[4], box[5] = x axis direction and half-length
        // box[6], box[7], box[8] = y axis direction and half-length
        // box[9], box[10], box[11] = z axis direction and half-length
        var center = new THREE.Vector3(_box[0], _box[1], _box[2]);
        var w = center.x - _box[3];
        var e = center.x + _box[3];
        var s = center.y - _box[7];
        var n = center.y + _box[7];
        var b = center.z - _box[11];
        var t = center.z + _box[11];

        return { box: new THREE.Box3(new THREE.Vector3(w, s, b), new THREE.Vector3(e, n, t)) };
    } else if (volume.sphere) {
        var sphere = new THREE.Sphere(new THREE.Vector3(volume.sphere[0], volume.sphere[1], volume.sphere[2]), volume.sphere[3]);
        return { sphere: sphere };
    }
}

var rePosition = new RegExp('gl_Position.*(?![^]*gl_Position)');
var reMain = new RegExp('[^\\w]*main[^\\w]*(void)?[^\\w]*{');
function patchMaterialForLogDepthSupport(material) {
    // Check if the shader does not already use the log depth buffer
    if (material.vertexShader.indexOf('USE_LOGDEPTHBUF') !== -1 || material.vertexShader.indexOf('logdepthbuf_pars_vertex') !== -1) {
        return;
    }

    // Add vertex shader log depth buffer header
    material.vertexShader = '#include <logdepthbuf_pars_vertex>\n#define EPSILON 1e-6\n' + material.vertexShader;
    // Add log depth buffer code snippet after last gl_Position modification
    var re = rePosition.exec(material.vertexShader);
    var idx = re[0].length + re.index;
    material.vertexShader = material.vertexShader.slice(0, idx) + '\n#include <logdepthbuf_vertex>\n' + material.vertexShader.slice(idx);

    // Add fragment shader log depth buffer header
    material.fragmentShader = _PrecisionQualifier2.default + '\n#include <logdepthbuf_pars_fragment>\n' + material.fragmentShader;
    // Add log depth buffer code snippet at the first line of the main function
    re = reMain.exec(material.fragmentShader);
    idx = re[0].length + re.index;
    material.fragmentShader = material.fragmentShader.slice(0, idx) + '\n#include <logdepthbuf_fragment>\n' + material.fragmentShader.slice(idx);

    material.defines = {
        USE_LOGDEPTHBUF: 1,
        USE_LOGDEPTHBUF_EXT: 1
    };
}

$3dTiles_Provider.prototype.b3dmToMesh = function (data, layer) {
    this._b3dmLoader = this._b3dmLoader || new _B3dmLoader2.default();
    return this._b3dmLoader.parse(data, layer.asset.gltfUpAxis, this._textDecoder).then(function (result) {
        result.gltf.scene.traverse(function (mesh) {
            mesh.frustumCulled = false;
            if (mesh.material) {
                if (layer.overrideMaterials) {
                    mesh.material.dispose();
                    if ((0, _typeof3.default)(layer.overrideMaterials) === 'object' && layer.overrideMaterials.isMaterial) {
                        mesh.material = layer.overrideMaterials.clone();
                    } else {
                        mesh.material = new THREE.MeshLambertMaterial({ color: 0xffffff });
                    }
                } else if (_Capabilities2.default.isLogDepthBufferSupported() && mesh.material.isRawShaderMaterial && !layer.doNotPatchMaterial) {
                    patchMaterialForLogDepthSupport(mesh.material);
                    // eslint-disable-next-line no-console
                    console.warn('b3dm shader has been patched to add log depth buffer support');
                }
                mesh.material.transparent = layer.opacity < 1.0;
                mesh.material.opacity = layer.opacity;
            }
        });
        var batchTable = result.batchTable;
        var object3d = result.gltf.scene;
        return { batchTable: batchTable, object3d: object3d };
    });
};

$3dTiles_Provider.prototype.pntsParse = function (data) {
    var _this = this;

    return new _promise2.default(function (resolve) {
        resolve({ object3d: _PntsLoader2.default.parse(data, _this._textDecoder).point });
    });
};

function configureTile(tile, layer, metadata, parent) {
    tile.frustumCulled = false;
    tile.layer = layer.id;

    // parse metadata
    if (metadata.transform) {
        tile.applyMatrix(metadata.transform);
    }
    tile.geometricError = metadata.geometricError;
    tile.tileId = metadata.tileId;
    if (metadata.refine) {
        tile.additiveRefinement = metadata.refine.toUpperCase() === 'ADD';
    } else {
        tile.additiveRefinement = parent ? parent.additiveRefinement : false;
    }
    tile.viewerRequestVolume = metadata.viewerRequestVolume;
    tile.boundingVolume = metadata.boundingVolume;
    if (tile.boundingVolume.region) {
        tile.add(tile.boundingVolume.region);
    }
    tile.updateMatrixWorld();
}

$3dTiles_Provider.prototype.executeCommand = function (command) {
    var layer = command.layer;
    var metadata = command.metadata;
    var tile = new THREE.Object3D();
    configureTile(tile, layer, metadata, command.requester);
    var path = metadata.content ? metadata.content.url : undefined;
    this._textDecoder = this._textDecoder || new TextDecoder('utf-8');
    var textDecoder = this._textDecoder;

    var setLayer = function (obj) {
        obj.layers.set(layer.threejsLayer);
    };
    if (path) {
        // Check if we have relative or absolute url (with tileset's lopocs for example)
        var url = path.startsWith('http') ? path : metadata.baseURL + path;
        var supportedFormats = {
            b3dm: this.b3dmToMesh.bind(this),
            pnts: this.pntsParse.bind(this)
        };
        return _Fetcher2.default.arrayBuffer(url, layer.networkOptions).then(function (result) {
            if (result !== undefined) {
                var func = void 0;
                var magic = textDecoder.decode(new Uint8Array(result, 0, 4));
                if (magic[0] === '{') {
                    result = JSON.parse(textDecoder.decode(new Uint8Array(result)));
                    var newPrefix = url.slice(0, url.lastIndexOf('/') + 1);
                    layer.tileIndex.extendTileset(result, metadata.tileId, newPrefix);
                } else if (magic == 'b3dm') {
                    func = supportedFormats.b3dm;
                } else if (magic == 'pnts') {
                    func = supportedFormats.pnts;
                } else {
                    _promise2.default.reject('Unsupported magic code ' + magic);
                }
                if (func) {
                    // TODO: request should be delayed if there is a viewerRequestVolume
                    return func(result, layer).then(function (content) {
                        tile.content = content.object3d;
                        if (content.batchTable) {
                            tile.batchTable = content.batchTable;
                        }
                        tile.add(content.object3d);
                        tile.traverse(setLayer);
                        return tile;
                    });
                }
            }
            tile.traverse(setLayer);
            return tile;
        });
    } else {
        return new _promise2.default(function (resolve) {
            tile.traverse(setLayer);
            resolve(tile);
        });
    }
};

exports.default = $3dTiles_Provider;