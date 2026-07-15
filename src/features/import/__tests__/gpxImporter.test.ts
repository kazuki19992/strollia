import { parseGpxToLocationPoints } from '@/features/import/gpxImporter';

describe('GPXインポート gpxImporter', () => {
  it('trkptからGPSポイントを作成する', () => {
    const points = parseGpxToLocationPoints(`<?xml version="1.0"?>
      <gpx version="1.1" xmlns="http://www.topografix.com/GPX/1/1">
        <trk><trkseg>
          <trkpt lat="35.681236" lon="139.767125">
            <ele>12.5</ele>
            <time>2026-05-01T01:02:03.000Z</time>
          </trkpt>
        </trkseg></trk>
      </gpx>`);

    expect(points).toEqual([
      {
        recordedAt: '2026-05-01T01:02:03.000Z',
        localDate: '2026-05-01',
        latitude: 35.681236,
        longitude: 139.767125,
        altitude: 12.5,
        speed: null,
        heading: null,
        accuracy: null,
        altitudeAccuracy: null,
      },
    ]);
  });

  it('eleがないtrkptは高度nullとして扱う', () => {
    const points = parseGpxToLocationPoints(`<gpx><trk><trkseg>
      <trkpt lat="35" lon="139"><time>2026-05-01T00:00:00.000Z</time></trkpt>
    </trkseg></trk></gpx>`);

    expect(points[0].altitude).toBeNull();
  });

  it('timeがないtrkptと緯度経度が不正なtrkptはスキップする', () => {
    const points = parseGpxToLocationPoints(`<gpx><trk><trkseg>
      <trkpt lat="35" lon="139"></trkpt>
      <trkpt lat="abc" lon="139"><time>2026-05-01T00:00:00.000Z</time></trkpt>
      <trkpt lat="35.1" lon="139.1"><time>2026-05-01T00:01:00.000Z</time></trkpt>
    </trkseg></trk></gpx>`);

    expect(points).toHaveLength(1);
    expect(points[0].latitude).toBe(35.1);
  });

  it('緯度経度の範囲外ケースをスキップする', () => {
    const points = parseGpxToLocationPoints(`<gpx><trk><trkseg>
      <trkpt lat="91" lon="139"><time>2026-05-01T00:00:00.000Z</time></trkpt>
      <trkpt lat="35" lon="181"><time>2026-05-01T00:01:00.000Z</time></trkpt>
      <trkpt lat="-90" lon="-180"><time>2026-05-01T00:02:00.000Z</time></trkpt>
    </trkseg></trk></gpx>`);

    expect(points).toHaveLength(1);
    expect(points[0].latitude).toBe(-90);
    expect(points[0].longitude).toBe(-180);
  });

  it('名前空間prefix付きGPXもtrkptとして扱う', () => {
    const points = parseGpxToLocationPoints(`<gpx:gpx xmlns:gpx="http://www.topografix.com/GPX/1/1">
      <gpx:trk><gpx:trkseg>
        <gpx:trkpt lat="35" lon="139"><gpx:time>2026-05-01T00:00:00.000Z</gpx:time></gpx:trkpt>
      </gpx:trkseg></gpx:trk>
    </gpx:gpx>`);

    expect(points).toHaveLength(1);
  });
});
