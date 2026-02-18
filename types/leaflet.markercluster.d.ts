import "leaflet"

declare module "leaflet" {
  interface MarkerClusterGroupOptions extends LayerGroupOptions {
    disableClusteringAtZoom?: number
    maxClusterRadius?: number
    iconCreateFunction?: (cluster: MarkerCluster) => DivIcon
  }

  interface MarkerCluster extends Layer {
    getChildCount(): number
  }

  class MarkerClusterGroup extends LayerGroup {
    constructor(options?: MarkerClusterGroupOptions)
    getBounds(): LatLngBounds
  }
}
