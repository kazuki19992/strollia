import { fireEvent, render, screen } from '@testing-library/react-native';

import type { MapPhoto } from '@/features/photos/photoLibrary';
import { lightTheme } from '@/theme/theme';
import { PHOTO_UNAVAILABLE_INLINE_MESSAGE } from '@/ui/appText';
import { createStyles } from '@/ui/appStyles';
import { PhotoPreviewModals, PhotoPreviewModalsProps } from '@/ui/components/PhotoPreviewModals';

jest.mock('@expo/vector-icons', () => ({
  MaterialCommunityIcons: require('react-native').Text, // eslint-disable-line @typescript-eslint/no-require-imports
}));

/**
 * テスト用の地図写真を作る。
 *
 * @param id - アセットID。
 * @param uri - 表示用URI。サムネイルを取得できなかった写真を再現する場合はnull。
 * @returns 地図表示用写真。
 */
function createPhoto(id: string, uri: string | null): MapPhoto {
  return { id, uri, storedUri: `ph://${id}`, latitude: 35, longitude: 139, creationTime: 0, width: 100, height: 80 };
}

const styles = createStyles(lightTheme);

/** RNTL v14 の描画ツリー要素(Test Renderer の TestInstance)。 */
type TestInstance = ReturnType<typeof screen.container.queryAll>[number];

/**
 * 既定のpropsに差分を当てて描画する。
 *
 * @param overrides - 上書きしたいprops。
 * @returns render の戻り値。
 */
async function renderModals(overrides: Partial<PhotoPreviewModalsProps>) {
  const props: PhotoPreviewModalsProps = {
    selectedPhotoCluster: null,
    selectedPhotoClusterPages: [],
    selectedPhoto: null,
    selectedPhotoPreviewUri: null,
    isSelectedPhotoPreviewLoading: false,
    isSelectedPhotoUnavailable: false,
    styles,
    onSelectPhotoCluster: jest.fn(),
    onSelectPhoto: jest.fn(),
    ...overrides,
  };

  return await render(<PhotoPreviewModals {...props} />);
}

/**
 * ある要素の祖先コンポーネント名を根まで列挙する。
 *
 * 横スワイプのもたつきは「ScrollViewの祖先に押下判定を持つPressableが積まれている」ことで起きるため、
 * 祖先の顔ぶれ自体が検証対象になる。RNTL v14 の要素ツリーはホスト要素だけで Pressable などの
 * コンポジットを含まないため、Test Renderer の unstable_fiber から React Fiber の親リンクを辿る。
 *
 * @param element - 起点の要素。
 * @returns 祖先のコンポーネント名(ホスト要素はタグ名)。
 */
function getAncestorNames(element: TestInstance): string[] {
  const names: string[] = [];
  let current = element.unstable_fiber?.return ?? null;

  while (current) {
    const name = getFiberTypeName(current.type);
    if (name !== null) {
      names.push(name);
    }

    current = current.return;
  }

  return names;
}

/**
 * Fiber の type から表示名を取り出す。memo / forwardRef の包みは内側の名前を優先して辿る。
 *
 * @param type - Fiber の type。
 * @returns 表示名。名前を持たない内部ノード(Fragment等)は null。
 */
function getFiberTypeName(type: unknown): string | null {
  if (typeof type === 'string') {
    return type;
  }
  if (typeof type === 'function') {
    const named = type as { displayName?: string; name?: string };
    return named.displayName ?? named.name ?? 'anonymous';
  }
  if (typeof type === 'object' && type !== null) {
    const wrapper = type as { displayName?: string; type?: unknown; render?: unknown };
    if (wrapper.displayName) {
      return wrapper.displayName;
    }
    return getFiberTypeName(wrapper.type ?? wrapper.render ?? null);
  }

  return null;
}

/** 描画済みツリーから指定ホスト型の要素を全件返す。 */
const queryAllHostByType = (type: string) => screen.container.queryAll((node) => node.type === type);

/** 描画済みツリーから指定ホスト型の要素を1件だけ返す。0件・複数件ならテストを失敗させる。 */
const getHostByType = (type: string) => {
  const nodes = queryAllHostByType(type);
  expect(nodes).toHaveLength(1);
  return nodes[0];
};

describe('写真プレビュー PhotoPreviewModals', () => {
  test('クラスタ一覧で画像が無い写真はプレースホルダにし、押せば拡大表示へ進める', async () => {
    const photoWithoutImage = createPhoto('asset-1', null);
    const onSelectPhoto = jest.fn();
    await renderModals({
      selectedPhotoCluster: { id: 'cluster-1', latitude: 35, longitude: 139, photos: [photoWithoutImage] },
      selectedPhotoClusterPages: [[photoWithoutImage]],
      onSelectPhoto,
    });

    expect(queryAllHostByType('Image')).toHaveLength(0);

    await fireEvent.press(screen.getByLabelText('画像を表示できない写真を開く'));

    expect(onSelectPhoto).toHaveBeenCalledWith(photoWithoutImage);
  });

  test('クラスタ一覧で画像がある写真はその画像を表示する', async () => {
    const photo = createPhoto('asset-1', 'file:///tmp/asset-1.jpg');
    await renderModals({
      selectedPhotoCluster: { id: 'cluster-1', latitude: 35, longitude: 139, photos: [photo] },
      selectedPhotoClusterPages: [[photo]],
    });

    // Imageのsourceは利用者に見えない実装詳細のため、ここだけホスト型検索でURIを確認する
    expect(getHostByType('Image').props.source).toEqual({ uri: 'file:///tmp/asset-1.jpg' });
  });

  test('グリッドの余白でもスワイプできるよう、ScrollViewの祖先がタッチを掴まない', async () => {
    const photo = createPhoto('asset-1', 'file:///tmp/asset-1.jpg');
    await renderModals({
      selectedPhotoCluster: { id: 'cluster-1', latitude: 35, longitude: 139, photos: [photo] },
      selectedPhotoClusterPages: [[photo], [photo]],
    });

    const scrollView = getHostByType('RCTScrollView');

    // 祖先に Pressable があると、押下判定が解決するまでパンが奪われる
    expect(getAncestorNames(scrollView).filter((name) => name === 'Pressable')).toHaveLength(0);

    // onStartShouldSetResponder で掴む祖先も同じ問題を起こす。写真サムネイルのように
    // 自前でレスポンダを取る子の上でしかパンが成立せず、グリッドの余白で反応しなくなる
    let node = scrollView.parent;
    while (node !== null) {
      expect(node.props.onStartShouldSetResponder).toBeUndefined();
      node = node.parent;
    }
  });

  test('吹き出しの中をタップしても閉じない（背景は吹き出しの後ろに敷いた兄弟）', async () => {
    const photo = createPhoto('asset-1', 'file:///tmp/asset-1.jpg');
    const onSelectPhotoCluster = jest.fn();
    await renderModals({
      selectedPhotoCluster: { id: 'cluster-1', latitude: 35, longitude: 139, photos: [photo] },
      selectedPhotoClusterPages: [[photo]],
      onSelectPhotoCluster,
    });

    // 吹き出しは押下可能要素ではないためラベルで特定できない。スタイルで引き当てる
    const callout = screen.container.queryAll((node) => node.props.style === styles.photoClusterCallout)[0];

    // 閉じる当たり判定は吹き出しの祖先ではなく兄弟なので、内側のタップは背景へ届かない
    expect(getAncestorNames(callout).filter((name) => name === 'Pressable')).toHaveLength(0);
    expect(onSelectPhotoCluster).not.toHaveBeenCalled();
  });

  test('ページ送りが指切れよく止まるよう、横スクロールの減速と方向ロックを設定する', async () => {
    const photo = createPhoto('asset-1', 'file:///tmp/asset-1.jpg');
    await renderModals({
      selectedPhotoCluster: { id: 'cluster-1', latitude: 35, longitude: 139, photos: [photo] },
      selectedPhotoClusterPages: [[photo], [photo]],
    });

    const scrollView = getHostByType('RCTScrollView');

    expect(scrollView.props.decelerationRate).toBe('fast');
    expect(scrollView.props.directionalLockEnabled).toBe(true);
  });

  test('オーバーレイの外側をタップすれば従来どおり閉じる', async () => {
    const photo = createPhoto('asset-1', 'file:///tmp/asset-1.jpg');
    const onSelectPhotoCluster = jest.fn();
    await renderModals({
      selectedPhotoCluster: { id: 'cluster-1', latitude: 35, longitude: 139, photos: [photo] },
      selectedPhotoClusterPages: [[photo]],
      onSelectPhotoCluster,
    });

    await fireEvent.press(screen.getByLabelText('写真一覧を閉じる'));

    expect(onSelectPhotoCluster).toHaveBeenCalledWith(null);
  });

  test('拡大表示で画像が無い場合は白紙にせず、取得できない旨を表示する', async () => {
    await renderModals({ selectedPhoto: createPhoto('asset-1', null), selectedPhotoPreviewUri: null });

    expect(queryAllHostByType('Image')).toHaveLength(0);
    expect(screen.getByText('この写真の画像を表示できません')).toBeTruthy();
  });

  test('拡大表示は渡された拡大表示用URIを使う(高解像度へ差し替わる)', async () => {
    await renderModals({
      selectedPhoto: createPhoto('asset-1', 'file:///caches/asset-1-512.jpg'),
      selectedPhotoPreviewUri: 'file:///caches/asset-1-preview.jpg',
    });

    expect(getHostByType('Image').props.source).toEqual({ uri: 'file:///caches/asset-1-preview.jpg' });
  });

  test('高解像度の取得中はサムネイルを表示したままローディングを出す', async () => {
    await renderModals({
      selectedPhoto: createPhoto('asset-1', 'file:///caches/asset-1-512.jpg'),
      selectedPhotoPreviewUri: 'file:///caches/asset-1-512.jpg',
      isSelectedPhotoPreviewLoading: true,
    });

    expect(getHostByType('Image').props.source).toEqual({ uri: 'file:///caches/asset-1-512.jpg' });
    expect(screen.getByLabelText('高解像度の写真を読み込み中')).toBeTruthy();
  });

  test('取得が終わればローディングは消える', async () => {
    await renderModals({
      selectedPhoto: createPhoto('asset-1', 'file:///caches/asset-1-512.jpg'),
      selectedPhotoPreviewUri: 'file:///caches/asset-1-preview.jpg',
      isSelectedPhotoPreviewLoading: false,
    });

    expect(screen.queryByLabelText('高解像度の写真を読み込み中')).toBeNull();
  });

  test('端末に本体が無い写真では、サムネイルを出したまま拡大表示の中で案内する', async () => {
    await renderModals({
      selectedPhoto: createPhoto('asset-1', 'file:///caches/asset-1-512.jpg'),
      selectedPhotoPreviewUri: 'file:///caches/asset-1-512.jpg',
      isSelectedPhotoUnavailable: true,
    });

    // 開くたびにモーダルが出ると邪魔になるため、拡大表示の中へ控えめに出す
    expect(screen.getByText(PHOTO_UNAVAILABLE_INLINE_MESSAGE)).toBeTruthy();
    expect(getHostByType('Image').props.source).toEqual({ uri: 'file:///caches/asset-1-512.jpg' });
  });

  test('取得できている写真では案内を出さない', async () => {
    await renderModals({
      selectedPhoto: createPhoto('asset-1', 'file:///caches/asset-1-512.jpg'),
      selectedPhotoPreviewUri: 'file:///caches/asset-1-preview.jpg',
      isSelectedPhotoUnavailable: false,
    });

    expect(screen.queryByText(PHOTO_UNAVAILABLE_INLINE_MESSAGE)).toBeNull();
  });

  test('案内を出すときは画像を縮め、写真の上に文章を重ねない', async () => {
    await renderModals({
      selectedPhoto: createPhoto('asset-1', 'file:///caches/asset-1-512.jpg'),
      selectedPhotoPreviewUri: 'file:///caches/asset-1-512.jpg',
      isSelectedPhotoUnavailable: true,
    });

    // 案内は画像の下に流し込むため、画像の高さを案内の分だけ譲る必要がある
    expect(getHostByType('Image').props.style).toEqual([styles.photoPreviewImage, styles.photoPreviewShrunkForNotice]);
    expect(parseFloat(String(styles.photoPreviewShrunkForNotice.height))).toBeLessThan(parseFloat(String(styles.photoPreviewImage.height)));
  });

  test('写真が9枚に満たないページも高さが縮まず、余白領域でもスワイプできる', () => {
    // 写真3枚のページで高さが1行分へ縮むと、その下の空白がScrollViewのコンテンツ外になり
    // ページ送りのスワイプを受け取れなくなる。高さを固定してページ全体を操作対象に保つ
    expect(styles.photoClusterPage.height).toBe(styles.photoClusterPage.width);
    // flexWrap は高さが余ると行を分散させるため、先頭寄せにして見た目を保つ
    expect(styles.photoClusterPage.alignContent).toBe('flex-start');
  });
});
