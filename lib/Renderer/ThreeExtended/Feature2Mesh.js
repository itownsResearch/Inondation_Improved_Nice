'use strict';

Object.defineProperty(exports, "__esModule", {
    value: true
});

var _getIterator2 = require('babel-runtime/core-js/get-iterator');

var _getIterator3 = _interopRequireDefault(_getIterator2);

var _three = require('three');

var THREE = _interopRequireWildcard(_three);

var _earcut = require('earcut');

var _earcut2 = _interopRequireDefault(_earcut);

function _interopRequireWildcard(obj) { if (obj && obj.__esModule) { return obj; } else { var newObj = {}; if (obj != null) { for (var key in obj) { if (Object.prototype.hasOwnProperty.call(obj, key)) newObj[key] = obj[key]; } } newObj.default = obj; return newObj; } }

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function getAltitude(options, properties, contour) {
    if (options.altitude) {
        if (typeof options.altitude === 'function') {
            return options.altitude(properties, contour);
        } else {
            return options.altitude;
        }
    }
    return 0;
}

function getExtrude(options, properties) {
    if (options.extrude) {
        if (typeof options.extrude === 'function') {
            return options.extrude(properties);
        } else {
            return options.extrude;
        }
    }
    return 0;
}

function randomColor() {
    var randomColor = new THREE.Color();
    randomColor.setHex(Math.random() * 0xffffff);
    return randomColor;
}

function getColor(options, properties) {
    if (options.color) {
        if (typeof options.color === 'function') {
            return options.color(properties);
        } else {
            return options.color;
        }
    }
    return randomColor();
}

function fillColorArray(colors, offset, length, r, g, b) {
    for (var i = offset; i < offset + length; ++i) {
        colors[3 * i] = r;
        colors[3 * i + 1] = g;
        colors[3 * i + 2] = b;
    }
}

/*
 * Convert coordinates to vertices positionned at a given altitude
 *
 * @param  {Coordinate[]} contour - Coordinates of a feature
 * @param  {number | number[] } altitude - Altitude of the feature
 * @return {Vector3[]} vertices
 */
function coordinatesToVertices(contour, altitude, target, offset) {
    var i = 0;
    // loop over contour coodinates
    var _iteratorNormalCompletion = true;
    var _didIteratorError = false;
    var _iteratorError = undefined;

    try {
        for (var _iterator = (0, _getIterator3.default)(contour), _step; !(_iteratorNormalCompletion = (_step = _iterator.next()).done); _iteratorNormalCompletion = true) {
            var coordinate = _step.value;

            // convert coordinate to position
            var vec = coordinate.xyz();
            // get the normal vector.
            var normal = coordinate.geodesicNormal;
            // get altitude from array or constant
            var alti = Array.isArray(altitude) ? altitude[i++] : altitude;
            // move the vertex following the normal, to put the point on the good altitude
            vec.add(normal.clone().multiplyScalar(alti));
            // fill the vertices array at the offset position
            vec.toArray(target, offset);
            // increment the offset
            offset += 3;
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

/*
 * Helper function to extract, for a given feature id, the feature contour coordinates, and its properties.
 *
 * param  {structure with coordinate[] and featureVertices[]} coordinates - representation of the features
 * param  {properties[]} properties - properties of the features
 * param  {number} id - id of the feature
 * return {Coordinate[], propertie[] } {contour, properties}
 */
function extractFeature(coordinates, properties, id) {
    var featureVertices = coordinates.featureVertices[id];
    var contour = coordinates.coordinates.slice(featureVertices.offset, featureVertices.offset + featureVertices.count);
    var property = properties[id].properties;
    return { contour: contour, property: property };
}

/*
 * Add indices for the side faces.
 * We loop over the contour and create a side face made of two triangles.
 *
 * For a contour made of (n) coordinates, there are (n*2) vertices.
 * The (n) first vertices are on the roof, the (n) other vertices are on the floor.
 *
 * If index (i) is on the roof, index (i+length) is on the floor.
 *
 * @param {number[]} indices - Indices of vertices
 * @param {number} length - length of the contour of the feature
 * @param {number} offset - index of the first vertice of this feature
 */
function addFaces(indices, length, offset) {
    // loop over contour length, and for each point of the contour,
    // add indices to make two triangle, that make the side face
    for (var i = offset; i < offset + length - 1; ++i) {
        // first triangle indices
        indices.push(i);
        indices.push(i + length);
        indices.push(i + 1);
        // second triangle indices
        indices.push(i + 1);
        indices.push(i + length);
        indices.push(i + length + 1);
    }
}

function coordinateToPoints(coordinates, properties, options) {
    var vertices = new Float32Array(3 * coordinates.coordinates.length);
    var colors = new Uint8Array(3 * coordinates.coordinates.length);
    var geometry = new THREE.BufferGeometry();
    var offset = 0;

    /* eslint-disable guard-for-in */
    for (var id in coordinates.featureVertices) {
        var _extractFeature = extractFeature(coordinates, properties, id),
            contour = _extractFeature.contour,
            property = _extractFeature.property;
        // get altitude from properties


        var altitude = getAltitude(options, property, contour);
        coordinatesToVertices(contour, altitude, vertices, offset * 3);

        // assign color to each point
        var color = getColor(options, property);
        fillColorArray(colors, offset, contour.length, color.r * 255, color.g * 255, color.b * 255);

        // increment offset
        offset += contour.length;
    }
    geometry.addAttribute('position', new THREE.BufferAttribute(vertices, 3));
    geometry.addAttribute('color', new THREE.BufferAttribute(colors, 3, true));
    return new THREE.Points(geometry);
}

function coordinateToLines(coordinates, properties, options) {
    var indices = [];
    var vertices = new Float32Array(3 * coordinates.coordinates.length);
    var colors = new Uint8Array(3 * coordinates.coordinates.length);
    var geometry = new THREE.BufferGeometry();
    var offset = 0;

    /* eslint-disable-next-line */
    for (var id in coordinates.featureVertices) {
        var _extractFeature2 = extractFeature(coordinates, properties, id),
            contour = _extractFeature2.contour,
            property = _extractFeature2.property;
        // get altitude from properties


        var altitude = getAltitude(options, property, contour);
        coordinatesToVertices(contour, altitude, vertices, offset * 3);

        // set indices
        var line = coordinates.featureVertices[id];
        // TODO optimize indices lines
        // is the same array each time
        for (var i = line.offset; i < line.offset + line.count - 1; ++i) {
            indices.push(i);
            indices.push(i + 1);
        }

        // assign color to each point
        var color = getColor(options, property);
        fillColorArray(colors, offset, contour.length, color.r * 255, color.g * 255, color.b * 255);

        // increment offset
        offset += contour.length;
    }

    geometry.addAttribute('position', new THREE.BufferAttribute(vertices, 3));
    geometry.addAttribute('color', new THREE.BufferAttribute(colors, 3, true));
    geometry.setIndex(new THREE.BufferAttribute(new Uint32Array(indices), 1));
    return new THREE.LineSegments(geometry);
}

function coordinateToPolygon(coordinates, properties, options) {
    var indices = [];
    var vertices = new Float32Array(3 * coordinates.coordinates.length);
    var colors = new Uint8Array(3 * coordinates.coordinates.length);
    var geometry = new THREE.BufferGeometry();
    var offset = 0;
    var minAltitude = Infinity;
    /* eslint-disable-next-line */
    for (var id in coordinates.featureVertices) {
        // extract contour coodinates and properties of one feature
        var _extractFeature3 = extractFeature(coordinates, properties, id),
            contour = _extractFeature3.contour,
            property = _extractFeature3.property;
        // get altitude and extrude amount from properties


        var altitudeBottom = getAltitude(options, property, contour);
        minAltitude = Math.min(minAltitude, altitudeBottom);

        // add vertices of the top face
        coordinatesToVertices(contour, altitudeBottom, vertices, offset * 3);
        var verticesTopFace = vertices.slice(offset * 3, offset * 3 + contour.length * 3);
        // triangulate the top face
        var triangles = (0, _earcut2.default)(verticesTopFace, null, 3);
        var _iteratorNormalCompletion2 = true;
        var _didIteratorError2 = false;
        var _iteratorError2 = undefined;

        try {
            for (var _iterator2 = (0, _getIterator3.default)(triangles), _step2; !(_iteratorNormalCompletion2 = (_step2 = _iterator2.next()).done); _iteratorNormalCompletion2 = true) {
                var indice = _step2.value;

                indices.push(offset + indice);
            }
            // assign color to each point
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

        var color = getColor(options, property);
        fillColorArray(colors, offset, contour.length, color.r * 255, color.g * 255, color.b * 255);
        // increment offset
        offset += contour.length;
    }

    geometry.addAttribute('position', new THREE.BufferAttribute(vertices, 3));
    geometry.addAttribute('color', new THREE.BufferAttribute(colors, 3, true));
    geometry.setIndex(new THREE.BufferAttribute(new Uint16Array(indices), 1));
    return new THREE.Mesh(geometry);
}

function coordinateToPolygonExtruded(coordinates, properties, options) {
    var indices = [];
    var vertices = new Float32Array(2 * 3 * coordinates.coordinates.length);
    var colors = new Uint8Array(3 * 2 * coordinates.coordinates.length);
    var geometry = new THREE.BufferGeometry();
    var offset = 0;
    var offset2 = 0;
    var nbVertices = 0;
    var minAltitude = Infinity;
    /* eslint-disable-next-line */
    for (var id in coordinates.featureVertices) {
        // extract contour coodinates and properties of one feature
        var _extractFeature4 = extractFeature(coordinates, properties, id),
            contour = _extractFeature4.contour,
            property = _extractFeature4.property;
        // get altitude and extrude amount from properties


        var altitudeBottom = getAltitude(options, property, contour);
        minAltitude = Math.min(minAltitude, altitudeBottom);
        var extrudeAmount = getExtrude(options, property);
        // altitudeTopFace is the altitude of the visible top face.

        // add vertices of the top face
        coordinatesToVertices(contour, altitudeBottom + extrudeAmount, vertices, offset2);
        // triangulate the top face
        nbVertices = contour.length * 3;
        var verticesTopFace = vertices.slice(offset2, offset2 + nbVertices);
        var triangles = (0, _earcut2.default)(verticesTopFace, null, 3);
        var _iteratorNormalCompletion3 = true;
        var _didIteratorError3 = false;
        var _iteratorError3 = undefined;

        try {
            for (var _iterator3 = (0, _getIterator3.default)(triangles), _step3; !(_iteratorNormalCompletion3 = (_step3 = _iterator3.next()).done); _iteratorNormalCompletion3 = true) {
                var indice = _step3.value;

                indices.push(offset + indice);
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

        offset2 += nbVertices;
        // add vertices of the bottom face
        coordinatesToVertices(contour, altitudeBottom, vertices, offset2);
        offset2 += nbVertices;
        // add indices to make the side faces
        addFaces(indices, contour.length, offset);
        // assign color to each point
        var color = 0xffffff;//getColor(options, property);
        fillColorArray(colors, offset, contour.length, color.r * 255, color.g * 255, color.b * 255);
        offset += contour.length;
        fillColorArray(colors, offset, contour.length, color.r * 155, color.g * 155, color.b * 155);
        offset += contour.length;
    }
    geometry.addAttribute('position', new THREE.BufferAttribute(vertices, 3));
    geometry.addAttribute('color', new THREE.BufferAttribute(colors, 3, true));
    geometry.setIndex(new THREE.BufferAttribute(new Uint16Array(indices), 1));
    var result = new THREE.Mesh(geometry);
    result.minAltitude = minAltitude;
    return result;
}

/*
 * Convert all feature coordinates in one mesh.
 *
 * Read the altitude of each feature in the properties of the feature, using the function given in the param style : style.altitude(properties).
 * For polygon, read extrude amout using the function given in the param style.extrude(properties).
 *
 * param  {structure with coordinate[] and featureVertices[]} coordinates - representation of all the features
 * param  {properties[]} properties - properties of all the features
 * param  {callbacks} callbacks defines functions to read altitude and extrude amout from feature properties
 * return {THREE.Mesh} mesh
 */
function coordinatesToMesh(coordinates, properties, options) {
    if (!coordinates) {
        return;
    }
    var mesh;
    switch (coordinates.type) {
        case 'point':
            {
                mesh = coordinateToPoints(coordinates, properties, options);
                break;
            }
        case 'linestring':
            {
                mesh = coordinateToLines(coordinates, properties, options);
                break;
            }
        case 'polygon':
            {
                if (options.extrude) {
                    mesh = coordinateToPolygonExtruded(coordinates, properties, options);
                } else {
                    mesh = coordinateToPolygon(coordinates, properties, options);
                }
                break;
            }
        default:
    }

    // set mesh material
    mesh.material.vertexColors = THREE.VertexColors;
    mesh.material.color = new THREE.Color(0xffffff);
    return mesh;
}

function featureToThree(feature, options) {
    var mesh = coordinatesToMesh(feature.geometry, feature.properties, options);
    mesh.properties = feature.properties;
    return mesh;
}

function featureCollectionToThree(featureCollection, options) {
    var group = new THREE.Group();
    group.minAltitude = Infinity;
    var _iteratorNormalCompletion4 = true;
    var _didIteratorError4 = false;
    var _iteratorError4 = undefined;

    try {
        for (var _iterator4 = (0, _getIterator3.default)(featureCollection.geometries), _step4; !(_iteratorNormalCompletion4 = (_step4 = _iterator4.next()).done); _iteratorNormalCompletion4 = true) {
            var geometry = _step4.value;

            var properties = featureCollection.features;
            var mesh = coordinatesToMesh(geometry, properties, options);
            group.add(mesh);
            group.minAltitude = Math.min(mesh.minAltitude, group.minAltitude);
        }
    } catch (err) {
        _didIteratorError4 = true;
        _iteratorError4 = err;
    } finally {
        try {
            if (!_iteratorNormalCompletion4 && _iterator4.return) {
                _iterator4.return();
            }
        } finally {
            if (_didIteratorError4) {
                throw _iteratorError4;
            }
        }
    }

    group.features = featureCollection.features;
    return group;
}

exports.default = {
    convert: function convert() {
        var options = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : {};

        return function (feature) {
            if (!feature) return;
            if (feature.geometries) {
                return featureCollectionToThree(feature, options);
            } else {
                return featureToThree(feature, options);
            }
        };
    }
};