'use strict';

Object.defineProperty(exports, "__esModule", {
    value: true
});

var _create = require('babel-runtime/core-js/object/create');

var _create2 = _interopRequireDefault(_create);

var _three = require('three');

var THREE = _interopRequireWildcard(_three);

var _LayeredMaterial = require('../Renderer/LayeredMaterial');

var _LayeredMaterial2 = _interopRequireDefault(_LayeredMaterial);

var _LayeredMaterialConstants = require('../Renderer/LayeredMaterialConstants');

var _RendererConstant = require('../Renderer/RendererConstant');

var _RendererConstant2 = _interopRequireDefault(_RendererConstant);

var _OGCWebServiceHelper = require('./Scheduler/Providers/OGCWebServiceHelper');

var _OGCWebServiceHelper2 = _interopRequireDefault(_OGCWebServiceHelper);

function _interopRequireWildcard(obj) { if (obj && obj.__esModule) { return obj; } else { var newObj = {}; if (obj != null) { for (var key in obj) { if (Object.prototype.hasOwnProperty.call(obj, key)) newObj[key] = obj[key]; } } newObj.default = obj; return newObj; } }

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function TileMesh(geometry, params) {
    // Constructor
    THREE.Mesh.call(this);

    this.matrixAutoUpdate = false;
    this.rotationAutoUpdate = false;

    if (!params.extent) {
        throw new Error('params.extent is mandatory to build a TileMesh');
    }

    this.level = params.level;
    this.extent = params.extent;

    this.geometry = geometry;

    this.obb = this.geometry.OBB.clone();

    this.boundingSphere = this.OBB().box3D.getBoundingSphere();

    this.material = new _LayeredMaterial2.default(params.materialOptions);

    this.frustumCulled = false;

    this.updateGeometricError();

    // Layer
    this.setDisplayed(false);

    this.layerUpdateState = {};

    this.material.setUuid(this.id);
} /**
   * Generated On: 2015-10-5
   * Class: TileMesh
   * Description: Tuile de maillage, noeud du quadtree MNT. Le Materiel est issus du QuadTree ORTHO.
   */

TileMesh.prototype = (0, _create2.default)(THREE.Mesh.prototype);
TileMesh.prototype.constructor = TileMesh;

TileMesh.prototype.updateMatrixWorld = function (force) {
    THREE.Mesh.prototype.updateMatrixWorld.call(this, force);
    this.OBB().update();
};

TileMesh.prototype.isVisible = function () {
    return this.visible;
};

TileMesh.prototype.setDisplayed = function (show) {
    this.material.visible = show;
};

TileMesh.prototype.setVisibility = function (show) {
    this.visible = show;
};

TileMesh.prototype.isDisplayed = function () {
    return this.material.visible;
};

// switch material in function of state
TileMesh.prototype.changeState = function (state) {
    if (state == _RendererConstant2.default.DEPTH) {
        this.material.defines.DEPTH_MODE = 1;
        delete this.material.defines.MATTE_ID_MODE;
    } else if (state == _RendererConstant2.default.ID) {
        this.material.defines.MATTE_ID_MODE = 1;
        delete this.material.defines.DEPTH_MODE;
    } else {
        delete this.material.defines.MATTE_ID_MODE;
        delete this.material.defines.DEPTH_MODE;
    }

    this.material.needsUpdate = true;
};

TileMesh.prototype.setFog = function (fog) {
    this.material.setFogDistance(fog);
};

TileMesh.prototype.setSelected = function (select) {
    this.material.setSelected(select);
};

TileMesh.prototype.setTextureElevation = function (elevation) {
    if (this.material === null) {
        return;
    }

    var offsetScale = elevation.pitch || new THREE.Vector4(0, 0, 1, 1);
    this.setBBoxZ(elevation.min, elevation.max);

    this.material.setTexture(elevation.texture, _LayeredMaterialConstants.l_ELEVATION, 0, offsetScale);
};

TileMesh.prototype.setBBoxZ = function (min, max) {
    if (min == undefined && max == undefined) {
        return;
    }
    if (Math.floor(min) !== Math.floor(this.obb.z.min) || Math.floor(max) !== Math.floor(this.obb.z.max)) {
        this.OBB().updateZ(min, max);
        this.OBB().box3D.getBoundingSphere(this.boundingSphere);
        this.updateGeometricError();
    }
};

TileMesh.prototype.updateGeometricError = function () {
    // The geometric error is calculated to have a correct texture display.
    // For the projection of a texture's texel to be less than or equal to one pixel
    this.geometricError = this.boundingSphere.radius / _OGCWebServiceHelper.SIZE_TEXTURE_TILE;
};

TileMesh.prototype.setTexturesLayer = function (textures, layerType, layerId) {
    if (this.material === null) {
        return;
    }
    if (textures) {
        this.material.setTexturesLayer(textures, layerType, layerId);
    }
};

TileMesh.prototype.getLayerTextures = function (layerType, layerId) {
    var mat = this.material;
    return mat.getLayerTextures(layerType, layerId);
};

TileMesh.prototype.isColorLayerLoaded = function (layerId) {
    var mat = this.material;
    return mat.getColorLayerLevelById(layerId) > -1;
};

TileMesh.prototype.isElevationLayerLoaded = function () {
    return this.material.loadedTexturesCount[_LayeredMaterialConstants.l_ELEVATION] > 0;
};

TileMesh.prototype.isColorLayerDownscaled = function (layer) {
    var mat = this.material;
    return mat.isColorLayerDownscaled(layer.id, this.getZoomForLayer(layer));
};

TileMesh.prototype.OBB = function () {
    return this.obb;
};

TileMesh.prototype.getIndexLayerColor = function (idLayer) {
    return this.material.indexOfColorLayer(idLayer);
};

TileMesh.prototype.removeColorLayer = function (idLayer) {
    if (this.layerUpdateState && this.layerUpdateState[idLayer]) {
        delete this.layerUpdateState[idLayer];
    }
    this.material.removeColorLayer(idLayer);
};

TileMesh.prototype.changeSequenceLayers = function (sequence) {
    var layerCount = this.material.getColorLayersCount();

    // Quit if there is only one layer
    if (layerCount < 2) {
        return;
    }

    this.material.setSequence(sequence);
};

TileMesh.prototype.getCoordsForLayer = function (layer) {
    if (layer.protocol.indexOf('wmts') == 0) {
        _OGCWebServiceHelper2.default.computeTileMatrixSetCoordinates(this, layer.options.tileMatrixSet);
        return this.wmtsCoords[layer.options.tileMatrixSet];
    } else if (layer.protocol == 'wms' && this.extent.crs() != layer.projection) {
        if (layer.projection == 'EPSG:3857') {
            var tilematrixset = 'PM';
            _OGCWebServiceHelper2.default.computeTileMatrixSetCoordinates(this, tilematrixset);
            return this.wmtsCoords[tilematrixset];
        } else {
            throw new Error('unsupported projection wms for this viewer');
        }
    } else if (layer.protocol == 'tms') {
        return _OGCWebServiceHelper2.default.computeTMSCoordinates(this, layer.extent);
    } else {
        return [this.extent];
    }
};

TileMesh.prototype.getZoomForLayer = function (layer) {
    if (layer.protocol.indexOf('wmts') == 0) {
        _OGCWebServiceHelper2.default.computeTileMatrixSetCoordinates(this, layer.options.tileMatrixSet);
        return this.wmtsCoords[layer.options.tileMatrixSet][0].zoom;
    } else {
        return this.level;
    }
};

exports.default = TileMesh;