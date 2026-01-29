import { useState, useMemo, useCallback } from 'react';
import Map, { Marker, Source, Layer, NavigationControl } from 'react-map-gl';
import * as turf from '@turf/turf';
import 'mapbox-gl/dist/mapbox-gl.css';
import './App.css';

type Operation = 'distance' | 'within' | 'contains' | 'intersects' | 'area' | 'length';
type GeometryMode = 'points' | 'polygon' | 'line';

// Demo values - in production these would come from config
const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_TOKEN || 'pk.eyJ1IjoiYXN0cmFsLXByb3RvY29sIiwiYSI6ImNtNnF0Z3h4YzAwZmMya3EwcHNkdWZ4Z2gifQ.example';
const API_URL = import.meta.env.VITE_API_URL || 'https://api.astral.global';

interface Point {
  lng: number;
  lat: number;
}

function App() {
  // Map state
  const [pointA, setPointA] = useState<Point>({ lng: -0.1276, lat: 51.5074 }); // London
  const [pointB, setPointB] = useState<Point>({ lng: -0.1156, lat: 51.5194 });
  const [polygon, setPolygon] = useState<Point[]>([
    { lng: -0.13, lat: 51.51 },
    { lng: -0.12, lat: 51.515 },
    { lng: -0.11, lat: 51.51 },
    { lng: -0.12, lat: 51.505 },
  ]);

  // Operation state
  const [operation, setOperation] = useState<Operation>('distance');
  const [radius, setRadius] = useState(500);
  const [geometryMode, setGeometryMode] = useState<GeometryMode>('points');

  // Results state
  const [verifiedResult, setVerifiedResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'sdk' | 'curl'>('sdk');

  // Determine which geometry mode is needed for each operation
  const getGeometryModeForOperation = (op: Operation): GeometryMode => {
    switch (op) {
      case 'area':
        return 'polygon';
      case 'length':
        return 'line';
      default:
        return 'points';
    }
  };

  // Auto-switch geometry mode when operation changes
  const handleOperationChange = (newOp: Operation) => {
    setOperation(newOp);
    setGeometryMode(getGeometryModeForOperation(newOp));
    setVerifiedResult(null);
    setError(null);
  };

  // Turf preview calculation (instant, unverified)
  const preview = useMemo(() => {
    try {
      const a = turf.point([pointA.lng, pointA.lat]);
      const b = turf.point([pointB.lng, pointB.lat]);
      const poly = turf.polygon([[...polygon.map(p => [p.lng, p.lat]), [polygon[0].lng, polygon[0].lat]]]);
      const line = turf.lineString(polygon.map(p => [p.lng, p.lat]));

      switch (operation) {
        case 'distance': {
          const dist = turf.distance(a, b, { units: 'meters' });
          return { value: Math.round(dist * 100) / 100, unit: 'meters', label: 'Distance' };
        }
        case 'within': {
          const dist = turf.distance(a, b, { units: 'meters' });
          const isWithin = dist <= radius;
          return { value: isWithin, unit: 'boolean', label: `Within ${radius}m`, distance: Math.round(dist) };
        }
        case 'contains': {
          const isContained = turf.booleanPointInPolygon(a, poly);
          return { value: isContained, unit: 'boolean', label: 'Point in Polygon' };
        }
        case 'intersects': {
          // For demo, check if point A is inside the polygon
          const isContained = turf.booleanPointInPolygon(a, poly);
          return { value: isContained, unit: 'boolean', label: 'Intersects' };
        }
        case 'area': {
          const areaValue = turf.area(poly);
          return { value: Math.round(areaValue * 100) / 100, unit: 'square meters', label: 'Area' };
        }
        case 'length': {
          const lengthValue = turf.length(line, { units: 'meters' });
          return { value: Math.round(lengthValue * 100) / 100, unit: 'meters', label: 'Length' };
        }
        default:
          return { value: null, unit: '', label: '' };
      }
    } catch {
      return { value: null, unit: '', label: 'Error calculating' };
    }
  }, [pointA, pointB, polygon, operation, radius]);

  // Generate code snippets
  const codeSnippets = useMemo(() => {
    const geometryA = operation === 'area' || operation === 'contains' || operation === 'intersects'
      ? `{ type: 'Polygon', coordinates: [[${polygon.map(p => `[${p.lng}, ${p.lat}]`).join(', ')}, [${polygon[0].lng}, ${polygon[0].lat}]]] }`
      : operation === 'length'
        ? `{ type: 'LineString', coordinates: [${polygon.map(p => `[${p.lng}, ${p.lat}]`).join(', ')}] }`
        : `{ type: 'Point', coordinates: [${pointA.lng}, ${pointA.lat}] }`;

    const geometryB = `{ type: 'Point', coordinates: [${pointB.lng}, ${pointB.lat}] }`;

    const sdkParams = operation === 'within'
      ? `\n  ${radius}, // radius in meters`
      : '';

    const sdk = `import { createAstralCompute } from '@decentralized-geo/astral-compute';

const astral = createAstralCompute({ chainId: 84532 });

const result = await astral.${operation}(
  ${geometryA},${['distance', 'within', 'contains', 'intersects'].includes(operation) ? `\n  ${geometryB},` : ''}${sdkParams}
  { schema: YOUR_SCHEMA_UID, recipient: userAddress }
);

console.log(result.result); // ${typeof preview.value === 'boolean' ? 'boolean' : 'number'}
console.log(result.attestation); // EAS attestation data`;

    const curlGeomA = operation === 'area' || operation === 'contains' || operation === 'intersects'
      ? `{ "type": "Polygon", "coordinates": [[[${polygon.map(p => `${p.lng}, ${p.lat}`).join('], [')}], [${polygon[0].lng}, ${polygon[0].lat}]]] }`
      : operation === 'length'
        ? `{ "type": "LineString", "coordinates": [[${polygon.map(p => `${p.lng}, ${p.lat}`).join('], [')}]] }`
        : `{ "type": "Point", "coordinates": [${pointA.lng}, ${pointA.lat}] }`;

    const curlGeomB = `{ "type": "Point", "coordinates": [${pointB.lng}, ${pointB.lat}] }`;

    const curlBody: Record<string, any> = {
      geometryA: 'GEOM_A_PLACEHOLDER',
    };

    if (['distance', 'within', 'contains', 'intersects'].includes(operation)) {
      curlBody.geometryB = 'GEOM_B_PLACEHOLDER';
    }
    if (operation === 'within') {
      curlBody.radius = radius;
    }
    curlBody.options = { schema: 'YOUR_SCHEMA_UID', recipient: '0x...' };

    const curl = `curl -X POST ${API_URL}/compute/${operation} \\
  -H "Content-Type: application/json" \\
  -d '{
    "geometryA": ${curlGeomA},${['distance', 'within', 'contains', 'intersects'].includes(operation) ? `\n    "geometryB": ${curlGeomB},` : ''}${operation === 'within' ? `\n    "radius": ${radius},` : ''}
    "options": { "schema": "YOUR_SCHEMA_UID", "recipient": "0x..." }
  }'`;

    return { sdk, curl };
  }, [operation, pointA, pointB, polygon, radius, preview.value]);

  // Call Astral API
  const computeVerified = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const geometryA = operation === 'area' || operation === 'contains' || operation === 'intersects'
        ? { type: 'Polygon', coordinates: [[...polygon.map(p => [p.lng, p.lat]), [polygon[0].lng, polygon[0].lat]]] }
        : operation === 'length'
          ? { type: 'LineString', coordinates: polygon.map(p => [p.lng, p.lat]) }
          : { type: 'Point', coordinates: [pointA.lng, pointA.lat] };

      const body: Record<string, any> = { geometryA };

      if (['distance', 'within', 'contains', 'intersects'].includes(operation)) {
        body.geometryB = { type: 'Point', coordinates: [pointB.lng, pointB.lat] };
      }
      if (operation === 'within') {
        body.radius = radius;
      }
      body.options = {
        schema: '0x0000000000000000000000000000000000000000000000000000000000000000',
        recipient: '0x0000000000000000000000000000000000000000'
      };

      const res = await fetch(`${API_URL}/compute/${operation}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
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
  }, [operation, pointA, pointB, polygon, radius]);

  // Marker drag handlers
  const handleMarkerDrag = useCallback((marker: 'A' | 'B', e: { lngLat: { lng: number; lat: number } }) => {
    const newPoint = { lng: e.lngLat.lng, lat: e.lngLat.lat };
    if (marker === 'A') {
      setPointA(newPoint);
    } else {
      setPointB(newPoint);
    }
    setVerifiedResult(null);
  }, []);

  // Radius circle for 'within' operation
  const radiusCircle = useMemo(() => {
    if (operation !== 'within') return null;
    return turf.circle([pointB.lng, pointB.lat], radius / 1000, { units: 'kilometers', steps: 64 });
  }, [operation, pointB, radius]);

  // Distance line
  const distanceLine = useMemo(() => {
    if (operation !== 'distance' && operation !== 'within') return null;
    return turf.lineString([[pointA.lng, pointA.lat], [pointB.lng, pointB.lat]]);
  }, [operation, pointA, pointB]);

  // Polygon for area/contains/intersects
  const polygonGeoJSON = useMemo(() => {
    if (!['area', 'contains', 'intersects'].includes(operation)) return null;
    return turf.polygon([[...polygon.map(p => [p.lng, p.lat]), [polygon[0].lng, polygon[0].lat]]]);
  }, [operation, polygon]);

  // Line for length
  const lineGeoJSON = useMemo(() => {
    if (operation !== 'length') return null;
    return turf.lineString(polygon.map(p => [p.lng, p.lat]));
  }, [operation, polygon]);

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
  };

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
              zoom: 13
            }}
            style={{ width: '100%', height: '100%' }}
            mapStyle="mapbox://styles/mapbox/light-v11"
          >
            <NavigationControl position="top-right" />

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

            {/* Point A marker for contains/intersects */}
            {['contains', 'intersects'].includes(operation) && (
              <Marker
                longitude={pointA.lng}
                latitude={pointA.lat}
                draggable
                onDragEnd={(e) => handleMarkerDrag('A', e)}
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
                    'line-dasharray': [2, 2]
                  }}
                />
              </Source>
            )}

            {/* Polygon for area/contains/intersects */}
            {polygonGeoJSON && (
              <Source type="geojson" data={polygonGeoJSON}>
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

            {/* Line for length */}
            {lineGeoJSON && (
              <Source type="geojson" data={lineGeoJSON}>
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
            {['contains', 'intersects'].includes(operation) && 'Drag the purple marker to test containment'}
            {operation === 'area' && 'Polygon area is calculated'}
            {operation === 'length' && 'Line length is calculated'}
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
                    ? (preview.value ? 'TRUE' : 'FALSE')
                    : `${preview.value.toLocaleString()} ${preview.unit}`
                }
              </span>
            </div>
            {operation === 'within' && preview.distance !== undefined && (
              <div className="result-detail">
                Actual distance: {preview.distance}m
              </div>
            )}
          </div>

          <button
            className="verify-button"
            onClick={computeVerified}
            disabled={loading}
          >
            {loading ? 'Computing...' : 'Get Verified Result'}
          </button>

          {error && (
            <div className="error-message">
              {error}
            </div>
          )}

          {verifiedResult && (
            <div className="verified-result">
              <div className="result-row">
                <span className="result-label">Verified (Astral)</span>
                <span className={`result-value ${typeof verifiedResult.result === 'boolean' ? (verifiedResult.result ? 'true' : 'false') : ''}`}>
                  {typeof verifiedResult.result === 'boolean'
                    ? (verifiedResult.result ? 'TRUE' : 'FALSE')
                    : `${verifiedResult.result?.toLocaleString()} ${verifiedResult.units}`
                  }
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
          <h3>Generated Code</h3>
          <div className="tab-buttons">
            <button
              className={activeTab === 'sdk' ? 'active' : ''}
              onClick={() => setActiveTab('sdk')}
            >
              SDK
            </button>
            <button
              className={activeTab === 'curl' ? 'active' : ''}
              onClick={() => setActiveTab('curl')}
            >
              cURL
            </button>
          </div>
        </div>
        <div className="code-content">
          <pre>{activeTab === 'sdk' ? codeSnippets.sdk : codeSnippets.curl}</pre>
          <button
            className="copy-button"
            onClick={() => copyToClipboard(activeTab === 'sdk' ? codeSnippets.sdk : codeSnippets.curl)}
          >
            Copy
          </button>
        </div>
      </div>

      <footer className="footer">
        <p>
          <a href="https://docs.astral.global" target="_blank" rel="noopener noreferrer">Documentation</a>
          {' · '}
          <a href="https://github.com/AstralProtocol/astral-location-services" target="_blank" rel="noopener noreferrer">GitHub</a>
        </p>
      </footer>
    </div>
  );
}

export default App;
