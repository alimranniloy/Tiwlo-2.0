'use client'

import React from 'react'
import { AdminFeatureStatus } from './AdminFeatureStatus'

export const BroadcastsView: React.FC = () => (
  <AdminFeatureStatus
    path="/broadcasts"
    title="PICK Push Notifications"
    description="Push notifications require device-token registration and a delivery provider connected to the mobile app."
  />
)
