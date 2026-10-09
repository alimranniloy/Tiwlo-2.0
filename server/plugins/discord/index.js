import discordRoutes from '../../discord/discordRoutes.js';
import { DiscordDB } from '../../discord/discordDb.js';

export default {
  id: 'discord',
  name: 'Discord Bot & Community Manager',
  version: '1.0.0',
  description: 'Enterprise Discord Bot Management, Server Integrations, Automations & Moderation',

  async init() {
    console.log('[Plugin:Discord] Initializing Discord Bot & Community Gateway...');
    await DiscordDB.init();
  },

  registerRoutes(router) {
    router.use('/', discordRoutes);
  }
};
