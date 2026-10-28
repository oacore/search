import React, { useEffect, useState } from 'react'
import PropTypes from 'prop-types'

import styles from './histoslider.css'

const Slider = ({
  selection: propsSelection,
  scale,
  width,
  height,
  reset,
  rangeColor,
  unselectedColor,
  showLabels,
  onChange,
  dragChange,
}) => {
  const [dragging, setDragging] = useState(false)
  const [dragIndex, setDragIndex] = useState()

  const dragStart = (index, e) => {
    e.stopPropagation()
    if (!dragging) {
      setDragging(true)
      setDragIndex(index)

      dragChange(true)
    }
  }

  const dragEnd = (e) => {
    e.stopPropagation()

    setDragging(false)
    setDragIndex(null)

    dragChange(false)
  }

  useEffect(() => {
    window.addEventListener('mouseup', dragEnd, false)

    return () => window.removeEventListener('mouseup', dragEnd, false)
  }, [])

  const dragFromSVG = (e) => {
    if (!dragging) {
      const selection = [...propsSelection]
      const selected = scale.invert(e.nativeEvent.offsetX)
      let svgDragIndex

      if (
        Math.abs(selected - selection[0]) > Math.abs(selected - selection[1])
      ) {
        selection[1] = selected
        svgDragIndex = 0
      } else {
        selection[0] = selected
        svgDragIndex = 1
      }
      onChange(selection)
      setDragging(true)
      setDragIndex(svgDragIndex)
      dragChange(true)
    }
  }

  const mouseMove = (e) => {
    if (dragging) {
      const selection = [...propsSelection]
      selection[dragIndex] = Math.round(scale.invert(e.nativeEvent.offsetX))
      onChange(selection)
    }
  }

  const selectionWidth = Math.abs(
    scale(propsSelection[1]) - scale(propsSelection[0])
  )
  const selectionSorted = Array.from(propsSelection).sort((a, b) => +a - +b)

  return (
    <div className={styles.range}>
      {showLabels ? (
        <>
          <div className={styles.labelLeft}>{propsSelection[0]}</div>
          <div className={styles.labelRight}>{propsSelection[1] - 1}</div>
        </>
      ) : null}

      <svg
        style={{ overflow: 'visible', marginBottom: showLabels ? '4rem' : '0' }}
        height={height}
        width={width}
        onMouseDown={dragFromSVG}
        onDoubleClick={reset}
        onMouseMove={mouseMove}
      >
        <rect height={4} fill={unselectedColor} x={0} y={10} width={width} />
        <rect
          height={4}
          fill={rangeColor}
          x={scale(selectionSorted[0])}
          y={10}
          width={selectionWidth}
        />
        {propsSelection.map((m, i) => (
          <g
            tabIndex={0}
            transform={`translate(${scale(m)}, 0)`}
            key={`handle-${m}`}
            style={{ outline: 'none' }}
          >
            <circle
              style={{ fill: rangeColor, stroke: rangeColor }}
              r={9}
              cx={0}
              cy={12.5}
              strokeWidth="1"
            />
            <circle
              style={{ fill: rangeColor, stroke: rangeColor }}
              onMouseDown={dragStart.bind(this, i)}
              r={9}
              cx={0}
              cy={12}
              strokeWidth="1"
              className={styles.rangeDots}
            />
          </g>
        ))}
      </svg>
    </div>
  )
}

Slider.propTypes = {
  selection: PropTypes.arrayOf(PropTypes.number).isRequired,
  height: PropTypes.number,
  width: PropTypes.number,
  scale: PropTypes.func,
  reset: PropTypes.func,
  dragChange: PropTypes.func,
  onChange: PropTypes.func,
  showLabels: PropTypes.bool,
  rangeColor: PropTypes.string,
  unselectedColor: PropTypes.string,
}

export default Slider
