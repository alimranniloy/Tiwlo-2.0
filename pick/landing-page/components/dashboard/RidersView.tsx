'use client'

import React from 'react'
import { AdminFeatureStatus } from './AdminFeatureStatus'

export const RidersView: React.FC = () => (
  <AdminFeatureStatus
    path="/riders"
    title="PICK Delivery Riders"
    description="Rider accounts, assignments, and live fleet activity from a connected PICK rider service."
  />
)
