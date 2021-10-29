/* eslint-disable no-unneeded-ternary */
/* eslint-disable no-nested-ternary */
import React from 'react'
import { Motion, spring } from 'react-motion'
import classNames from '@oacore/design/lib/utils/class-names'

import styles from './styles.module.css'

const Histogram = ({
  height = 200,
  data,
  showOnDrag,
  selection,
  reset,
  selectedBarColor = '#EF8237',
  unselectedColor = '#E0E0E0',
  scale,
  barBorderRadius = 1,
  barPadding = 1,
  width = 100,
  max,
  dragging,
  onChange,
  showLabels = false,
}) => {
  const [style, setStyle] = React.useState({
    displayBox: 'block',
  })
  const [hoveredItem, setHoveredItem] = React.useState({
    year: null,
    count: null,
  })
  const selectBucket = (bucket) => {
    onChange([bucket.x0, bucket.x])
  }

  const onHoverItem = (bucket) => {
    setStyle({ displayBox: 'block' })
    setHoveredItem({
      year: bucket.x0,
      count: bucket.y,
    })
  }

  const onLeaveItem = () => {
    setStyle({ displayBox: 'none' })
    setHoveredItem({
      year: null,
      count: null,
    })
  }

  const selectionSorted = Array.from(selection).sort((a, b) => +a - +b)

  const showHistogramPredicate = showOnDrag ? (dragging ? true : false) : true
  const h = showHistogramPredicate ? height : 0

  return (
    <Motion style={{ height: spring(h) }}>
      {() => (
        <>
          <svg width={width} height={height} className={styles.histograms}>
            <g transform={`translate(0, ${height})`}>
              <g transform="scale(1,-1)">
                {data.map((bucket) => {
                  let color = unselectedColor
                  if (
                    selectionSorted[0] > bucket.x ||
                    selectionSorted[1] < bucket.x0
                  )
                    color = unselectedColor
                  else if (
                    selectionSorted[0] <= bucket.x0 &&
                    selectionSorted[1] >= bucket.x
                  ) {
                    // Entire block is covered
                    color = selectedBarColor
                  }
                  return (
                    <g
                      key={bucket.x0}
                      transform={`translate(${
                        scale(bucket.x0) + barPadding / 2
                      } 0)`}
                    >
                      <rect
                        fill={unselectedColor}
                        width={scale(bucket.x) - scale(bucket.x0) - barPadding}
                        height={(bucket.y / max) * height}
                        rx={barBorderRadius}
                        ry={barBorderRadius}
                        x={0}
                      />

                      <rect
                        fill={color}
                        onClick={selectBucket.bind(this, bucket)}
                        onDoubleClick={reset.bind(this)}
                        style={{
                          cursor: 'pointer',
                        }}
                        width={scale(bucket.x) - scale(bucket.x0) - barPadding}
                        height={(bucket.y / max) * height}
                        x={0}
                        onMouseEnter={() => onHoverItem(bucket)}
                        onMouseLeave={onLeaveItem}
                        className={classNames.use(styles.histogramItem)}
                      />
                    </g>
                  )
                })}
              </g>
            </g>
          </svg>
          {showLabels && hoveredItem.year && (
            <div
              style={{
                display: style.displayBox,
              }}
              className={styles.info}
            >
              <span>{hoveredItem.year}</span>
              <div className={styles.infoBox}>
                Articles - <span> {hoveredItem.count}</span>
              </div>
            </div>
          )}
        </>
      )}
    </Motion>
  )
}

export default Histogram
