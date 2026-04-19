/** Minimal CSV for first-time users — one site box + one obstacle. */
export const HVS_CSV_SAMPLE_SIMPLE = `X,Y,Z,Name,Type,Height
# Site corners (no height = ground survey points)
0,0,12,Northwest corner,,
200,0,12,Northeast corner,,
200,150,12,Southeast corner,,
0,150,12,Southwest corner,,
# Obstacle — height in metres
80,60,12,Radio mast,tower,18
`;

/** Full template with comments (advanced). */
export const HVS_CSV_SAMPLE_FULL = `X,Y,Z,Name,Type,Height,Width,Length
150.0,200.0,48.0,Water Tank,building,8,8,8
320.0,180.0,47.5,Antenna Mast,antenna,22,2,2
80.0,290.0,48.2,AC Plant,building,4,12,6
400.0,150.0,47.0,Light Pole,pole,6,1,1
250.0,350.0,46.5,Tree Line,tree,10,5,20
0.0,0.0,48.5,NW Corner,,,
500.0,0.0,47.0,NE Corner,,,
500.0,400.0,46.0,SE Corner,,,
0.0,400.0,47.5,SW Corner,,,
250.0,200.0,47.8,Center,,,
`;

export const HVS_GEOJSON_SAMPLE_SIMPLE = JSON.stringify(
  {
    type: "FeatureCollection",
    features: [
      {
        type: "Feature",
        properties: { name: "My site outline" },
        geometry: {
          type: "Polygon",
          coordinates: [
            [
              [0, 0, 10],
              [250, 0, 10],
              [250, 200, 10],
              [0, 200, 10],
              [0, 0, 10],
            ],
          ],
        },
      },
      {
        type: "Feature",
        properties: { name: "Small building", height: 15 },
        geometry: {
          type: "Polygon",
          coordinates: [[[50, 50, 10], [70, 50, 10], [70, 65, 10], [50, 65, 10], [50, 50, 10]]],
        },
      },
    ],
  },
  null,
  2
);

export function downloadTextFile(filename, content, mime) {
  const blob = new Blob([content], { type: mime || "text/plain" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 2500);
}
