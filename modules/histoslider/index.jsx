import React from 'react'
import { max, min } from 'd3-array'
import { scaleLinear as linear } from 'd3-scale'
import classNames from '@oacore/design/lib/utils/class-names'

import Histogram from './histogram'
import Slider from './slider'
import styles from './styles.module.css'

const Histoslider = ({
  data,
  width = 400,
  height = 180,
  padding = 2,
  sliderHeight = 20,
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
    selectFunc(null)
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

export default Histoslider
