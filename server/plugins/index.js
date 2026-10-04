import express from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Tiwlo Enterprise Plugin & Add-On Architecture Manager
 * 
 * Provides dynamic registration, lifecycle discovery, and router mounting
 * for system plugins and add-on extensions adhering to Rule 6.
 */
class PluginManager {
  constructor() {
    this.plugins = new Map();
    this.pluginRouter = express.Router();
  }

  /**
   * Register a plugin definition
   * @param {Object} plugin 
   * @param {string} plugin.id - Unique plugin identifier
   * @param {string} plugin.name - Human-readable plugin name
   * @param {string} plugin.version - Semantic version string
   * @param {Function} [plugin.init] - Initialization lifecycle hook (async)
   * @param {Function} [plugin.registerRoutes] - Mounts routes onto express router
   */
  async registerPlugin(plugin) {
    if (!plugin || !plugin.id) {
      throw new Error('[PluginManager] Invalid plugin registration: missing plugin.id');
    }

    if (this.plugins.has(plugin.id)) {
      console.warn(`[PluginManager] Plugin "${plugin.id}" is already registered. Skipping duplicate.`);
      return;
    }

    try {
      if (typeof plugin.init === 'function') {
        await plugin.init();
      }

      if (typeof plugin.registerRoutes === 'function') {
        const subRouter = express.Router();
        plugin.registerRoutes(subRouter);
        this.pluginRouter.use(`/${plugin.id}`, subRouter);
      }

      this.plugins.set(plugin.id, {
        id: plugin.id,
        name: plugin.name || plugin.id,
        version: plugin.version || '1.0.0',
        description: plugin.description || '',
        status: 'active',
        loadedAt: new Date().toISOString()
      });

      console.log(`[PluginManager] Successfully loaded plugin: ${plugin.name} (v${plugin.version || '1.0.0'})`);
    } catch (err) {
      console.error(`[PluginManager] Failed to initialize plugin "${plugin.id}":`, err.message);
      this.plugins.set(plugin.id, {
        id: plugin.id,
        name: plugin.name || plugin.id,
        version: plugin.version || '1.0.0',
        status: 'error',
        error: err.message
      });
    }
  }

  /**
   * Get all registered plugins metadata
   */
  getRegisteredPlugins() {
    return Array.from(this.plugins.values());
  }

  /**
   * Get Express router for all active plugins
   */
  getRouter() {
    return this.pluginRouter;
  }
}

export const pluginManager = new PluginManager();
export default pluginManager;
