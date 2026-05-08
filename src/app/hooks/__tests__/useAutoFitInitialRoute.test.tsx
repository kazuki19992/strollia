import { useAutoFitInitialRoute } from '../useAutoFitInitialRoute';

const ReactTestRenderer = require('react-test-renderer');
const { act } = ReactTestRenderer;

type HookProbeProps = {
  mapRef: { current: { fitToCoordinates: jest.Mock } | null };
};

/** hookの地図フィット副作用を実行するための最小コンポーネント。 */
function HookProbe({ mapRef }: HookProbeProps) {
  useAutoFitInitialRoute(
    mapRef as never,
    'map',
    [
      { latitude: 35, longitude: 139 },
      { latitude: 36, longitude: 140 },
    ],
    null,
  );

  return null;
}

describe('初期ルートフィットhook useAutoFitInitialRoute', () => {
  test('地図画面で現在地未取得かつルートが複数点ある場合は地図をフィットする', () => {
    const mapRef = { current: { fitToCoordinates: jest.fn() } };

    act(() => {
      ReactTestRenderer.create(<HookProbe mapRef={mapRef} />);
    });

    expect(mapRef.current.fitToCoordinates).toHaveBeenCalledTimes(1);
  });
});
