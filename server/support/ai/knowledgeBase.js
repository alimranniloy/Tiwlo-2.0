// ====================================================================
// TIWLO SYSTEM KNOWLEDGE BASE (BRAIN 2: PLATFORM CORE ARCHITECTURE)
// Comprehensive internal knowledge base for Tiwlo Cloud, Multi-Tenancy,
// POS Hardware, Droplet Compute, Network Protocols, and Troubleshooting.
// ====================================================================

export const KnowledgeBaseBrain = {
  platformName: 'Tiwlo Cloud & Multi-Tenant Retail Ecosystem',
  version: '2.5.0-Enterprise',
  slaGuarantee: '99.99% Infrastructure Uptime SLA',

  // 1. Cloud Infrastructure & Droplet Specifications
  cloudSpecs: {
    supportedOS: [
      { name: 'Ubuntu 22.04 LTS', kernel: 'Linux 5.15/6.2', defaultPorts: [22, 80, 443], recommendedFor: 'Node.js, Docker, Python, PostgreSQL' },
      { name: 'Debian 12 Bookworm', kernel: 'Linux 6.1', defaultPorts: [22, 80, 443], recommendedFor: 'Ultra-stable microservices, Redis, Nginx' },
      { name: 'Fedora 39', kernel: 'Linux 6.5', defaultPorts: [22, 80, 443], recommendedFor: 'Cutting-edge Go, Rust, bleeding-edge kernels' },
      { name: 'CentOS Stream 9', kernel: 'Linux 5.14', defaultPorts: [22, 80, 443], recommendedFor: 'Enterprise Java, RHEL compliance workloads' },
      { name: 'Alpine Linux 3.19', kernel: 'Linux 6.6-musl', defaultPorts: [22, 80, 443], recommendedFor: 'Minimal footprint containers, routers' }
    ],
    globalRegions: [
      { code: 'NYC1', name: 'New York Data Center', flag: '🇺🇸', latencyAvg: '18ms', transitProviders: ['Level 3', 'Telia', 'Equinix'] },
      { code: 'FRA1', name: 'Frankfurt Data Center', flag: '🇩🇪', latencyAvg: '24ms', transitProviders: ['DE-CIX', 'Deutsche Telekom'] },
      { code: 'SGP1', name: 'Singapore Data Center', flag: '🇸🇬', latencyAvg: '32ms', transitProviders: ['Singtel', 'Telstra', 'Equinix SG'] },
      { code: 'AMS3', name: 'Amsterdam Data Center', flag: '🇳🇱', latencyAvg: '21ms', transitProviders: ['AMS-IX', 'Lumen'] },
      { code: 'LON1', name: 'London Data Center', flag: '🇬🇧', latencyAvg: '22ms', transitProviders: ['LINX', 'Vodafone'] },
      { code: 'BLR1', name: 'Bangalore Data Center', flag: '🇮🇳', latencyAvg: '38ms', transitProviders: ['Tata Communications', 'Airtel'] }
    ],
    computeTiers: [
      { tier: 'Starter Droplet', vcpu: 1, ram: '2 GB', storage: '50 GB NVMe SSD', bandwidth: '2 TB', hourlyRate: 0.015 },
      { tier: 'Standard Droplet', vcpu: 2, ram: '4 GB', storage: '80 GB NVMe SSD', bandwidth: '4 TB', hourlyRate: 0.030 },
      { tier: 'Production Droplet', vcpu: 4, ram: '8 GB', storage: '160 GB NVMe SSD', bandwidth: '6 TB', hourlyRate: 0.060 },
      { tier: 'High-Mem Cluster', vcpu: 8, ram: '16 GB', storage: '320 GB NVMe SSD', bandwidth: '10 TB', hourlyRate: 0.120 },
      { tier: 'Enterprise CPU-Optimized', vcpu: 16, ram: '32 GB', storage: '640 GB NVMe SSD', bandwidth: '15 TB', hourlyRate: 0.240 }
    ],
    storageType: 'Enterprise Tier-4 NVMe SSD with redundant Ceph cluster replication (3x write redundancy)',
    networking: {
      ipv4: 'Dedicated public IPv4 per droplet with automated reverse DNS (rDNS)',
      ipv6: '/64 IPv6 subnet included standard on every droplet',
      firewall: 'Hardware Cloud Firewall at edge (Stateless packet filtering, syn-flood protection up to 100 Gbps)',
      privateVPC: 'Isolated 10.108.0.0/16 Virtual Private Cloud with zero bandwidth cost between droplets'
    }
  },

  // 2. Multi-Tenant eCommerce Database Architecture
  databaseArchitecture: {
    isolationModel: 'Strict Logical Multi-Tenancy with Tenant ID Partitioning (TIW-XXXXX)',
    storageEngine: 'PostgreSQL 16 Enterprise with JSONB document acceleration and row-level security (RLS)',
    storeIsolationRules: [
      'Each store receives an immutable Tenant ID (e.g. TIW-XXXXX).',
      'All database queries in GraphQL and REST are enforced with WHERE tiwi_id = $tenant_id.',
      'Inventory ledgers, sales records, customer PII, and financial invoices are strictly partitioned.',
      'Cross-tenant data leakage is cryptographically prevented via session tokens and schema separation.',
      'Each tenant can attach custom subdomains (*.tiwlo.com) or apex custom domains with automated Let’s Encrypt wildcard SSL.'
    ]
  },

  // 3. POS Hardware & Omnichannel Retail Integration
  posSpecs: {
    barcodeCompatibility: ['Code128', 'EAN-13', 'UPC-A', 'QR Code', 'DataMatrix'],
    supportedHardware: [
      'Standard USB HID Barcode Scanners (Honeywell, Zebra, Datalogic, generic plug-and-play)',
      'Wireless Bluetooth Scanners (iOS/Android/macOS/Windows HID pairing)',
      'ESC/POS Thermal Receipt Printers (58mm and 80mm roll, USB/Ethernet/Bluetooth)',
      'RJ11/RJ12 Automated Cash Drawers triggered via printer kick-pulse pin 2'
    ],
    offlineMode: 'Local IndexedDB transaction cache synchronizes automatically upon network recovery'
  },

  // 4. Autonomous Support Playbooks & Troubleshooting Guides
  troubleshootingPlaybooks: {
    paymentIssues: {
      symptom: 'Card charged but droplet / store shows pending or inactive',
      diagnosis: 'Webhook synchronization delay between payment gateway (Stripe/SSLCommerz) and Tiwlo billing ledger.',
      resolutionSteps: [
        'Verify transaction intent ID in the billing ledger.',
        'If authorization succeeded, manually reconcile the license state.',
        'Issue a temporary grace access token to ensure zero customer downtime.',
        'Dispatch updated invoice receipt to user email.'
      ]
    },
    dropletUnresponsive: {
      symptom: 'SSH connection timeout, packet loss, or 502 Bad Gateway',
      diagnosis: 'OOM (Out-of-Memory) killer triggered, kernel hang, or firewall port 22 blocked.',
      resolutionSteps: [
        'Inspect live CPU and memory metrics in Cloud Console.',
        'Execute automated graceful ACPI reboot or hard power-cycle if unresponsive.',
        'Inspect /var/log/syslog for memory exhaustion.',
        'Advise allocating 2GB swap space or upgrading droplet tier.'
      ]
    },
    sslCertError: {
      symptom: 'NET::ERR_CERT_COMMON_NAME_INVALID or browser privacy warning',
      diagnosis: 'DNS CNAME not fully propagated or Let\'s Encrypt rate-limit on new domain.',
      resolutionSteps: [
        'Check DNS propagation via global resolver (8.8.8.8).',
        'Verify the A record points to the VPS IP.',
        'Trigger certbot wildcard renewal script.',
        'Certificate automatically updates within 60 seconds.'
      ]
    }
  },

  // 5. Query Knowledge Base for context
  queryKnowledge(topic = '') {
    const t = topic.toLowerCase();
    let relevantInfo = [];

    if (t.includes('droplet') || t.includes('server') || t.includes('ubuntu') || t.includes('cpu') || t.includes('ram')) {
      relevantInfo.push(`Compute OS: ${this.cloudSpecs.supportedOS.map(o => o.name).join(', ')}.`);
      relevantInfo.push(`Regions: ${this.cloudSpecs.globalRegions.map(r => `${r.name} (${r.code})`).join(', ')}.`);
      relevantInfo.push(`Storage: ${this.cloudSpecs.storageType}.`);
    }

    if (t.includes('store') || t.includes('multi-tenant') || t.includes('database') || t.includes('isolation') || t.includes('postgres')) {
      relevantInfo.push(`DB Architecture: ${this.databaseArchitecture.isolationModel}.`);
      relevantInfo.push(`Tenant Rules: ${this.databaseArchitecture.storeIsolationRules.join(' ')}`);
    }

    if (t.includes('pos') || t.includes('barcode') || t.includes('printer') || t.includes('scanner')) {
      relevantInfo.push(`POS Barcodes: ${this.posSpecs.barcodeCompatibility.join(', ')}.`);
      relevantInfo.push(`Supported Hardware: ${this.posSpecs.supportedHardware.join('; ')}.`);
    }

    if (t.includes('payment') || t.includes('charge') || t.includes('invoice') || t.includes('billing')) {
      relevantInfo.push(`Payment Resolution: ${this.troubleshootingPlaybooks.paymentIssues.resolutionSteps.join(' ')}`);
    }

    if (relevantInfo.length === 0) {
      relevantInfo.push(`Tiwlo Enterprise Cloud SLA: 99.99% uptime. Multi-tenant database isolation, global droplet deployments, POS hardware integration.`);
    }

    return relevantInfo.join('\n');
  }
};
