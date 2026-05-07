import { useEffect, useMemo, useRef } from 'react';
import { Animated, View } from 'react-native';

import { AppStyles } from '../appStyles';

/** 紙吹雪の1片。 */
type ConfettiPiece = {
  id: number;
  left: `${number}%`;
  color: string;
  delay: number;
  translateY: Animated.Value;
  rotate: Animated.Value;
};

/** 紙吹雪オーバーレイのprops。 */
export type ConfettiOverlayProps = {
  /** 画面共通スタイル。 */
  styles: AppStyles;
  /** アニメーションを開始するか。 */
  active: boolean;
};

/** 軽量な紙吹雪アニメーション。 */
export function ConfettiOverlay({ styles, active }: ConfettiOverlayProps) {
  const piecesRef = useRef<ConfettiPiece[] | null>(null);
  const pieces = useMemo(() => {
    if (!piecesRef.current) {
      piecesRef.current = createConfettiPieces();
    }

    return piecesRef.current;
  }, []);

  useEffect(() => {
    if (!active) {
      return;
    }

    pieces.forEach((piece) => {
      piece.translateY.setValue(-80);
      piece.rotate.setValue(0);
      Animated.parallel([
        Animated.timing(piece.translateY, {
          toValue: 760,
          duration: 1800,
          delay: piece.delay,
          useNativeDriver: true,
        }),
        Animated.timing(piece.rotate, {
          toValue: 1,
          duration: 1800,
          delay: piece.delay,
          useNativeDriver: true,
        }),
      ]).start();
    });
  }, [active, pieces]);

  return (
    <View pointerEvents="none" style={styles.confettiLayer}>
      {pieces.map((piece) => (
        <Animated.View
          key={piece.id}
          style={[
            styles.confettiPiece,
            {
              backgroundColor: piece.color,
              left: piece.left,
              transform: [
                { translateY: piece.translateY },
                {
                  rotate: piece.rotate.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '540deg'] }),
                },
              ],
            },
          ]}
        />
      ))}
    </View>
  );
}

/** 紙吹雪の初期値を作る。 */
function createConfettiPieces(): ConfettiPiece[] {
  const colors = ['#73c7a2', '#f0b84f', '#ff8899', '#8bb7ff', '#fffdf8'];

  return Array.from({ length: 34 }, (_, index) => ({
    id: index,
    left: `${(index * 29) % 100}%` as `${number}%`,
    color: colors[index % colors.length],
    delay: (index % 9) * 70,
    translateY: new Animated.Value(-80),
    rotate: new Animated.Value(0),
  }));
}
