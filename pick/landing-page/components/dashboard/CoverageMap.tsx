'use client'

import { useEffect, useRef } from 'react'
import type * as Leaflet from 'leaflet'

export interface CoverageMapZone {
  id: string
  nameEn: string
  nameBn: string
  centerLatitude: number
  centerLongitude: number
  radiusMeters: number
  active: boolean
}

export interface CoverageMapLocation {
  userId: string
  name: string
  email: string
  address: string
  area: string
  updatedAt: string
  latitude: number
  longitude: number
  coverage: { available: boolean; zone: { nameEn: string } | null }
}

interface CoverageMapProps {
  zones: CoverageMapZone[]
  locations: CoverageMapLocation[]
  selectedPoint: { latitude: number; longitude: number } | null
  previewRadius: number
  googleMapsApiKey?: string
  onSelectPoint: (point: { latitude: number; longitude: number }) => void
}

declare global {
  interface Window {
    google?: any
    __tiwloGoogleMapsLoader?: Promise<any>
  }
}

function loadGoogleMapsApi(apiKey: string): Promise<any> {
  if (typeof window === 'undefined' || !apiKey) {
    return Promise.reject(new Error('Google Maps API key unavailable'))
  }
  if (window.google?.maps) {
    return Promise.resolve(window.google.maps)
  }
  if (window.__tiwloGoogleMapsLoader) {
    return window.__tiwloGoogleMapsLoader
  }
  window.__tiwloGoogleMapsLoader = new Promise((resolve, reject) => {
    const script = document.createElement('script')
    script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(apiKey)}`
    script.async = true
    script.defer = true
    script.onload = () => {
      if (window.google?.maps) resolve(window.google.maps)
      else reject(new Error('Google Maps failed to initialize'))
    }
    script.onerror = () => reject(new Error('Could not load Google Maps script'))
    document.head.appendChild(script)
  })
  return window.__tiwloGoogleMapsLoader
}

export function CoverageMap({
  zones,
  locations,
  selectedPoint,
  previewRadius,
  googleMapsApiKey,
  onSelectPoint,
}: CoverageMapProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const leafletMapRef = useRef<Leaflet.Map | null>(null)
  const leafletLayerRef = useRef<Leaflet.LayerGroup | null>(null)
  const googleMapRef = useRef<any>(null)
  const googleOverlaysRef = useRef<any[]>([])
  const onSelectPointRef = useRef(onSelectPoint)
  onSelectPointRef.current = onSelectPoint

  useEffect(() => {
    let active = true
    let leafletMap: Leaflet.Map | null = null
    let clickListener: any = null

    const initLeafletFallback = async () => {
      if (!active || !containerRef.current) return
      const leafletModule = await import('leaflet')
      if (!active || !containerRef.current) return
      const leaflet = leafletModule.default
      leafletMap = leaflet.map(containerRef.current, { scrollWheelZoom: false })
        .setView([20, 0], 2)
      leaflet.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
        maxZoom: 19,
        subdomains: 'abcd',
        attribution: '&copy; OpenStreetMap contributors &copy; CARTO',
      }).addTo(leafletMap)
      const layers = leaflet.layerGroup().addTo(leafletMap)
      leafletMapRef.current = leafletMap
      leafletLayerRef.current = layers
      leafletMap.on('click', (event) => {
        onSelectPointRef.current({
          latitude: event.latlng.lat,
          longitude: event.latlng.lng,
        })
      })
    }

    if (googleMapsApiKey) {
      void loadGoogleMapsApi(googleMapsApiKey)
        .then((gmaps) => {
          if (!active || !containerRef.current) return
          const map = new gmaps.Map(containerRef.current, {
            center: { lat: 20, lng: 0 },
            zoom: 2,
            mapTypeControl: false,
            streetViewControl: false,
            fullscreenControl: true,
          })
          googleMapRef.current = map
          clickListener = map.addListener('click', (event: any) => {
            if (!event?.latLng) return
            onSelectPointRef.current({
              latitude: event.latLng.lat(),
              longitude: event.latLng.lng(),
            })
          })
        })
        .catch(() => initLeafletFallback())
    } else {
      void initLeafletFallback()
    }

    return () => {
      active = false
      if (clickListener && window.google?.maps?.event) {
        window.google.maps.event.removeListener(clickListener)
      }
      googleOverlaysRef.current.forEach((o) => o?.setMap?.(null))
      googleOverlaysRef.current = []
      googleMapRef.current = null
      leafletMap?.remove()
      leafletMapRef.current = null
      leafletLayerRef.current = null
    }
  }, [googleMapsApiKey])

  useEffect(() => {
    const gmap = googleMapRef.current
    if (gmap && window.google?.maps) {
      const gmaps = window.google.maps
      googleOverlaysRef.current.forEach((o) => o?.setMap?.(null))
      googleOverlaysRef.current = []
      const bounds = new gmaps.LatLngBounds()
      let hasPoints = false

      zones.forEach((zone) => {
        const center = { lat: zone.centerLatitude, lng: zone.centerLongitude }
        const circle = new gmaps.Circle({
          map: gmap,
          center,
          radius: zone.radiusMeters,
          strokeColor: zone.active ? '#15803d' : '#71717a',
          strokeOpacity: 0.9,
          strokeWeight: 2,
          fillColor: zone.active ? '#22c55e' : '#a1a1aa',
          fillOpacity: zone.active ? 0.18 : 0.08,
        })
        googleOverlaysRef.current.push(circle)
        bounds.extend(center)
        hasPoints = true
      })

      locations.forEach((location) => {
        const position = { lat: location.latitude, lng: location.longitude }
        const marker = new gmaps.Circle({
          map: gmap,
          center: position,
          radius: 120,
          strokeColor: location.coverage.available ? '#166534' : '#b91c1c',
          strokeWeight: 2,
          fillColor: location.coverage.available ? '#22c55e' : '#ef4444',
          fillOpacity: 0.9,
        })
        const info = new gmaps.InfoWindow({
          content: `<div style="font-size:12px;"><strong>${location.name || 'PICK customer'}</strong><div>${location.address || 'Address not saved'}</div><div>${location.coverage.available ? `Covered: ${location.coverage.zone?.nameEn || 'PICK service area'}` : 'Outside configured coverage'}</div></div>`,
        })
        marker.addListener('click', () => {
          info.setPosition(position)
          info.open(gmap)
        })
        googleOverlaysRef.current.push(marker)
        bounds.extend(position)
        hasPoints = true
      })

      if (selectedPoint) {
        const center = { lat: selectedPoint.latitude, lng: selectedPoint.longitude }
        const preview = new gmaps.Circle({
          map: gmap,
          center,
          radius: previewRadius,
          strokeColor: '#2563eb',
          strokeWeight: 2,
          fillColor: '#3b82f6',
          fillOpacity: 0.15,
        })
        googleOverlaysRef.current.push(preview)
        bounds.extend(center)
        hasPoints = true
      }

      if (hasPoints) {
        gmap.fitBounds(bounds)
      }
      return
    }

    const map = leafletMapRef.current
    const layers = leafletLayerRef.current
    if (!map || !layers) return
    void import('leaflet').then((leafletModule) => {
      if (map !== leafletMapRef.current || layers !== leafletLayerRef.current) return
      const leaflet = leafletModule.default
      layers.clearLayers()
      const bounds: Leaflet.LatLngExpression[] = []

      zones.forEach((zone) => {
        const center: Leaflet.LatLngExpression = [zone.centerLatitude, zone.centerLongitude]
        leaflet.circle(center, {
          radius: zone.radiusMeters,
          color: zone.active ? '#15803d' : '#71717a',
          fillColor: zone.active ? '#22c55e' : '#a1a1aa',
          fillOpacity: zone.active ? 0.18 : 0.08,
          weight: 2,
          dashArray: zone.active ? undefined : '6 6',
        }).bindPopup(`${zone.nameEn} · ${zone.radiusMeters.toLocaleString()} m${zone.active ? '' : ' · inactive'}`)
          .addTo(layers)
        bounds.push(center)
      })

      locations.forEach((location) => {
        const point: Leaflet.LatLngExpression = [location.latitude, location.longitude]
        const marker = leaflet.circleMarker(point, {
          radius: 6,
          color: location.coverage.available ? '#166534' : '#b91c1c',
          fillColor: location.coverage.available ? '#22c55e' : '#ef4444',
          fillOpacity: 0.9,
          weight: 1,
        })
        const popup = document.createElement('div')
        const title = document.createElement('strong')
        title.textContent = location.name || 'PICK customer'
        const address = document.createElement('div')
        address.textContent = location.address || 'Address not saved'
        const status = document.createElement('div')
        status.textContent = location.coverage.available
          ? `Covered: ${location.coverage.zone?.nameEn || 'PICK service area'}`
          : 'Outside configured coverage'
        popup.append(title, address, status)
        marker.bindPopup(popup).addTo(layers)
        bounds.push(point)
      })

      if (selectedPoint) {
        const center: Leaflet.LatLngExpression = [selectedPoint.latitude, selectedPoint.longitude]
        leaflet.circle(center, {
          radius: previewRadius,
          color: '#2563eb',
          fillColor: '#3b82f6',
          fillOpacity: 0.15,
          dashArray: '5 5',
          weight: 2,
        }).addTo(layers)
        leaflet.circleMarker(center, {
          radius: 5,
          color: '#1d4ed8',
          fillColor: '#60a5fa',
          fillOpacity: 1,
        }).addTo(layers)
        bounds.push(center)
      }

      if (bounds.length > 1) map.fitBounds(leaflet.latLngBounds(bounds), { padding: [28, 28], maxZoom: 13 })
      else if (bounds.length === 1) map.setView(bounds[0], 13)
    })
  }, [locations, previewRadius, selectedPoint, zones, googleMapsApiKey])

  return <div ref={containerRef} className="h-[340px] w-full md:h-[460px]" aria-label="Interactive PICK service coverage map" />
}
