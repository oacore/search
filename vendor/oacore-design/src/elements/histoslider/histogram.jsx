import React from 'react'
import PropTypes from 'prop-types'

import styles from './histoslider.css'
import { classNames } from '../../utils'

const Histogram = ({
  height,
  data,
  selection,
  reset,
  selectedBarColor,
  unselectedColor,
  scale,
  barBorderRadius,
  barPadding,
  width,
  max,
  onChange,
  showLabels,
}) => {
  const [style, setStyle] = React.useState({
    displaybox: 'block',
  })
  const [hoveredItem, setHoveredItem] = React.useState({
    year: null,
    count: null,
  })
  const selectBucket = (bucket) => {
    onChange([bucket.x0, bucket.x])
  }

  const onHoverItem = (bucket) => {
    setStyle({ displaybox: 'block' })
    setHoveredItem({
      year: bucket.x0,
      count: bucket.y,
    })
  }

  const onLeaveItem = () => {
    setStyle({ displaybox: 'none' })
    setHoveredItem({
      year: null,
      count: null,
    })
  }

  const selectionSorted = Array.from(selection).sort((a, b) => +a - +b)

  return (
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
            display: style.displaybox,
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
  )
}

export default Histogram

Histogram.propTypes = {
  data: PropTypes.arrayOf(
    PropTypes.shape({
      x0: PropTypes.number,
      x: PropTypes.number,
      y: PropTypes.number,
    })
  ).isRequired,
  selection: PropTypes.arrayOf(PropTypes.number).isRequired,
  barBorderRadius: PropTypes.number,
  width: PropTypes.number,
  height: PropTypes.number,
  reset: PropTypes.func,
  onChange: PropTypes.func,
  showLabels: PropTypes.bool,
  selectedBarColor: PropTypes.string,
  unselectedColor: PropTypes.string,
  scale: PropTypes.func,
  barPadding: PropTypes.number,
  max: PropTypes.number,
}
