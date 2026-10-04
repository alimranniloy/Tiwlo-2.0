import whatsappRoutes from '../../whatsapp/whatsappRoutes.js';

export default {
  id: 'whatsapp',
  name: 'WhatsApp Multi-Tenant Smart Bot',
  version: '1.5.0',
  description: 'WhatsApp Baileys multi-device store assistant and auto-reply add-on',

  async init() {
    console.log('[Plugin:WhatsApp] Initializing WhatsApp Bot gateway...');
  },

  registerRoutes(router) {
    router.use('/', whatsappRoutes);
  }
};
