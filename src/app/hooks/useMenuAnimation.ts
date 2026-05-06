import { useEffect, useRef, useState } from 'react';
import { Animated, Easing } from 'react-native';

export type MenuAnimationState = {
  /** 閉じアニメーション中もメニューを描画し続けるための表示フラグ。 */
  isMenuVisible: boolean;
  /** メニュー本体と背景スクリーンのopacity/transformに使う進捗値。 */
  menuProgress: Animated.Value;
  /** 画面遷移などでメニュー状態を即座に初期化する関数。 */
  resetMenuImmediately: () => void;
};

/**
 * メニュー開閉アニメーションと、閉じ完了までの表示維持を管理する。
 *
 * @param isMenuOpen - ユーザー操作上のメニュー開閉状態。
 * @param durationMs - 開閉アニメーションの長さミリ秒。
 * @returns メニュー表示フラグ、アニメーション進捗、即時リセット関数。
 */
export function useMenuAnimation(isMenuOpen: boolean, durationMs: number): MenuAnimationState {
  const menuProgress = useRef(new Animated.Value(0)).current;
  const [isMenuVisible, setIsMenuVisible] = useState(false);

  /**
   * 閉じる時はアニメーション完了までメニューをアンマウントしない。
   * これにより、背景スクリーンとメニュー本体が自然にフェードアウトできる。
   */
  useEffect(() => {
    if (isMenuOpen) {
      setIsMenuVisible(true);
    }

    Animated.timing(menuProgress, {
      toValue: isMenuOpen ? 1 : 0,
      duration: durationMs,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start(({ finished }) => {
      if (finished && !isMenuOpen) {
        setIsMenuVisible(false);
      }
    });
  }, [durationMs, isMenuOpen, menuProgress]);

  /**
   * 画面遷移時は閉じアニメーションより状態整合性を優先する。
   * 戻った時にメニューだけ残る不整合を避けるため、値も表示状態も即座に戻す。
   *
   * @returns なし。
   */
  function resetMenuImmediately(): void {
    menuProgress.stopAnimation();
    menuProgress.setValue(0);
    setIsMenuVisible(false);
  }

  return { isMenuVisible, menuProgress, resetMenuImmediately };
}
