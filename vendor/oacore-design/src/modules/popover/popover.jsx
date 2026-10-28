import Tippy from '@tippyjs/react/headless'
import PropTypes from 'prop-types'

import styles from './popover.css'
import { classNames } from '../../utils'
import { Card } from '../../elements'

const hideOnBlurPlugin = {
  name: 'hideOnBlur',
  defaultValue: true,
  fn(instance) {
    return {
      onCreate() {
        instance.popper.addEventListener('focusout', (event) => {
          if (
            instance.props.hideOnBlur &&
            event.relatedTarget &&
            !instance.popper.contains(event.relatedTarget)
          )
            instance.hide()
        })
      },
    }
  },
}

/**
 * The Popover component is backed by [Tippy.js](https://github.com/atomiks/tippyjs).
 *
 * **Not all props are documented here.** Please refer to [Tippy documentation](https://atomiks.github.io/tippyjs/v6/all-props/#trigger) for all possible props which can be passed down.
 */
const Popover = ({
  content,
  visible,
  interactive = false,
  /* trigger cannot be defined when manual mode is activated */
  trigger = visible !== undefined ? undefined : 'mouseenter focus',
  placement = 'auto',
  hideOnBlur = true,
  delay = 0,
  className,
  children,
  tag: Tag = 'div',
}) => (
  // Wrapper needed for accessibility
  // See more: https://atomiks.github.io/tippyjs/v6/accessibility/#interactivity
  <Tag>
    <Tippy
      visible={visible}
      trigger={trigger}
      placement={placement}
      interactive={interactive}
      delay={delay}
      plugins={[hideOnBlurPlugin]}
      hideOnBlur={hideOnBlur}
      render={(attrs) => (
        <Card className={classNames.use(styles.content, className)} {...attrs}>
          {content}
        </Card>
      )}
    >
      {children}
    </Tippy>
  </Tag>
)

Popover.propTypes = {
  /**
   * Single child which triggers the popover content to show, the element should
   * be focusable. (You can add tabindex="0")
   * See more at https://atomiks.github.io/tippyjs/v6/accessibility/#use-natively-focusable-elements
   */
  children: PropTypes.node.isRequired,
  /**
   * Content to show, either react element or pure text.
   */
  content: PropTypes.oneOfType([PropTypes.node, PropTypes.func]).isRequired,
  /**
   * Indicates visibility of Popover.Content.
   * Note should be applied only when trigger is set to manual
   */
  visible: PropTypes.bool,
  /**
   * Indicates whether content can be hovered over
   * and clicked inside without hiding
   */
  interactive: PropTypes.bool,
  /**
   * Indicated whether the popover contents should be hidden on blur.
   */
  hideOnBlur: PropTypes.bool,
  /**
   * Preferred position of the content. The position may not be reflected
   * if opposite placement has more space or overflow occurs.
   */
  placement: PropTypes.oneOf([
    'top',
    'top-start',
    'top-end',
    'left',
    'left-start',
    'left-end',
    'right',
    'right-start',
    'right-end',
    'bottom',
    'bottom-start',
    'bottom-end',
    'auto',
    'auto-start',
    'auto-end',
  ]),
  /**
   * Delay in ms before content shows or hides
   */
  delay: PropTypes.oneOfType([PropTypes.number, PropTypes.array]),
  /**
   * Determines the events that cause the content to show.
   * Multiple event names are separated by spaces.
   * Possible events: mouseenter focus click, focusin, manual
   */
  trigger: PropTypes.string,
  /**
   * className applied on popover content
   */
  className: PropTypes.oneOfType([
    PropTypes.string,
    PropTypes.objectOf(classNames),
  ]),
}

export default Popover
