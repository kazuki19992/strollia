import { LocationPoint } from '../../../types/gps';
import { buildGpx } from '../gpxExporter';

const points: LocationPoint[] = [
  {
    id: 1,
    recordedAt: '2026-05-04T00:00:00.000Z',
    localDate: '2026-05-04',
    latitude: 35.681236,
    longitude: 139.767125,
    altitude: 12.5,
    speed: null,
    heading: null,
    accuracy: 8,
    altitudeAccuracy: null,
  },
  {
    id: 2,
    recordedAt: '2026-05-04T00:01:00.000Z',
    localDate: '2026-05-04',
    latitude: 35.682,
    longitude: 139.768,
    altitude: null,
    speed: null,
    heading: null,
    accuracy: null,
    altitudeAccuracy: null,
  },
];

describe('buildGpx', () => {
  it('serializes location points into GPX track points', () => {
    const gpx = buildGpx(points, 'Strollia 2026-05-04');

    expect(gpx).toContain('<?xml version="1.0" encoding="UTF-8"?>');
    expect(gpx).toContain('<gpx version="1.1" creator="Strollia"');
    expect(gpx).toContain('<trkpt lat="35.681236" lon="139.767125">');
    expect(gpx).toContain('<ele>12.5</ele>');
    expect(gpx).toContain('<time>2026-05-04T00:01:00.000Z</time>');
  });

  it('escapes XML-sensitive track names', () => {
    const gpx = buildGpx(points, 'A&B <walk>');

    expect(gpx).toContain('A&amp;B &lt;walk&gt;');
  });
});
