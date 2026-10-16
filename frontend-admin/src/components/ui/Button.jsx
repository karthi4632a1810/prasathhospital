import './Button.css';

/**
 * Renders as <a> when `href` is given, otherwise <button>.
 * Keeps CTA styling identical across the hero, sticky bar and ticket cards.
 */
export default function Button({
  children,
  variant = 'primary',
  size = 'md',
  href,
  onClick,
  type = 'button',
  disabled = false,
  fullWidth = false,
  external = false,
  iconLeft,
  iconRight,
  className = '',
  ...rest
}) {
  const classes = [
    'btn',
    `btn--${variant}`,
    `btn--${size}`,
    fullWidth ? 'btn--full' : '',
    disabled ? 'is-disabled' : '',
    className,
  ]
    .filter(Boolean)
    .join(' ');

  const content = (
    <>
      {iconLeft && (
        <span className="btn__icon" aria-hidden="true">
          {iconLeft}
        </span>
      )}
      <span className="btn__label">{children}</span>
      {iconRight && (
        <span className="btn__icon" aria-hidden="true">
          {iconRight}
        </span>
      )}
    </>
  );

  if (href && !disabled) {
    return (
      <a
        className={classes}
        href={href}
        {...(external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
        onClick={onClick}
        {...rest}
      >
        {content}
      </a>
    );
  }

  return (
    <button className={classes} type={type} onClick={onClick} disabled={disabled} {...rest}>
      {content}
    </button>
  );
}
