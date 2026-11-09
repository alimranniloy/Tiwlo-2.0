'use client'

import React from 'react'
import { AdminFeatureStatus } from './AdminFeatureStatus'

export const PromotionsView: React.FC = () => (
  <AdminFeatureStatus
    path="/promotions"
    title="PICK Promotions"
    description="Coupons can be managed here after PICK checkout is connected to a promotion service."
  />
)
