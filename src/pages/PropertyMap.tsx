import { mapEmbedUrl, type MapLocation, type MapStatus } from './propertyShared'

export default function PropertyMap({ location, name, status }: { location: MapLocation; name: string; status: MapStatus }) {
  return (
          <aside className="property-map-panel" aria-label="Property map location">
            <div className="property-map-heading">
              <div>
                <strong>Map location</strong>
                <span>{status === 'located' ? name : 'Chennai, Tamil Nadu'}</span>
              </div>
              {status === 'located' ? <span className="map-pin-status">Located</span> : null}
            </div>
            <div className="property-map-frame">
              <iframe
                title={`Map showing ${status === 'located' ? name : 'Chennai, Tamil Nadu'}`}
                src={mapEmbedUrl(location)}
                loading="lazy"
                referrerPolicy="no-referrer"
              />
              {status !== 'located' ? (
                <div className="property-map-message" role="status">
                  <strong>{status === 'loading' ? 'Locating area…' : 'Unable to locate on map'}</strong>
                  <span>{status === 'loading' ? 'Searching the entered village or address.' : 'Showing Chennai as the city reference.'}</span>
                </div>
              ) : null}
            </div>
            <span className="map-attribution">Map data © OpenStreetMap contributors</span>
          </aside>
  )
}
