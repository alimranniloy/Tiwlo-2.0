import React from 'react';

/**
 * Uiverse.io Morphing Liquid Polygon Loader by andrew-manzyk
 * Exact implementation adhering 100% to snippet
 */
export default function MorphLoader({
  size = 1.45,
  colorOne = '#ffbf48',
  colorTwo = '#be4a1d',
  className = '',
  style = {}
}) {
  const customStyle = {
    '--size': size,
    '--color-one': colorOne,
    '--color-two': colorTwo,
    '--color-three': `${colorOne}80`,
    '--color-four': `${colorTwo}80`,
    '--color-five': `${colorOne}40`,
    ...style
  };

  return (
    <div className={`loader ${className}`} style={customStyle}>
      <svg width="100" height="100" viewBox="0 0 100 100">
        <defs>
          <mask id="clipping">
            <polygon points="0,0 100,0 100,100 0,100" fill="black" />
            <polygon points="25,25 75,25 50,75" fill="white" />
            <polygon points="50,25 75,75 25,75" fill="white" />
            <polygon points="35,35 65,35 50,65" fill="white" />
            <polygon points="35,35 65,35 50,65" fill="white" />
            <polygon points="35,35 65,35 50,65" fill="white" />
            <polygon points="35,35 65,35 50,65" fill="white" />
          </mask>
        </defs>
      </svg>
      <div className="box" />
    </div>
  );
}
