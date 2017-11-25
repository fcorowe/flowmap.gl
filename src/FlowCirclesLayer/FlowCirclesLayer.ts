import { ScatterplotLayer, Shaders } from 'deck.gl';
import { enable64bitSupport } from '../utils';
import VertexShader from './FlowCirclesLayerVertex.glsl';
import VertexShader64 from './FlowCirclesLayerVertex64';

// tslint:disable-next-line:no-any
export type FlowCirclesData = any;

class FlowCirclesLayer extends ScatterplotLayer<FlowCirclesData> {
  getShaders(): Shaders {
    const shaders = super.getShaders();
    return {
      ...shaders,
      vs: enable64bitSupport(this.props) ? VertexShader64 : VertexShader,
    };
  }
}

export default FlowCirclesLayer;
