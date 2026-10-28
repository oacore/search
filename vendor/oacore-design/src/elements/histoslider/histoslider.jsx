import React from 'react'
import { max, min } from 'd3-array'
import { scaleLinear as linear } from 'd3-scale'
import PropTypes from 'prop-types'

import Histogram from './histogram'
import Slider from './slider'
import styles from './histoslider.css'
import { classNames } from '../../utils'

const Histoslider = ({
  data,
  width,
  height,
  padding,
  sliderHeight,
  selection: propsSelection,
  selectFunc,
  className,
  ...props
}) => {
  const [dragging, setDragging] = React.useState(false)

  const dragChange = (drag) => {
    setDragging(drag)
  }

  const onChange = (selection) => {
    const sortedData = data.sort((a, b) => +a.x0 - +b.x0)

    const extent = [
      min(sortedData, ({ x0 }) => +x0),
      max(sortedData, ({ x }) => +x),
    ]

    selectFunc(
      selection.map((d) => Math.max(extent[0], Math.min(extent[1], +d)))
    )
  }

  const reset = () => {
    selectFunc([data[0].x0, data[data.length - 1].x0 + 1])
  }

  const innerHeight = height - padding * 2
  const innerWidth = width - padding * 2
  const histogramHeight = innerHeight - sliderHeight

  const sortedData = data.sort((a, b) => +a.x0 - +b.x0)
  const extent = [
    min(sortedData, ({ x0 }) => +x0),
    max(sortedData, ({ x }) => +x),
  ]
  const maxValue = max(sortedData, ({ y }) => +y)
  const scale = linear().domain(extent).range([0, innerWidth])
  scale.clamp(true)

  const selection = propsSelection || extent

  const overrides = {
    selection,
    data: sortedData,
    dragChange,
    dragging,
    scale,
    max: maxValue,
    onChange,
    reset,
    width: innerWidth,
  }

  return (
    <div
      style={{
        width,
        padding,
      }}
      className={classNames.use(styles.histoslider).join(className)}
    >
      <Histogram {...{ ...props, ...overrides, height: histogramHeight }} />
      <Slider {...{ ...props, ...overrides, height: sliderHeight }} />
    </div>
  )
}

Histoslider.propTypes = {
  data: PropTypes.arrayOf(
    PropTypes.shape({
      x0: PropTypes.number,
      x: PropTypes.number,
      y: PropTypes.number,
    })
  ).isRequired,
  selectFunc: PropTypes.func.isRequired,
  selectedBarColor: PropTypes.string,
  unselectedColor: PropTypes.string,
  rangeColor: PropTypes.string,
  width: PropTypes.number,
  height: PropTypes.number,
  selection: PropTypes.arrayOf(PropTypes.number),
  barBorderRadius: PropTypes.number,
  barPadding: PropTypes.number,
  padding: PropTypes.number,
  showOnDrag: PropTypes.bool,
  sliderHeight: PropTypes.number,
  handleLabelFormat: PropTypes.string,
  formatLabelFunction: PropTypes.func,
  disableHistogram: PropTypes.bool,
  showLabels: PropTypes.bool,
}

Histoslider.defaultProps = {
  selectedBarColor: '#EF8237',
  rangeColor: '#b75400',
  unselectedColor: '#E0E0E0',
  showOnDrag: false,
  width: 300,
  height: 200,
  barBorderRadius: 2,
  barPadding: 2,
  padding: 20,
  sliderHeight: 20,
  handleLabelFormat: '0.5P',
  formatLabelFunction: undefined,
  showLabels: false,
}

export default Histoslider
