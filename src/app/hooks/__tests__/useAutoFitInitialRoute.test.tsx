import { useAutoFitInitialRoute } from '../useAutoFitInitialRoute';

const ReactTestRenderer = require('react-test-renderer');
const { act } = ReactTestRenderer;

type HookProbeProps = {
  mapRef: Parameters<typeof useAutoFitInitialRoute>[0];
};

/** hookの地図フィット副作用を実行するための最小コンポーネント。 */
function HookProbe({ mapRef }: HookProbeProps) {
  useAutoFitInitialRoute(
    mapRef,
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
    const fitToCoordinates = jest.fn();
    const mapRef = {
      current: {
        fitToCoordinates,
      },
    } as unknown as Parameters<typeof useAutoFitInitialRoute>[0];

    act(() => {
      ReactTestRenderer.create(<HookProbe mapRef={mapRef} />);
    });

    expect(fitToCoordinates).toHaveBeenCalledTimes(1);
  });
});
