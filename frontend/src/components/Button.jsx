import { motion } from "framer-motion";
import "./Button.css";

/**
 * Button — the shared, motion-powered control for Recipe Match.
 *
 * A single accessible primitive (shadcn-inspired variants + sizes) wired to
 * Framer Motion press/hover springs. Motion preferences are honored globally by
 * the app's `<MotionConfig reducedMotion="user">`, so there is no per-button
 * branch for reduced motion — the springs simply go quiet.
 *
 * @param {object} props
 * @param {"primary"|"secondary"|"ghost"|"danger"} [props.variant="primary"]
 * @param {"sm"|"md"|"lg"|"icon"} [props.size="md"]
 * @param {"button"|"submit"|"reset"} [props.type="button"]
 * @param {boolean} [props.busy=false] Shows a spinner and blocks interaction.
 * @param {React.ReactNode} [props.leftIcon] Decorative icon rendered before the label.
 * @param {string} [props.className]
 * @param {boolean} [props.disabled]
 * @param {React.ReactNode} [props.children]
 */
function Button({
  variant = "primary",
  size = "md",
  type = "button",
  busy = false,
  leftIcon = null,
  className = "",
  disabled = false,
  children,
  ...rest
}) {
  const classes = [
    "ui-btn",
    `ui-btn--${variant}`,
    `ui-btn--${size}`,
    busy ? "is-busy" : "",
    className,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <motion.button
      type={type}
      className={classes}
      disabled={disabled || busy}
      aria-busy={busy || undefined}
      whileHover={disabled || busy ? undefined : { y: -2 }}
      whileTap={disabled || busy ? undefined : { scale: 0.96, y: 0 }}
      whileFocus={disabled || busy ? undefined : { scale: 1.015 }}
      transition={{ type: "spring", stiffness: 480, damping: 26 }}
      {...rest}
    >
      <span className="ui-btn__shine" aria-hidden="true" />
      {busy ? <span className="ui-btn__spinner" aria-hidden="true" /> : null}
      {leftIcon ? (
        <span className="ui-btn__icon" aria-hidden="true">
          {leftIcon}
        </span>
      ) : null}
      {children != null ? <span className="ui-btn__label">{children}</span> : null}
    </motion.button>
  );
}

export default Button;
