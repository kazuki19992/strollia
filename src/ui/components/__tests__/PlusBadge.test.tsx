import { render, screen } from '@testing-library/react-native';

import { lightTheme } from '@/theme/theme';
import { createStyles } from '@/ui/appStyles';
import { PLUS_BADGE_LABEL } from '@/ui/appText';
import { PlusBadge } from '@/ui/components/PlusBadge';

const styles = createStyles(lightTheme);

describe('Plusラベル PlusBadge', () => {
  it('「Plus」の文字を表示する', async () => {
    await render(<PlusBadge styles={styles} />);

    expect(screen.getByText(PLUS_BADGE_LABEL)).toBeTruthy();
    expect(PLUS_BADGE_LABEL).toBe('Plus');
  });
});
