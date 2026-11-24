import { SHARED_UBUNTU_RUNTIME_IMAGE } from '../ubuntu/constants.js';

export const DROPLET_IMAGE_CATALOG = Object.freeze([
  {
    id: 'ubuntu-24',
    name: 'Ubuntu 24.04 LTS',
    os: 'Ubuntu',
    version: '24.04 LTS · Noble Numbat',
    type: 'os',
    badge: 'Available',
    iconUrl: '/os-icons/ubuntu.svg',
    runtimeImage: SHARED_UBUNTU_RUNTIME_IMAGE,
    available: true
  },
  {
    id: 'ubuntu-22',
    name: 'Ubuntu 22.04 LTS',
    os: 'Ubuntu',
    version: '22.04 Jammy Jellyfish',
    type: 'os',
    iconUrl: '/os-icons/ubuntu.svg',
    available: false
  },
  {
    id: 'debian-12',
    name: 'Debian 12',
    os: 'Debian',
    version: 'Bookworm Stable',
    type: 'os',
    iconUrl: '/os-icons/debian.svg',
    available: false
  },
  {
    id: 'almalinux-9',
    name: 'AlmaLinux 9',
    os: 'AlmaLinux',
    version: 'RHEL 9 Binary Compatible',
    type: 'os',
    iconUrl: '/os-icons/almalinux.svg',
    available: false
  },
  {
    id: 'fedora-40',
    name: 'Fedora 40',
    os: 'Fedora',
    version: 'Cloud Base Edition',
    type: 'os',
    iconUrl: '/os-icons/fedora.svg',
    available: false
  },
  {
    id: 'app-docker',
    name: 'Docker on Ubuntu',
    os: 'Docker',
    version: 'Docker CE + Compose Ready',
    type: 'app',
    iconUrl: '/os-icons/docker.svg',
    available: false
  },
  {
    id: 'app-lemp',
    name: 'LEMP High-Performance',
    os: 'LEMP',
    version: 'Nginx + PostgreSQL + PHP 8.3',
    type: 'app',
    iconUrl: '/os-icons/nginx.svg',
    available: false
  },
  {
    id: 'app-tpanel',
    name: 'TPanel 1.0 Web Host',
    os: 'TPanel',
    version: 'Deprecated / Disabled',
    type: 'app',
    iconUrl: '/tiwlo-icon.png',
    available: false
  }
]);

export const DROPLET_REGION_CATALOG = Object.freeze([
  { id: 'dhk1', name: 'Dhaka', country: 'Bangladesh', flag: '🇧🇩', flagUrl: '/flags/bd.svg', code: 'DHK1' },
  { id: 'sgp1', name: 'Singapore', country: 'Singapore', flag: '🇸🇬', flagUrl: '/flags/sg.svg', code: 'SGP1' },
  { id: 'fra1', name: 'Frankfurt', country: 'Germany', flag: '🇩🇪', flagUrl: '/flags/de.svg', code: 'FRA1' },
  { id: 'nyc1', name: 'New York', country: 'United States', flag: '🇺🇸', flagUrl: '/flags/us.svg', code: 'NYC1' },
  { id: 'lon1', name: 'London', country: 'United Kingdom', flag: '🇬🇧', flagUrl: '/flags/gb.svg', code: 'LON1' },
  { id: 'tyo1', name: 'Tokyo', country: 'Japan', flag: '🇯🇵', flagUrl: '/flags/jp.svg', code: 'TYO1' },
  { id: 'tor1', name: 'Toronto', country: 'Canada', flag: '🇨🇦', flagUrl: '/flags/ca.svg', code: 'TOR1' }
]);
