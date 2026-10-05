import type { ComponentProps } from 'react';

/** A stand-in for a design system's button, whose API is not a native
 * button's: `isDisabled` and `onPress` in place of `disabled` and `onClick`. */
export function Button({
  isDisabled = false,
  onPress,
  ...props
}: Omit<ComponentProps<'button'>, 'disabled' | 'onClick'> & {
  isDisabled?: boolean;
  onPress: () => void;
}) {
  return (
    <button
      type="button"
      className="ds-button"
      disabled={isDisabled}
      onClick={onPress}
      {...props}
    />
  );
}
