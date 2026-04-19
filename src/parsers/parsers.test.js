import { describe, it, expect } from "vitest";
import { parseGeoJSON } from "./geojson.js";
import { parseCSV } from "./csv.js";
import { parseWKT } from "./wkt.js";
import { parseKML } from "./kml.js";
import { parseDXF } from "./dxf.js";
import { parseAnyFile } from "./universal.js";

describe("parseGeoJSON", () => {
  it("parses Feature polygon", () => {
    const gj = JSON.stringify({
      type: "Feature",
      properties: { id: 1 },
      geometry: { type: "Polygon", coordinates: [[[0, 0], [10, 0], [10, 10], [0, 10], [0, 0]]] },
    });
    const p = parseGeoJSON(gj);
    expect(p.polys.length).toBe(1);
    expect(p.polys[0].vertices.length).toBe(5);
  });
});

describe("parseCSV", () => {
  it("parses x,y header", () => {
    const txt = "x,y,z,name\n0,0,1,A\n10,20,2,B\n";
    const p = parseCSV(txt);
    expect(p.count).toBe(2);
    expect(p.points[1].x).toBe(10);
  });

  it("returns empty when missing coordinates", () => {
    expect(parseCSV("a,b\n1,2").count).toBe(0);
  });
});

describe("parseWKT", () => {
  it("extracts POLYGON rings", () => {
    const p = parseWKT("POLYGON ((0 0, 10 0, 10 10, 0 10, 0 0))");
    expect(p.polys.length).toBe(1);
    expect(p.polys[0].vertices.length).toBe(5);
  });
});

describe("parseKML", () => {
  it("reads Placemark polygon", () => {
    const kml = `<?xml version="1.0"?><kml xmlns="http://www.opengis.net/kml/2.2"><Document><Placemark><name>T</name><Polygon><outerBoundaryIs><LinearRing><coordinates>0,0,0 1,0,0 1,1,0 0,1,0 0,0,0</coordinates></LinearRing></outerBoundaryIs></Polygon></Placemark></Document></kml>`;
    const p = parseKML(kml);
    expect(p.polys.length).toBe(1);
    expect(p.polys[0].vertices.length).toBeGreaterThanOrEqual(3);
  });
});

const MIN_DXF = `0
SECTION
2
ENTITIES
0
LWPOLYLINE
8
L1
70
1
10
0
20
0
10
100
20
0
10
100
20
100
10
0
20
100
0
ENDSEC
0
EOF
`;

describe("parseDXF", () => {
  it("extracts closed polyline", () => {
    const p = parseDXF(MIN_DXF);
    expect(p.closed.length).toBeGreaterThanOrEqual(1);
    expect(p.closed[0].verts.length).toBeGreaterThanOrEqual(4);
  });
});

describe("parseAnyFile", () => {
  it("dispatches by extension", () => {
    const r = parseAnyFile(MIN_DXF, "test.dxf");
    expect(r.format).toMatch(/DXF/i);
    expect(r.count).toBeGreaterThan(0);
  });
});
