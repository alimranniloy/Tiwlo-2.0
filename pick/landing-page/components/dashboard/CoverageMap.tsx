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
  onSelectPoint: (point: { latitude: number; longitude: number }) => void
}

export function CoverageMap({
  zones,
  locations,
  selectedPoint,
  previewRadius,
  onSelectPoint,
}: CoverageMapProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<Leaflet.Map | null>(null)
  const layerRef = useRef<Leaflet.LayerGroup | null>(null)
  const onSelectPointRef = useRef(onSelectPoint)
  onSelectPointRef.current = onSelectPoint

  useEffect(() => {
    let active = true
    let map: Leaflet.Map | null = null
    void import('leaflet').then((leafletModule) => {
      if (!active || !containerRef.current) return
      const leaflet = leafletModule.default
      map = leaflet.map(containerRef.current, { scrollWheelZoom: false })
        .setView([23.8103, 90.4125], 11)
      leaflet.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '&copy; OpenStreetMap contributors',
      }).addTo(map)
      const layers = leaflet.layerGroup().addTo(map)
      mapRef.current = map
      layerRef.current = layers
      map.on('click', (event) => {
        onSelectPointRef.current({
          latitude: event.latlng.lat,
          longitude: event.latlng.lng,
        })
      })
    })
    return () => {
      active = false
      map?.remove()
      mapRef.current = null
      layerRef.current = null
    }
  }, [])

  useEffect(() => {
    const map = mapRef.current
    const layers = layerRef.current
    if (!map || !layers) return
    void import('leaflet').then((leafletModule) => {
      if (map !== mapRef.current || layers !== layerRef.current) return
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
  }, [locations, previewRadius, selectedPoint, zones])

  return <div ref={containerRef} className="h-[340px] w-full md:h-[460px]" aria-label="Interactive PICK service coverage map" />
}
