import { forwardRef, useState } from 'react'
import PropTypes from 'prop-types'

import ProgressSpinner from '../progress-spinner'
import Icon from '../icon'
import Group from './group'
import Label from './label'
import Control from './control'
import Addon from './addon'
import styles from './text-field.css'
import { classNames } from '../../utils'

/**
 * Unique ID generator
 *
 * Based on @gordonbrander's gist.
 * See: https://gist.github.com/gordonbrander/2230317
 *
 * > Math.random should be unique because of its seeding algorithm.
 * > Convert it to base 36 (numbers + letters), and grab the first 9 characters
 * > after the decimal.
 *
 * @return {string}
 */

const Status = ({ value, variant, progress, ...restProps }) => (
  <Addon {...restProps}>
    {typeof value == 'string' ? (
      <Icon src={value} aria-hidden />
    ) : (
      {
        valid: <Icon src="#check" aria-hidden />,
        success: <Icon src="#check" aria-hidden />,
        invalid: <Icon src="#alert-circle-outline" aria-hidden />,
        error: <Icon src="#alert-circle-outline" aria-hidden />,
        progress: <ProgressSpinner value={progress} />,
      }[variant]
    )}
  </Addon>
)

const TextField = forwardRef(
  (
    {
      children,
      id,
      className,
      label,
      helper,
      statusIcon,
      progress,
      variant = 'normal',
      size = 'normal',
      // keeping tag being 'div' for the backward consistency temporarily
      tag = 'div',
      placeholder = variant === 'pure' ? label : undefined,
      ...inputProps
    },
    ref
  ) => {
    const controlId = [id, 'control'].join('-')

    const [isTouched, setIsTouched] = useState(false)

    return (
      <Group
        id={id}
        className={classNames
          .use({
            // 'focus' should be applied directly to the control
            [variant]: !['normal'].includes(variant),
            [size]: size !== 'default',
            touched: isTouched,
          })
          .from(styles)
          .join(className)}
        tag={tag}
      >
        {statusIcon != null && (
          <Status value={statusIcon} variant={variant} progress={progress} />
        )}
        <Control
          ref={ref}
          id={controlId}
          className={classNames.use(isTouched && styles.touched)}
          onBlur={() => !isTouched && setIsTouched(true)}
          aria-invalid={variant === 'error'}
          aria-describedby={`${id}-message`}
          placeholder={placeholder}
          focus={['error', 'success', 'focus'].includes(variant)}
          {...inputProps}
        />
        {children}
        <span id={`${id}-helper`} className={styles.helper}>
          {helper}
        </span>
        <Label htmlFor={controlId}>{label}</Label>
      </Group>
    )
  }
)

TextField.propTypes = {
  /**
   * Label for the text field
   */
  label: PropTypes.node.isRequired,
  /**
   * Input's placeholder
   */
  placeholder: PropTypes.string,
  /**
   * Size variation. Affects height only.
   */
  size: PropTypes.oneOf(['normal', 'small', 'large']),
  /**
   * An ID that will be used to link input and label. It's necessary for
   * accessibility.
   */
  id: PropTypes.string.isRequired,
  /**
   * Helper message to show bellow the input
   */
  helper: PropTypes.node,
  /**
   * Helper variation. Affects label position and the colour.
   *
   * Avoid using `pure` with no `placeholder`, prefer to explicitly set it.
   * However, if you don't, the `placeholder` repeats the label text.
   */
  variant: PropTypes.oneOf([
    'normal',
    'pure',
    'focus',
    'success',
    'error',
    'progress',
  ]),
  /**
   * Adds a status icon to TextField at the right side of the input.
   *
   * If boolean is passed (preferable), the icon is based on the `variant`.
   *
   * If a `string` is passed, it's resolved as the icon path.
   */
  statusIcon: PropTypes.oneOfType([PropTypes.bool, PropTypes.string]),
  /**
   * A number between `[0-1]` if you have determinate progress indication
   * for the particular text field.
   *
   * If not passed, the progress indicator appears in indeterminate state.
   *
   * Has no effect if the `variant` is different than `progress`.
   */
  progress: PropTypes.number,
}

export default TextField
