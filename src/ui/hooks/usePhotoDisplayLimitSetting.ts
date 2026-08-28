import { useCallback, useEffect, useMemo, useState } from 'react';

import {
  DEFAULT_PHOTO_DISPLAY_LIMIT_ID,
  getPhotoDisplayLimitId,
  resolvePhotoDisplayLimit,
  savePhotoDisplayLimitId,
  type PhotoDisplayLimitId,
} from '@/features/settings/photoDisplayLimit';

/** 「地図に表示する写真」設定の状態と更新操作。 */
export type PhotoDisplayLimitSettingState = {
  /** 選択中の表示上限ID。 */
  photoDisplayLimitId: PhotoDisplayLimitId;
  /** SQLの `LIMIT` に渡す件数。上限なしの場合はnull。 */
  photoDisplayLimit: number | null;
  /** 表示上限を保存して状態へ反映する。保存に失敗した場合は巻き戻して例外を投げ直す。 */
  updatePhotoDisplayLimitId: (id: PhotoDisplayLimitId) => Promise<void>;
};

/**
 * 「地図に表示する写真」の上限設定を読み込み、地図と設定画面で共有する。
 *
 * **設定をここで保持するのは、地図のパン・ズームのたびに設定を読み直さないためである。**
 * ビューポート検索は表示範囲が余白の外へ出るたびに走るので、その中で設定を読むと
 * 表示のたびにSQLiteへの往復が増える。UI層で保持し、解決済みの件数を検索へ渡す
 * (`loadGeotaggedPhotosInBounds` のJSDocを参照)。
 *
 * @returns 選択中の表示上限、SQL用の件数、更新操作。
 */
export function usePhotoDisplayLimitSetting(): PhotoDisplayLimitSettingState {
  const [photoDisplayLimitId, setPhotoDisplayLimitId] = useState<PhotoDisplayLimitId>(DEFAULT_PHOTO_DISPLAY_LIMIT_ID);

  useEffect(() => {
    let isActive = true;

    getPhotoDisplayLimitId()
      .then((savedId) => {
        if (isActive) {
          setPhotoDisplayLimitId(savedId);
        }
      })
      .catch((error: unknown) => {
        // 読み込めない場合は既定(すべて)のまま表示を続ける。安全上限が内部で効くため実害はない
        console.warn('Failed to load photo display limit setting:', error);
      });

    return () => {
      isActive = false;
    };
  }, []);

  const updatePhotoDisplayLimitId = useCallback(
    async (id: PhotoDisplayLimitId): Promise<void> => {
      const previousId = photoDisplayLimitId;
      setPhotoDisplayLimitId(id);

      try {
        await savePhotoDisplayLimitId(id);
      } catch (error: unknown) {
        console.warn('Failed to persist photo display limit setting:', error);
        // UIとSQLiteの乖離を残さないよう巻き戻し、設定画面が保存失敗を通知できるよう投げ直す
        setPhotoDisplayLimitId(previousId);
        throw error;
      }
    },
    [photoDisplayLimitId],
  );

  const photoDisplayLimit = useMemo(() => resolvePhotoDisplayLimit(photoDisplayLimitId), [photoDisplayLimitId]);

  return { photoDisplayLimitId, photoDisplayLimit, updatePhotoDisplayLimitId };
}
