import supportRoutes from '../../support/ai/supportRoutes.js';

export default {
  id: 'support-ai',
  name: 'Tiwi AI Support & Autonomous Verification',
  version: '2.0.0',
  description: 'Multi-tier autonomous support agents, user brain diagnostics, and appeal verification team',

  async init() {
    console.log('[Plugin:SupportAI] Initializing Tiwi AI autonomous agents...');
  },

  registerRoutes(router) {
    router.use('/', supportRoutes);
  }
};
