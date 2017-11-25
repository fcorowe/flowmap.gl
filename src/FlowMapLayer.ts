import {
  CompositeLayer,
  GeoJsonLayer,
  Layer,
  LayerProps,
  LayerState,
  PickingInfo,
  PickParams,
  UpdateTriggers,
} from 'deck.gl';
import { Feature, FeatureCollection, GeometryObject } from 'geojson';
import FlowCirclesLayer from './FlowCirclesLayer/FlowCirclesLayer';
import FlowLinesLayer from './FlowLinesLayer/FlowLinesLayer';
import createSelectors, { MemoizedSelectors } from './selectors';
import { colorAsArray, RGBA } from './utils';

// tslint:disable-next-line:no-any
export type Flow = any;

// tslint:disable-next-line:no-any
export type LocationProperties = any;

export type Location = Feature<GeometryObject, LocationProperties>;

export type Locations = FeatureCollection<GeometryObject, LocationProperties>;

export const enum LocationCircleType {
  INNER = 'inner',
  OUTER = 'outer',
}

export interface LocationCircle {
  location: Location;
  type: LocationCircleType;
}

export type Data = Flow | Location | LocationCircle;

export const enum PickingType {
  LOCATION = 'location',
  FLOW = 'flow',
  LOCATION_AREA = 'location-area',
}

export interface LocationPickingInfo extends PickingInfo<Data> {
  type: PickingType.LOCATION;
  object: Location;
}

export interface LocationAreaPickingInfo extends PickingInfo<Data> {
  type: PickingType.LOCATION_AREA;
  object: Location;
}

export interface FlowPickingInfo extends PickingInfo<Data> {
  type: PickingType.FLOW;
  object: Flow;
}

export type LayerPickingInfo = LocationPickingInfo | LocationAreaPickingInfo | FlowPickingInfo;

export type FlowAccessor<T> = (flow: Flow) => T;
export type LocationAccessor<T> = (location: Location) => T;
export type LocationCircleAccessor<T> = (locCircle: LocationCircle) => T;

export interface Props extends LayerProps<Data, LayerPickingInfo> {
  baseColor: string;
  locations: Locations;
  flows: Flow[];
  getLocationId?: LocationAccessor<string>;
  getLocationCentroid?: LocationAccessor<[number, number]>;
  getFlowOriginId?: FlowAccessor<string>;
  getFlowDestId?: FlowAccessor<string>;
  getFlowMagnitude?: FlowAccessor<number>;
  showTotals?: boolean;
  showLocations?: boolean;
  varyFlowColorByMagnitude?: boolean;
  selectedLocationId?: string;
  highlightedLocationId?: string;
  highlightedFlow?: {};
}

export interface State extends LayerState {
  selectors: MemoizedSelectors;
}

const LAYER_ID__LOCATIONS = 'locations';
const LAYER_ID__LOCATION_AREAS = 'location-areas';
const LAYER_ID__FLOWS = 'flows';
const LAYER_ID__FLOWS_ACTIVE = 'flows-highlighted';

function getPickType(sourceLayer: Layer<Data>): PickingType | undefined {
  const { id } = sourceLayer;
  switch (id || '') {
    case LAYER_ID__FLOWS:
    // fall through
    case LAYER_ID__FLOWS_ACTIVE:
      return PickingType.FLOW;
    case LAYER_ID__LOCATIONS:
      return PickingType.LOCATION;
    case LAYER_ID__LOCATION_AREAS:
      return PickingType.LOCATION_AREA;
    default:
      return undefined;
  }
}

export default class FlowMapLayer extends CompositeLayer<Data, LayerPickingInfo, Props, State> {
  static layerName: string = 'FlowMapLayer';
  static defaultProps: Partial<Props> = {
    getLocationId: l => l.id || l.properties.id,
    getLocationCentroid: l => l.properties.centroid,
    getFlowOriginId: f => f.origin,
    getFlowDestId: f => f.dest,
    getFlowMagnitude: f => f.magnitude,
    showTotals: true,
    showLocations: true,
    varyFlowColorByMagnitude: false,
  };

  constructor(props: Props) {
    super(props);
  }

  initializeState() {
    const { getLocationId, getFlowOriginId, getFlowDestId, getFlowMagnitude } = this.props;
    if (!getLocationId || !getFlowOriginId || !getFlowDestId || !getFlowMagnitude) {
      throw new Error('getters must be defined');
    }

    this.setState({
      selectors: createSelectors({
        getLocationId,
        getFlowOriginId,
        getFlowDestId,
        getFlowMagnitude,
      }),
    });
  }

  getPickingInfo(params: PickParams<Data>): LayerPickingInfo {
    const info = params.info as LayerPickingInfo; // TODO: can we get rid of this cast?
    const type = getPickType(params.sourceLayer);
    if (type) {
      info.type = type;
      if (type === PickingType.LOCATION && info.object) {
        info.object = info.object.location;
      }
    }

    return info;
  }

  getLocationAreasLayer(id: string) {
    const { locations, selectedLocationId, highlightedLocationId, getLocationId } = this.props;
    if (!getLocationId) {
      throw new Error('getLocationId must be defined');
    }

    const { selectors: { getColors, isLocationConnectedGetter } } = this.state;
    const isConnected = isLocationConnectedGetter(this.props);
    const colors = getColors(this.props);

    const getFillColor = (location: Location) => {
      const locationId = getLocationId(location);
      const { normal, highlighted, selected, connected } = colors.locationAreaColors;
      if (locationId === selectedLocationId) {
        return selected;
      }

      if (locationId === highlightedLocationId) {
        return highlighted;
      }

      if (isConnected(locationId)) {
        return connected;
      }

      return normal;
    };

    return new GeoJsonLayer({
      id,
      data: locations,
      fp64: true,
      opacity: 0.5,
      stroked: true,
      filled: true,
      lineWidthMinPixels: 2,
      pointRadiusMinPixels: 2,
      getFillColor,
    });
  }

  getFlowLinesLayer(id: string, flows: Flow[], dimmed: boolean) {
    const {
      getFlowOriginId,
      getFlowDestId,
      getFlowMagnitude,
      getLocationCentroid,
      highlightedLocationId,
      highlightedFlow,
      showTotals,
    } = this.props;
    if (!getFlowOriginId || !getFlowDestId || !getFlowMagnitude || !getLocationCentroid) {
      throw new Error('getters must be defined');
    }

    const {
      selectors: { getLocationsById, getFlowThicknessScale, getFlowColorScale, getLocationRadiusGetter },
    } = this.state;

    const getLocationRadius = getLocationRadiusGetter(this.props);
    const locationsById = getLocationsById(this.props);
    const flowThicknessScale = getFlowThicknessScale(this.props);
    const flowColorScale = getFlowColorScale(this.props);

    const getSourcePosition: FlowAccessor<[number, number]> = flow =>
      getLocationCentroid(locationsById[getFlowOriginId(flow)]);
    const getTargetPosition: FlowAccessor<[number, number]> = flow =>
      getLocationCentroid(locationsById[getFlowDestId(flow)]);
    const getThickness: FlowAccessor<number> = flow => flowThicknessScale(getFlowMagnitude(flow));
    const getEndpointOffsets: FlowAccessor<[number, number]> = flow =>
      showTotals
        ? [
            getLocationRadius({
              location: locationsById[getFlowOriginId(flow)],
              type: LocationCircleType.INNER,
            }),
            getLocationRadius({
              location: locationsById[getFlowDestId(flow)],
              type: LocationCircleType.OUTER,
            }),
          ]
        : [0, 0];
    const getColor: FlowAccessor<RGBA> = dimmed
      ? flow => {
          const { l } = flowColorScale(getFlowMagnitude(flow));
          return [l, l, l, 100] as RGBA;
        }
      : flow => colorAsArray(flowColorScale(getFlowMagnitude(flow)));
    const updateTriggers: UpdateTriggers = {
      instanceColors: !dimmed && {
        highlightedLocationId,
        highlightedFlow,
      },
      instanceEndpointOffsets: {
        showTotals,
      },
    };

    return new FlowLinesLayer({
      id,
      getSourcePosition,
      getTargetPosition,
      getThickness,
      getEndpointOffsets,
      getColor,
      data: flows,
      opacity: 1,
      pickable: dimmed,
      drawBorder: !dimmed,
      updateTriggers,
    });
  }

  getNodesLayer(id: string) {
    const {
      highlightedLocationId,
      highlightedFlow,
      selectedLocationId,
      getLocationId,
      getLocationCentroid,
      getFlowOriginId,
      getFlowDestId,
    } = this.props;
    if (!getLocationId || !getFlowOriginId || !getFlowDestId || !getLocationCentroid) {
      throw new Error('getters must be defined');
    }

    const {
      selectors: { getLocationCircles, getLocationRadiusGetter, getLocationTotalInGetter, getLocationTotalOutGetter },
    } = this.state;

    const getLocationTotalIn = getLocationTotalInGetter(this.props);
    const getLocationTotalOut = getLocationTotalOutGetter(this.props);
    const getLocationRadius = getLocationRadiusGetter(this.props);

    const { selectors: { getColors } } = this.state;
    const colors = getColors(this.props);
    const circles = getLocationCircles(this.props);

    const getPosition: LocationCircleAccessor<[number, number]> = locCircle => getLocationCentroid(locCircle.location);
    const getCircleColor: LocationCircleAccessor<RGBA> = ({ location, type }) => {
      if (
        (!this.props.highlightedLocationId && !highlightedFlow && !selectedLocationId) ||
        this.props.highlightedLocationId === getLocationId(location) ||
        selectedLocationId === getLocationId(location) ||
        (highlightedFlow &&
          (getLocationId(location) === getFlowOriginId(highlightedFlow) ||
            getLocationId(location) === getFlowDestId(highlightedFlow)))
      ) {
        if (type === LocationCircleType.INNER) {
          return colors.locationCircleColors.inner;
        }

        if (getLocationTotalIn(location) > getLocationTotalOut(location)) {
          return colors.locationCircleColors.incoming;
        }

        return colors.locationCircleColors.outgoing;
      }

      if (type === LocationCircleType.INNER) {
        return colors.locationCircleColors.none;
      }

      return colors.locationCircleColors.dimmed;
    };

    return new FlowCirclesLayer({
      id,
      getPosition,
      getRadius: getLocationRadius,
      getColor: getCircleColor,
      data: circles,
      opacity: 1,
      pickable: true,
      fp64: true,
      updateTriggers: {
        getColor: { highlightedLocationId, highlightedFlow, selectedLocationId },
      },
    });
  }

  renderLayers() {
    const { showTotals, showLocations } = this.props;
    const { selectors: { getActiveFlows, getSortedNonSelfFlows } } = this.state;

    const flows = getSortedNonSelfFlows(this.props);
    const activeFlows = getActiveFlows(this.props);

    const layers = [];

    if (showLocations) {
      layers.push(this.getLocationAreasLayer(LAYER_ID__LOCATION_AREAS));
    }
    layers.push(this.getFlowLinesLayer(LAYER_ID__FLOWS, flows, true));
    layers.push(this.getFlowLinesLayer(LAYER_ID__FLOWS_ACTIVE, activeFlows, false));
    if (showTotals) {
      layers.push(this.getNodesLayer(LAYER_ID__LOCATIONS));
    }

    return layers;
  }
}
