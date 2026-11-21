import { render, screen } from '@testing-library/react-native';

import { lightTheme } from '@/theme/theme';
import { createStyles } from '@/ui/appStyles';
import { MULTI_AREA_SPOT_BADGE_LABEL } from '@/ui/appText';
import { LabelBadge } from '@/ui/components/LabelBadge';

const styles = createStyles(lightTheme);

describe('汎用ラベル LabelBadge', () => {
  it('渡した文字を表示する', async () => {
    await render(<LabelBadge label={MULTI_AREA_SPOT_BADGE_LABEL} styles={styles} />);

    expect(screen.getByText('複数スポット')).toBeTruthy();
  });
});
