import express from 'express';
import tpanelRoutes from '../../../service/TPanel/server/tpanelRoutes.js';

export default {
  id: 'tpanel',
  name: 'TPanel Cloud Web Hosting Manager',
  version: '2.4.0',
  description: 'Enterprise virtual hosting and droplet manager add-on',

  async init() {
    console.log('[Plugin:TPanel] Initializing TPanel Hosting Engine...');
  },

  registerRoutes(router) {
    router.use('/', tpanelRoutes);
  }
};
