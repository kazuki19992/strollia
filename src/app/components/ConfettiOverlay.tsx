import { useEffect, useMemo, useRef } from 'react';
import { Animated, View } from 'react-native';

import { AppStyles } from '../appStyles';

/** 紙吹雪の吹き上げ開始位置。 */
type ConfettiOrigin = 'left' | 'right';

/** 紙吹雪の1片。 */
type ConfettiPiece = {
  id: number;
  origin: ConfettiOrigin;
  color: string;
  delay: number;
  peak: number;
  drift: number;
  fallDrift: number;
  progress: Animated.Value;
};

/** 紙吹雪オーバーレイのprops。 */
export type ConfettiOverlayProps = {
  /** 画面共通スタイル。 */
  styles: AppStyles;
  /** アニメーションを開始するか。 */
  active: boolean;
  /** 表示対象が変わるたびにアニメーションを再生するためのキー。 */
  animationKey: string | null;
};

/** 左右下から吹き上がり、重力で画面外へ落ちる軽量な紙吹雪アニメーション。 */
export function ConfettiOverlay({ styles, active, animationKey }: ConfettiOverlayProps) {
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
      piece.progress.setValue(0);
      Animated.timing(piece.progress, {
        toValue: 1,
        duration: 1900,
        delay: piece.delay,
        useNativeDriver: true,
      }).start();
    });
  }, [active, animationKey, pieces]);

  return (
    <View pointerEvents="none" style={styles.confettiLayer}>
      {pieces.map((piece) => {
        const direction = piece.origin === 'left' ? 1 : -1;

        return (
          <Animated.View
            key={piece.id}
            style={[
              styles.confettiPiece,
              {
                backgroundColor: piece.color,
                bottom: -28,
                left: piece.origin === 'left' ? -16 : undefined,
                right: piece.origin === 'right' ? -16 : undefined,
                transform: [
                  {
                    translateX: piece.progress.interpolate({
                      inputRange: [0, 0.45, 1],
                      outputRange: [0, direction * piece.drift, direction * (piece.drift + piece.fallDrift)],
                    }),
                  },
                  {
                    translateY: piece.progress.interpolate({
                      inputRange: [0, 0.45, 1],
                      outputRange: [0, -piece.peak, 110],
                    }),
                  },
                  {
                    rotate: piece.progress.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '720deg'] }),
                  },
                ],
              },
            ]}
          />
        );
      })}
    </View>
  );
}

/** 紙吹雪の初期値を作る。 */
function createConfettiPieces(): ConfettiPiece[] {
  const colors = ['#73c7a2', '#f0b84f', '#ff8899', '#8bb7ff', '#fffdf8'];

  return Array.from({ length: 44 }, (_, index) => ({
    id: index,
    origin: index % 2 === 0 ? 'left' : 'right',
    color: colors[index % colors.length],
    delay: (index % 11) * 35,
    peak: 300 + (index % 9) * 38,
    drift: 70 + (index % 8) * 24,
    fallDrift: 80 + (index % 7) * 30,
    progress: new Animated.Value(0),
  }));
}
