# flowmap.gl

[Flow map](https://en.wikipedia.org/wiki/Flow_map) drawing layer for [deck.gl](http://uber.github.io/deck.gl). Can be used for visualizing movement of people (e.g. migration) or objects between geographic locations. The layer is rendered in WebGL and can handle large numbers of flows with a good rendering performance.

Try [flowmap.blue](https://flowmap.blue/) for an easy way of publishing a flow map backed by a Google Sheets spreadsheet (no programming skills required).

Check out the [example app](http://ilyabo.github.io/flowmap.gl-example) and [storybook](https://teralytics.github.io/flowmap.gl/index.html). 

<img src="./doc/swiss-cantons-migration.png" width="500" />

## Features

Given an array of locations and an array of flows between these locations the layer will do the following:

- Represent the flows as lines of varying thickness depending on the flow magnitudes
- The flow lines are sorted so that the larger flows are drawn above
- GeoJSON geometries of the location areas are rendered as polygons
- Total incoming and outgoing flows for the locations are calculated and represented as circles of varying sizes. 

### Location totals
Both the incoming and outgoing totals for the locations are represented. 
A darker outline means that there are more incoming flows, a lighter outline means that there are more outgoing flows. 

For instance, below we compare between the evening and the morning commuting behaviors of a large city:

<img src="./doc/morning-evening-peaks.gif" width="480" />

### Difference mode
The layer can be used to show the [difference between two moments in time](https://teralytics.github.io/flowmap.gl/?selectedKind=Interactive&selectedStory=diff&full=0&addons=1&stories=1&panelRight=0&addonPanel=storybook%2Factions%2Factions-panel).



## Usage

Here's a usage example:
```jsx harmony
import * as React from 'react';
import DeckGL from 'deck.gl';
import { StaticMap } from 'react-map-gl';
import FlowMapLayer from 'flowmap.gl';

const colors = {
  flows: {
    max: '#137CBD',
  },
  locationAreas: {
    outline: 'rgba(92,112,128,0.5)',
    normal: 'rgba(187,187,187,0.5)',
    selected: 'rgba(217,130,43,0.5)',
  },
};

class MyFlowMap extends React.Component {
  state = { viewState: this.props.initialViewState };
  
  render() {
    const flowMapLayer = new FlowMapLayer({
      id: 'flow-map-layer',
      colors,
      locations: [...],   // array of GeoJSON features of location areas
      flows: [...],       // array of Flow objects
      getLocationId: l => l.id,
      getLocationCentroid: l => l.properties.centroid,
      getFlowOriginId: f => f.origin,
      getFlowDestId: f => f.dest,
      getFlowMagnitude: f => f.count,
      showTotals: true,
      showLocationAreas: true,
      locationCircleSize: 3,
      varyFlowColorByMagnitude: true,
    });
    
    return (
      <DeckGL 
        layers={[flowMapLayer]}
        initialViewState={this.state.viewState}
        controller={true}
        onViewStateChange={({ viewState }) => this.setState({ viewState })}
        children={({ width, height, viewState }) => (
          <StaticMap mapboxApiAccessToken={mapboxAccessToken} width={width} height={height} viewState={viewState} />
        )}
      />
    );
  }  
}
```

The full list of supported props:
```typescript
interface Props {
  id: string;
  colors: Colors | DiffColors;
  locations: Locations;
  flows: Flow[];
  fp64?: boolean;
  onClick?: PickingHandler<FlowLayerPickingInfo>;
  onHover?: PickingHandler<FlowLayerPickingInfo>;
  getLocationId?: LocationAccessor<string>;
  getLocationCentroid?: LocationAccessor<[number, number]>;
  getLocationTotalIn?: LocationAccessor<number>;
  getLocationTotalOut?: LocationAccessor<number>;
  getFlowOriginId?: FlowAccessor<string>;
  getFlowDestId?: FlowAccessor<string>;
  getFlowMagnitude?: FlowAccessor<number>;
  showTotals?: boolean;
  locationCircleSize?: number;
  showLocationAreas?: boolean;
  varyFlowColorByMagnitude?: boolean;
  selectedLocationIds?: string[];
  highlightedLocationId?: string;
  highlightedFlow?: Flow;
  visible?: boolean;
  opacity?: number;
  pickable?: boolean;
  fp64?: boolean;
  updateTriggers?: UpdateTriggers;
}
```

Here's the [code for the example app](https://github.com/ilyabo/flowmap.gl-example)
and a more complex [interactive example](./examples/InteractiveExample.tsx).

## Developing

Create an `.env` file in the project root 
containing one line: 

    MapboxAccessToken=<your-mapbox-access-token>

Then, run:

    npm install
    npm start
    open http://localhost:6006 to open storybook

## Acknowledgements

Many thanks to [Philippe Voinov](https://github.com/tehwalris) 
for his help with the first version of the FlowLinesLayer. 


## License
flowmap.gl
Copyright 2018 Teralytics

This product includes software developed at
The Apache Software Foundation (http://www.apache.org/).

Portions of this software were developed at Teralytics (http://www.teralytics.net)
