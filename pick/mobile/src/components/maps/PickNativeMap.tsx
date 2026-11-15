import React, { type Ref } from 'react';
import {
  Camera,
  GeoJSONSource,
  Layer,
  Map as MapLibreMap,
  Marker,
  type CameraRef,
} from '@maplibre/maplibre-react-native';
import type { FeatureCollection, LineString } from 'geojson';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { PickIcon } from '../common/PickIcon';

export interface MapPoint {
  latitude: number;
  longitude: number;
}

interface PickNativeMapProps {
  center: MapPoint;
  cameraRef?: Ref<CameraRef>;
  destination?: MapPoint | null;
  initialZoom?: number;
  onMapCenterChange?: (point: MapPoint) => void;
  onMapError?: () => void;
  onMapReady?: () => void;
  onUserInteraction?: () => void;
  pickup?: MapPoint | null;
  route?: readonly MapPoint[];
  showCenterPin?: boolean;
  style?: StyleProp<ViewStyle>;
  rider?: MapPoint | null;
}

const EMPTY_ROUTE: FeatureCollection<LineString> = {
  type: 'FeatureCollection',
  features: [],
};

const mapStyle = 'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json';

export function PickNativeMap({
  center,
  cameraRef,
  destination,
  initialZoom = 14,
  onMapCenterChange,
  onMapError,
  onMapReady,
  onUserInteraction,
  pickup,
  route = [],
  showCenterPin = false,
  style,
  rider,
}: PickNativeMapProps) {
  const routeData: FeatureCollection<LineString> = route.length > 1
    ? {
        type: 'FeatureCollection',
        features: [{
          type: 'Feature',
          properties: {},
          geometry: {
            type: 'LineString',
            coordinates: route.map((point) => [point.longitude, point.latitude]),
          },
        }],
      }
    : EMPTY_ROUTE;

  return (
    <MapLibreMap
      style={[styles.map, style]}
      mapStyle={mapStyle}
      logo
      attribution
      compass={false}
      scaleBar={false}
      androidView="texture"
      onDidFinishLoadingMap={onMapReady}
      onDidFailLoadingMap={onMapError}
      onRegionIsChanging={(event) => {
        if (event.nativeEvent.userInteraction) onUserInteraction?.();
      }}
      onRegionDidChange={(event) => {
        const [longitude, latitude] = event.nativeEvent.center;
        if (Number.isFinite(latitude) && Number.isFinite(longitude)) {
          onMapCenterChange?.({ latitude, longitude });
        }
      }}
    >
      <Camera
        ref={cameraRef}
        initialViewState={{
          center: [center.longitude, center.latitude],
          zoom: initialZoom,
        }}
      />
      {routeData.features.length ? (
        <GeoJSONSource id="delivery-route" data={routeData}>
          <Layer
            id="delivery-route-outline"
            type="line"
            style={{
              lineColor: '#09090B',
              lineWidth: 9,
              lineOpacity: 0.9,
              lineCap: 'round',
              lineJoin: 'round',
            }}
          />
          <Layer
            id="delivery-route-line"
            type="line"
            style={{
              lineColor: '#FAFAFA',
              lineWidth: 4,
              lineOpacity: 0.96,
              lineCap: 'round',
              lineJoin: 'round',
            }}
          />
        </GeoJSONSource>
      ) : null}
      {pickup ? (
        <Marker lngLat={[pickup.longitude, pickup.latitude]} id="pickup-marker">
          <View style={[styles.destinationMarker, styles.pickupMarker]}>
            <View style={styles.pickupCore} />
          </View>
        </Marker>
      ) : null}
      {destination ? (
        <Marker lngLat={[destination.longitude, destination.latitude]} id="destination-marker">
          <View style={styles.destinationMarker}>
            <View style={styles.destinationCore} />
          </View>
        </Marker>
      ) : null}
      {rider ? (
        <Marker lngLat={[rider.longitude, rider.latitude]} id="delivery-partner-marker">
          <View style={styles.riderMarker}>
            <PickIcon name="scooter" size={20} color="#FFFFFF" />
          </View>
        </Marker>
      ) : null}
      {showCenterPin ? (
        <View pointerEvents="none" style={styles.centerPin}>
          <View style={styles.centerPinBubble}>
            <PickIcon name="map-pin" size={21} color="#FFFFFF" />
          </View>
          <View style={styles.centerPinStem} />
        </View>
      ) : null}
    </MapLibreMap>
  );
}

const styles = StyleSheet.create({
  map: {
    flex: 1,
  },
  centerPin: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    alignItems: 'center',
    transform: [{ translateX: -15 }, { translateY: -32 }],
  },
  centerPinBubble: {
    width: 30,
    height: 30,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 15,
    backgroundColor: '#09090B',
    borderWidth: 2,
    borderColor: '#FFFFFF',
    elevation: 4,
  },
  centerPinStem: {
    width: 2,
    height: 8,
    backgroundColor: '#09090B',
    marginTop: -1,
  },
  riderMarker: {
    width: 42,
    height: 42,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 21,
    backgroundColor: '#09090B',
    borderWidth: 3,
    borderColor: '#FFFFFF',
    elevation: 6,
  },
  destinationMarker: {
    width: 25,
    height: 25,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 13,
    backgroundColor: '#FFFFFF',
    borderWidth: 2,
    borderColor: '#09090B',
    elevation: 4,
  },
  destinationCore: {
    width: 9,
    height: 9,
    borderRadius: 5,
    backgroundColor: '#09090B',
  },
  pickupMarker: {
    borderColor: '#FFFFFF',
    backgroundColor: '#09090B',
  },
  pickupCore: {
    width: 9,
    height: 9,
    borderRadius: 2,
    backgroundColor: '#FFFFFF',
  },
});
