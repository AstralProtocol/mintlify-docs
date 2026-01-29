import { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import Map, { Marker, Source, Layer, NavigationControl, useControl } from 'react-map-gl';
import MapboxDraw from '@mapbox/mapbox-gl-draw';
import * as turf from '@turf/turf';
import 'mapbox-gl/dist/mapbox-gl.css';
import '@mapbox/mapbox-gl-draw/dist/mapbox-gl-draw.css';
import './App.css';

type Operation = 'distance' | 'within' | 'contains' | 'intersects' | 'area' | 'length';

// Demo values - in production these would come from config
const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_TOKEN || '';
const API_URL = import.meta.env.VITE_API_URL || 'https://api.astral.global';

interface Point {
  lng: number;
  lat: number;
}

// GeoJSON types
type GeoJSONGeometry = GeoJSON.Point | GeoJSON.Polygon | GeoJSON.LineString;

// Draw control component
function DrawControl({
  onCreate,
  onUpdate,
  onDelete,
  initialFeatures,
}: {
  onCreate: (e: { features: GeoJSON.Feature[] }) => void;
  onUpdate: (e: { features: GeoJSON.Feature[] }) => void;
  onDelete: (e: { features: GeoJSON.Feature[] }) => void;
  initialFeatures?: GeoJSON.FeatureCollection;
}) {
  const drawRef = useRef<MapboxDraw | null>(null);

  useControl<MapboxDraw>(
    () => {
      const draw = new MapboxDraw({
        displayControlsDefault: false,
        controls: {
          polygon: true,
          line_string: true,
          point: true,
          trash: true,
        },
        defaultMode: 'simple_select',
        styles: [
          // Polygon fill
          {
            id: 'gl-draw-polygon-fill',
            type: 'fill',
            filter: ['all', ['==', '$type', 'Polygon']],
            paint: {
              'fill-color': '#f59e0b',
              'fill-opacity': 0.2,
            },
          },
          // Polygon stroke
          {
            id: 'gl-draw-polygon-stroke',
            type: 'line',
            filter: ['all', ['==', '$type', 'Polygon']],
            paint: {
              'line-color': '#f59e0b',
              'line-width': 2,
            },
          },
          // Line
          {
            id: 'gl-draw-line',
            type: 'line',
            filter: ['all', ['==', '$type', 'LineString']],
            paint: {
              'line-color': '#ec4899',
              'line-width': 3,
            },
          },
          // Vertex points
          {
            id: 'gl-draw-point',
            type: 'circle',
            filter: ['all', ['==', '$type', 'Point'], ['==', 'meta', 'vertex']],
            paint: {
              'circle-radius': 6,
              'circle-color': '#fff',
              'circle-stroke-color': '#f59e0b',
              'circle-stroke-width': 2,
            },
          },
          // Midpoints
          {
            id: 'gl-draw-point-mid',
            type: 'circle',
            filter: ['all', ['==', '$type', 'Point'], ['==', 'meta', 'midpoint']],
            paint: {
              'circle-radius': 4,
              'circle-color': '#f59e0b',
              'circle-opacity': 0.5,
            },
          },
          // Standalone points
          {
            id: 'gl-draw-point-standalone',
            type: 'circle',
            filter: ['all', ['==', '$type', 'Point'], ['!=', 'meta', 'vertex'], ['!=', 'meta', 'midpoint']],
            paint: {
              'circle-radius': 8,
              'circle-color': '#6366f1',
              'circle-stroke-color': '#fff',
              'circle-stroke-width': 2,
            },
          },
        ],
      });
      drawRef.current = draw;
      return draw;
    },
    ({ map }) => {
      map.on('draw.create', onCreate);
      map.on('draw.update', onUpdate);
      map.on('draw.delete', onDelete);

      // Load initial features after draw is ready
      if (initialFeatures && drawRef.current) {
        setTimeout(() => {
          drawRef.current?.set(initialFeatures);
        }, 100);
      }
    },
    ({ map }) => {
      map.off('draw.create', onCreate);
      map.off('draw.update', onUpdate);
      map.off('draw.delete', onDelete);
    },
    {
      position: 'top-left',
    }
  );

  // Update features when initialFeatures change
  useEffect(() => {
    if (initialFeatures && drawRef.current) {
      drawRef.current.set(initialFeatures);
    }
  }, [initialFeatures]);

  return null;
}

function App() {
  // Geometry state - stored as GeoJSON
  const [geometryA, setGeometryA] = useState<GeoJSONGeometry>({
    type: 'Point',
    coordinates: [-0.1276, 51.5074],
  });
  const [geometryB, setGeometryB] = useState<GeoJSONGeometry>({
    type: 'Point',
    coordinates: [-0.1156, 51.5194],
  });

  // Operation state
  const [operation, setOperation] = useState<Operation>('distance');
  const [radius, setRadius] = useState(500);

  // UI state
  const [verifiedResult, setVerifiedResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'sdk' | 'curl' | 'geojson'>('geojson');
  const [geojsonInput, setGeojsonInput] = useState('');
  const [geojsonError, setGeojsonError] = useState<string | null>(null);
  const [editingGeometry, setEditingGeometry] = useState<'A' | 'B'>('A');
  const [useDrawMode, setUseDrawMode] = useState(false);

  // Convert point state for markers
  const pointA: Point = geometryA.type === 'Point'
    ? { lng: geometryA.coordinates[0], lat: geometryA.coordinates[1] }
    : { lng: -0.1276, lat: 51.5074 };
  const pointB: Point = geometryB.type === 'Point'
    ? { lng: geometryB.coordinates[0], lat: geometryB.coordinates[1] }
    : { lng: -0.1156, lat: 51.5194 };

  // Get polygon points for legacy compatibility
  const polygon: Point[] = geometryA.type === 'Polygon'
    ? geometryA.coordinates[0].slice(0, -1).map(c => ({ lng: c[0], lat: c[1] }))
    : [
        { lng: -0.13, lat: 51.51 },
        { lng: -0.12, lat: 51.515 },
        { lng: -0.11, lat: 51.51 },
        { lng: -0.12, lat: 51.505 },
      ];

  // Sync GeoJSON input with current geometry
  useEffect(() => {
    const geom = editingGeometry === 'A' ? geometryA : geometryB;
    setGeojsonInput(JSON.stringify(geom, null, 2));
    setGeojsonError(null);
  }, [geometryA, geometryB, editingGeometry]);

  // Handle GeoJSON input changes
  const handleGeojsonChange = useCallback((value: string) => {
    setGeojsonInput(value);
    try {
      const parsed = JSON.parse(value);
      // Validate it's a valid GeoJSON geometry
      if (!parsed.type || !parsed.coordinates) {
        setGeojsonError('Invalid GeoJSON: missing type or coordinates');
        return;
      }
      if (!['Point', 'Polygon', 'LineString'].includes(parsed.type)) {
        setGeojsonError('Supported types: Point, Polygon, LineString');
        return;
      }
      setGeojsonError(null);
      if (editingGeometry === 'A') {
        setGeometryA(parsed);
      } else {
        setGeometryB(parsed);
      }
      setVerifiedResult(null);
    } catch {
      setGeojsonError('Invalid JSON syntax');
    }
  }, [editingGeometry]);

  // Determine which geometry types are needed for each operation
  const getGeometryTypeForOperation = (op: Operation): 'Point' | 'Polygon' | 'LineString' => {
    switch (op) {
      case 'area':
      case 'contains':
      case 'intersects':
        return 'Polygon';
      case 'length':
        return 'LineString';
      default:
        return 'Point';
    }
  };

  // Auto-switch geometry when operation changes
  const handleOperationChange = (newOp: Operation) => {
    setOperation(newOp);
    setVerifiedResult(null);
    setError(null);

    const neededType = getGeometryTypeForOperation(newOp);

    // Convert geometryA if needed
    if (geometryA.type !== neededType) {
      if (neededType === 'Point') {
        setGeometryA({ type: 'Point', coordinates: [-0.1276, 51.5074] });
      } else if (neededType === 'Polygon') {
        setGeometryA({
          type: 'Polygon',
          coordinates: [[
            [-0.13, 51.51],
            [-0.12, 51.515],
            [-0.11, 51.51],
            [-0.12, 51.505],
            [-0.13, 51.51],
          ]],
        });
      } else if (neededType === 'LineString') {
        setGeometryA({
          type: 'LineString',
          coordinates: [
            [-0.13, 51.51],
            [-0.12, 51.515],
            [-0.11, 51.51],
          ],
        });
      }
    }
  };

  // Turf preview calculation
  const preview = useMemo(() => {
    try {
      switch (operation) {
        case 'distance': {
          if (geometryA.type !== 'Point' || geometryB.type !== 'Point') {
            return { value: null, unit: '', label: 'Need two points' };
          }
          const dist = turf.distance(turf.point(geometryA.coordinates), turf.point(geometryB.coordinates), { units: 'meters' });
          return { value: Math.round(dist * 100) / 100, unit: 'meters', label: 'Distance' };
        }
        case 'within': {
          if (geometryA.type !== 'Point' || geometryB.type !== 'Point') {
            return { value: null, unit: '', label: 'Need two points' };
          }
          const dist = turf.distance(turf.point(geometryA.coordinates), turf.point(geometryB.coordinates), { units: 'meters' });
          const isWithin = dist <= radius;
          return { value: isWithin, unit: 'boolean', label: `Within ${radius}m`, distance: Math.round(dist) };
        }
        case 'contains': {
          if (geometryA.type !== 'Polygon' || geometryB.type !== 'Point') {
            return { value: null, unit: '', label: 'Need polygon + point' };
          }
          const isContained = turf.booleanPointInPolygon(turf.point(geometryB.coordinates), turf.polygon(geometryA.coordinates));
          return { value: isContained, unit: 'boolean', label: 'Point in Polygon' };
        }
        case 'intersects': {
          if (geometryA.type !== 'Polygon') {
            return { value: null, unit: '', label: 'Need polygon' };
          }
          if (geometryB.type === 'Point') {
            const isContained = turf.booleanPointInPolygon(turf.point(geometryB.coordinates), turf.polygon(geometryA.coordinates));
            return { value: isContained, unit: 'boolean', label: 'Intersects' };
          }
          return { value: null, unit: '', label: 'Intersects' };
        }
        case 'area': {
          if (geometryA.type !== 'Polygon') {
            return { value: null, unit: '', label: 'Need polygon' };
          }
          const areaValue = turf.area(turf.polygon(geometryA.coordinates));
          return { value: Math.round(areaValue * 100) / 100, unit: 'square meters', label: 'Area' };
        }
        case 'length': {
          if (geometryA.type !== 'LineString') {
            return { value: null, unit: '', label: 'Need line' };
          }
          const lengthValue = turf.length(turf.lineString(geometryA.coordinates), { units: 'meters' });
          return { value: Math.round(lengthValue * 100) / 100, unit: 'meters', label: 'Length' };
        }
        default:
          return { value: null, unit: '', label: '' };
      }
    } catch (err) {
      return { value: null, unit: '', label: 'Error calculating' };
    }
  }, [geometryA, geometryB, operation, radius]);

  // Generate code snippets
  const codeSnippets = useMemo(() => {
    const geomAStr = JSON.stringify(geometryA);
    const geomBStr = JSON.stringify(geometryB);

    const sdkParams = operation === 'within' ? `\n  ${radius}, // radius in meters` : '';
    const needsGeomB = ['distance', 'within', 'contains', 'intersects'].includes(operation);

    const sdk = `import { createAstralCompute } from '@decentralized-geo/astral-compute';

const astral = createAstralCompute({ chainId: 84532 });

const result = await astral.${operation}(
  ${geomAStr},${needsGeomB ? `\n  ${geomBStr},` : ''}${sdkParams}
  { schema: YOUR_SCHEMA_UID, recipient: userAddress }
);

console.log(result.result); // ${typeof preview.value === 'boolean' ? 'boolean' : 'number'}
console.log(result.attestation); // EAS attestation data`;

    // Build cURL body with correct field names per operation
    let curlBody = '';
    switch (operation) {
      case 'distance':
        curlBody = `"from": ${geomAStr},\n    "to": ${geomBStr}`;
        break;
      case 'area':
      case 'length':
        curlBody = `"geometry": ${geomAStr}`;
        break;
      case 'contains':
        curlBody = `"container": ${geomAStr},\n    "containee": ${geomBStr}`;
        break;
      case 'within':
        curlBody = `"geometry": ${geomAStr},\n    "target": ${geomBStr},\n    "radius": ${radius}`;
        break;
      case 'intersects':
        curlBody = `"geometry1": ${geomAStr},\n    "geometry2": ${geomBStr}`;
        break;
    }

    const curl = `curl -X POST ${API_URL}/compute/v0/${operation} \\
  -H "Content-Type: application/json" \\
  -d '{
    "chainId": 84532,
    "schema": "YOUR_SCHEMA_UID",
    "recipient": "0x...",
    ${curlBody}
  }'`;

    return { sdk, curl };
  }, [operation, geometryA, geometryB, radius, preview.value]);

  // Build request body based on operation
  const buildRequestBody = useCallback(() => {
    const base = {
      chainId: 84532, // Base Sepolia
      schema: '0x0000000000000000000000000000000000000000000000000000000000000000',
      recipient: '0x0000000000000000000000000000000000000000',
    };

    switch (operation) {
      case 'distance':
        return { ...base, from: geometryA, to: geometryB };
      case 'area':
      case 'length':
        return { ...base, geometry: geometryA };
      case 'contains':
        return { ...base, container: geometryA, containee: geometryB };
      case 'within':
        return { ...base, geometry: geometryA, target: geometryB, radius };
      case 'intersects':
        return { ...base, geometry1: geometryA, geometry2: geometryB };
      default:
        return base;
    }
  }, [operation, geometryA, geometryB, radius]);

  // Call Astral API
  const computeVerified = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const body = buildRequestBody();

      const res = await fetch(`${API_URL}/compute/v0/${operation}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({ detail: res.statusText }));
        throw new Error(errData.detail || errData.message || 'API request failed');
      }

      setVerifiedResult(await res.json());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, [operation, buildRequestBody]);

  // Marker drag handlers
  const handleMarkerDrag = useCallback((marker: 'A' | 'B', e: { lngLat: { lng: number; lat: number } }) => {
    const newGeom: GeoJSON.Point = {
      type: 'Point',
      coordinates: [e.lngLat.lng, e.lngLat.lat],
    };
    if (marker === 'A') {
      setGeometryA(newGeom);
    } else {
      setGeometryB(newGeom);
    }
    setVerifiedResult(null);
  }, []);

  // Draw event handlers
  const handleDrawCreate = useCallback((e: { features: GeoJSON.Feature[] }) => {
    if (e.features.length > 0) {
      const feature = e.features[0];
      if (feature.geometry) {
        setGeometryA(feature.geometry as GeoJSONGeometry);
        setVerifiedResult(null);
      }
    }
  }, []);

  const handleDrawUpdate = useCallback((e: { features: GeoJSON.Feature[] }) => {
    if (e.features.length > 0) {
      const feature = e.features[0];
      if (feature.geometry) {
        setGeometryA(feature.geometry as GeoJSONGeometry);
        setVerifiedResult(null);
      }
    }
  }, []);

  const handleDrawDelete = useCallback(() => {
    // Reset to default when deleted
    const neededType = getGeometryTypeForOperation(operation);
    if (neededType === 'Polygon') {
      setGeometryA({
        type: 'Polygon',
        coordinates: [[
          [-0.13, 51.51],
          [-0.12, 51.515],
          [-0.11, 51.51],
          [-0.12, 51.505],
          [-0.13, 51.51],
        ]],
      });
    } else if (neededType === 'LineString') {
      setGeometryA({
        type: 'LineString',
        coordinates: [[-0.13, 51.51], [-0.12, 51.515], [-0.11, 51.51]],
      });
    }
  }, [operation]);

  // Initial features for draw control
  const initialDrawFeatures = useMemo((): GeoJSON.FeatureCollection | undefined => {
    if (!useDrawMode) return undefined;
    if (geometryA.type === 'Polygon' || geometryA.type === 'LineString') {
      return {
        type: 'FeatureCollection',
        features: [{
          type: 'Feature',
          properties: {},
          geometry: geometryA,
        }],
      };
    }
    return undefined;
  }, [useDrawMode, geometryA]);

  // Computed visuals
  const radiusCircle = useMemo(() => {
    if (operation !== 'within' || geometryB.type !== 'Point') return null;
    return turf.circle(geometryB.coordinates, radius / 1000, { units: 'kilometers', steps: 64 });
  }, [operation, geometryB, radius]);

  const distanceLine = useMemo(() => {
    if ((operation !== 'distance' && operation !== 'within') || geometryA.type !== 'Point' || geometryB.type !== 'Point') return null;
    return turf.lineString([geometryA.coordinates, geometryB.coordinates]);
  }, [operation, geometryA, geometryB]);

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  const showDrawControls = ['area', 'length', 'contains', 'intersects'].includes(operation);

  return (
    <div className="playground">
      <header className="header">
        <div className="header-content">
          <h1>Astral Playground</h1>
          <p>Explore geospatial operations with instant Turf.js preview and verifiable Astral attestations</p>
        </div>
      </header>

      <div className="main-content">
        <div className="map-section">
          <Map
            mapboxAccessToken={MAPBOX_TOKEN}
            initialViewState={{
              longitude: -0.12,
              latitude: 51.51,
              zoom: 13,
            }}
            style={{ width: '100%', height: '100%' }}
            mapStyle="mapbox://styles/mapbox/light-v11"
          >
            <NavigationControl position="top-right" />

            {/* Draw control for polygons and lines */}
            {showDrawControls && useDrawMode && (
              <DrawControl
                onCreate={handleDrawCreate}
                onUpdate={handleDrawUpdate}
                onDelete={handleDrawDelete}
                initialFeatures={initialDrawFeatures}
              />
            )}

            {/* Point markers for point-based operations */}
            {['distance', 'within'].includes(operation) && (
              <>
                <Marker
                  longitude={pointA.lng}
                  latitude={pointA.lat}
                  draggable
                  onDragEnd={(e) => handleMarkerDrag('A', e)}
                  color="#6366f1"
                />
                <Marker
                  longitude={pointB.lng}
                  latitude={pointB.lat}
                  draggable
                  onDragEnd={(e) => handleMarkerDrag('B', e)}
                  color="#10b981"
                />
              </>
            )}

            {/* Point B marker for contains/intersects */}
            {['contains', 'intersects'].includes(operation) && geometryB.type === 'Point' && (
              <Marker
                longitude={pointB.lng}
                latitude={pointB.lat}
                draggable
                onDragEnd={(e) => handleMarkerDrag('B', e)}
                color="#6366f1"
              />
            )}

            {/* Radius circle for 'within' */}
            {radiusCircle && (
              <Source type="geojson" data={radiusCircle}>
                <Layer
                  id="radius-fill"
                  type="fill"
                  paint={{ 'fill-color': '#10b981', 'fill-opacity': 0.15 }}
                />
                <Layer
                  id="radius-line"
                  type="line"
                  paint={{ 'line-color': '#10b981', 'line-width': 2 }}
                />
              </Source>
            )}

            {/* Distance line */}
            {distanceLine && (
              <Source type="geojson" data={distanceLine}>
                <Layer
                  id="distance-line"
                  type="line"
                  paint={{
                    'line-color': '#6366f1',
                    'line-width': 2,
                    'line-dasharray': [2, 2],
                  }}
                />
              </Source>
            )}

            {/* Static polygon/line display when not in draw mode */}
            {showDrawControls && !useDrawMode && geometryA.type === 'Polygon' && (
              <Source type="geojson" data={geometryA}>
                <Layer
                  id="polygon-fill"
                  type="fill"
                  paint={{ 'fill-color': '#f59e0b', 'fill-opacity': 0.2 }}
                />
                <Layer
                  id="polygon-line"
                  type="line"
                  paint={{ 'line-color': '#f59e0b', 'line-width': 2 }}
                />
              </Source>
            )}

            {showDrawControls && !useDrawMode && geometryA.type === 'LineString' && (
              <Source type="geojson" data={geometryA}>
                <Layer
                  id="length-line"
                  type="line"
                  paint={{ 'line-color': '#ec4899', 'line-width': 3 }}
                />
              </Source>
            )}
          </Map>

          <div className="map-hint">
            {['distance', 'within'].includes(operation) && 'Drag markers to update calculation'}
            {['contains', 'intersects'].includes(operation) && (useDrawMode ? 'Click vertices to edit polygon, drag point to test' : 'Enable draw mode to edit polygon')}
            {operation === 'area' && (useDrawMode ? 'Click vertices to edit polygon' : 'Enable draw mode to edit')}
            {operation === 'length' && (useDrawMode ? 'Click vertices to edit line' : 'Enable draw mode to edit')}
          </div>
        </div>

        <div className="controls-section">
          <div className="control-group">
            <label>Operation</label>
            <select
              value={operation}
              onChange={(e) => handleOperationChange(e.target.value as Operation)}
            >
              <optgroup label="Measurement">
                <option value="distance">Distance (between points)</option>
                <option value="area">Area (of polygon)</option>
                <option value="length">Length (of line)</option>
              </optgroup>
              <optgroup label="Predicate">
                <option value="within">Within (point in radius)</option>
                <option value="contains">Contains (point in polygon)</option>
                <option value="intersects">Intersects (geometries overlap)</option>
              </optgroup>
            </select>
          </div>

          {showDrawControls && (
            <div className="control-group">
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  checked={useDrawMode}
                  onChange={(e) => setUseDrawMode(e.target.checked)}
                />
                Enable map editing
              </label>
            </div>
          )}

          {operation === 'within' && (
            <div className="control-group">
              <label>Radius: {radius}m</label>
              <input
                type="range"
                min={100}
                max={2000}
                step={50}
                value={radius}
                onChange={(e) => {
                  setRadius(Number(e.target.value));
                  setVerifiedResult(null);
                }}
              />
            </div>
          )}

          <div className="results-card">
            <div className="result-row">
              <span className="result-label">Preview (Turf.js)</span>
              <span className={`result-value ${typeof preview.value === 'boolean' ? (preview.value ? 'true' : 'false') : ''}`}>
                {preview.value === null
                  ? '—'
                  : typeof preview.value === 'boolean'
                    ? preview.value ? 'TRUE' : 'FALSE'
                    : `${preview.value.toLocaleString()} ${preview.unit}`}
              </span>
            </div>
            {operation === 'within' && preview.distance !== undefined && (
              <div className="result-detail">Actual distance: {preview.distance}m</div>
            )}
          </div>

          <button className="verify-button" onClick={computeVerified} disabled={loading}>
            {loading ? 'Computing...' : 'Get Verified Result'}
          </button>

          {error && <div className="error-message">{error}</div>}

          {verifiedResult && (
            <div className="verified-result">
              <div className="result-row">
                <span className="result-label">Verified (Astral)</span>
                <span className={`result-value ${typeof verifiedResult.result === 'boolean' ? (verifiedResult.result ? 'true' : 'false') : ''}`}>
                  {typeof verifiedResult.result === 'boolean'
                    ? verifiedResult.result ? 'TRUE' : 'FALSE'
                    : `${verifiedResult.result?.toLocaleString()} ${verifiedResult.units}`}
                </span>
              </div>
              <details className="attestation-details">
                <summary>View Attestation Data</summary>
                <pre>{JSON.stringify(verifiedResult.attestation, null, 2)}</pre>
              </details>
            </div>
          )}
        </div>
      </div>

      <div className="code-section">
        <div className="code-header">
          <h3>Code & GeoJSON</h3>
          <div className="tab-buttons">
            <button className={activeTab === 'geojson' ? 'active' : ''} onClick={() => setActiveTab('geojson')}>
              GeoJSON
            </button>
            <button className={activeTab === 'sdk' ? 'active' : ''} onClick={() => setActiveTab('sdk')}>
              SDK
            </button>
            <button className={activeTab === 'curl' ? 'active' : ''} onClick={() => setActiveTab('curl')}>
              cURL
            </button>
          </div>
        </div>

        {activeTab === 'geojson' ? (
          <div className="geojson-editor">
            <div className="geojson-controls">
              <label>Editing:</label>
              <select value={editingGeometry} onChange={(e) => setEditingGeometry(e.target.value as 'A' | 'B')}>
                <option value="A">Geometry A ({geometryA.type})</option>
                {['distance', 'within', 'contains', 'intersects'].includes(operation) && (
                  <option value="B">Geometry B ({geometryB.type})</option>
                )}
              </select>
            </div>
            <textarea
              className={`geojson-input ${geojsonError ? 'error' : ''}`}
              value={geojsonInput}
              onChange={(e) => handleGeojsonChange(e.target.value)}
              spellCheck={false}
            />
            {geojsonError && <div className="geojson-error">{geojsonError}</div>}
            <div className="geojson-hint">
              Paste or edit GeoJSON. Supported: Point, Polygon, LineString
            </div>
          </div>
        ) : (
          <div className="code-content">
            <pre>{activeTab === 'sdk' ? codeSnippets.sdk : codeSnippets.curl}</pre>
            <button
              className="copy-button"
              onClick={() => copyToClipboard(activeTab === 'sdk' ? codeSnippets.sdk : codeSnippets.curl)}
            >
              Copy
            </button>
          </div>
        )}
      </div>

      <footer className="footer">
        <p>
          <a href="https://docs.astral.global" target="_blank" rel="noopener noreferrer">
            Documentation
          </a>
          {' · '}
          <a href="https://github.com/AstralProtocol/astral-location-services" target="_blank" rel="noopener noreferrer">
            GitHub
          </a>
        </p>
      </footer>
    </div>
  );
}

export default App;
