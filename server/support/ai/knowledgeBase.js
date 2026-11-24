import { PLATFORM_CONFIG } from '../../config/platformConfig.js';

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
      { name: 'Ubuntu 24.04 LTS', kernel: 'Linux 6.8', defaultPorts: [22, 80, 443], recommendedFor: 'Node.js, Docker, Python, PostgreSQL, Nginx' },
      { name: 'Ubuntu 22.04 LTS', kernel: 'Linux 5.15/6.2', defaultPorts: [22, 80, 443], recommendedFor: 'Node.js, Docker, Python, PostgreSQL' },
      { name: 'Debian 12 Bookworm', kernel: 'Linux 6.1', defaultPorts: [22, 80, 443], recommendedFor: 'Ultra-stable microservices, Redis, Nginx' },
      { name: 'Fedora 40', kernel: 'Linux 6.8', defaultPorts: [22, 80, 443], recommendedFor: 'Cutting-edge Go, Rust, modern toolchains' },
      { name: 'AlmaLinux 9', kernel: 'Linux 5.14', defaultPorts: [22, 80, 443], recommendedFor: 'Enterprise Java, RHEL compliance workloads' }
    ],
    globalRegions: [
      { code: 'DHK1', name: 'Dhaka Data Center', flag: '🇧🇩', latencyAvg: '12ms', transitProviders: ['BTCL', 'Summit', 'Fiber@Home'] },
      { code: 'SGP1', name: 'Singapore Data Center', flag: '🇸🇬', latencyAvg: '32ms', transitProviders: ['Singtel', 'Telstra', 'Equinix SG'] },
      { code: 'FRA1', name: 'Frankfurt Data Center', flag: '🇩🇪', latencyAvg: '24ms', transitProviders: ['DE-CIX', 'Deutsche Telekom'] },
      { code: 'NYC1', name: 'New York Data Center', flag: '🇺🇸', latencyAvg: '18ms', transitProviders: ['Level 3', 'Telia', 'Equinix'] },
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
      ipv6: '/64 IPv6 subnet included standard on every droplet (toggleable inside My Droplets)',
      browserSsh: 'Built-in Browser SSH terminal directly inside each Droplet detail view (/cloud/droplets)',
      firewall: 'Hardware Cloud Firewall at edge (inbound/outbound rules, SSH/HTTP/HTTPS ports, syn-flood protection)',
      monitoring: 'Lifetime CPU, RAM, Disk I/O, and Network throughput charts per Droplet',
      privateVPC: 'Isolated 10.108.0.0/16 Virtual Private Cloud with zero bandwidth cost between droplets',
      nameservers: ['dns1.tiwlo.com', 'dns2.tiwlo.com']
    }
  },

  // 1b. Tiwlo Cloud Navigation & Bilingual Knowledge Guides
  cloudRoutesAndGuides: {
    deployDroplet: {
      route: '/cloud/create-droplet',
      labelEn: 'Create Droplet',
      labelBn: 'নতুন ড্রপলেট তৈরি করুন',
      en: [
        '1. Open [Create Droplet](/cloud/create-droplet) (`/cloud/create-droplet`).',
        '2. Choose your OS Image (e.g., Ubuntu 24.04 LTS) and preferred datacenter region.',
        '3. Select or customize your vCPU, RAM, and NVMe SSD plan.',
        '4. Set your hostname, optional SSH key / root password, and enable IPv6 if needed.',
        '5. Click **Create Droplet** to deploy your VPS in seconds.'
      ].join(' '),
      bn: [
        '১. [Create Droplet](/cloud/create-droplet) (`/cloud/create-droplet`) পেজে যান।',
        '২. পছন্দের OS ইমেজ (যেমন Ubuntu 24.04 LTS) ও ডেটাসেন্টার রিজিওন নির্বাচন করুন।',
        '৩. আপনার প্রয়োজন অনুযায়ী vCPU, RAM ও NVMe SSD প্ল্যান বেছে নিন বা কাস্টমাইজ করুন।',
        '৪. Hostname, SSH Key/রুট পাসওয়ার্ড এবং প্রয়োজনে IPv6 সেট করুন।',
        '৫. **Create Droplet** বাটনে ক্লিক করলে কয়েক সেকেন্ডের মধ্যেই আপনার VPS ডিপ্লয় হয়ে যাবে।'
      ].join(' ')
    },
    manageVps: {
      route: '/cloud/droplets',
      labelEn: 'My Droplets',
      labelBn: 'আমার ড্রপলেটসমূহ',
      en: [
        'Open [My Droplets](/cloud/droplets) (`/cloud/droplets`) and click any VPS instance to:',
        '• View **Lifetime CPU, Memory & Network charts**',
        '• Launch **Browser SSH** directly without a local terminal',
        '• Manage **IPv4 & IPv6 networking**',
        '• Configure **Cloud Firewall** inbound/outbound port rules (22, 80, 443)',
        '• Power On/Off, Reboot, Rename, or Destroy the Droplet. (Note: TPanel & File Manager are currently disabled/unavailable; use Browser SSH from My Droplets.)'
      ].join('\n'),
      bn: [
        '[My Droplets](/cloud/droplets) (`/cloud/droplets`) পেজে গিয়ে যেকোনো VPS-এ ক্লিক করলে আপনি পাবেন:',
        '• **Lifetime CPU, Memory ও Network গ্রাফ/চার্ট**',
        '• সরাসরি **Browser SSH** টার্মিনাল অ্যাক্সেস',
        '• **IPv4 ও IPv6 নেটওয়ার্কিং** ম্যানেজমেন্ট',
        '• **Cloud Firewall** রুলস (Port 22, 80, 443 ইত্যাদি)',
        '• সার্ভার চালু/বন্ধ, রিবুট ও রিনেম করার সুবিধা। (দ্রষ্টব্য: TPanel ও File Manager বর্তমানে নিষ্ক্রিয় আছে; ফাইল ও সার্ভার নিয়ন্ত্রণের জন্য Browser SSH ব্যবহার করুন।)'
      ].join('\n')
    },
    domainsAndSsl: {
      route: '/domains',
      labelEn: 'Domains & DNS',
      labelBn: 'ডোমেইন ও ডিএনএস',
      en: [
        '1. Open [Domains & DNS](/domains) (`/domains`) and add your custom domain.',
        '2. At your domain registrar, point your nameservers to **dns1.tiwlo.com** and **dns2.tiwlo.com**.',
        '3. Connect the domain to your Droplet VPS by adding an `A` record pointing to your VPS IPv4 (and `AAAA` record for IPv6).',
        '4. For self-managed VPS SSL, open **Browser SSH** in [My Droplets](/cloud/droplets) and run `sudo certbot --nginx -d yourdomain.com` (Let\'s Encrypt) after DNS propagates.'
      ].join('\n'),
      bn: [
        '১. [Domains & DNS](/domains) (`/domains`) পেজে গিয়ে আপনার কাস্টম ডোমেইন যোগ করুন।',
        '২. ডোমেইন রেজিস্ট্রারে গিয়ে Nameserver হিসেবে **dns1.tiwlo.com** এবং **dns2.tiwlo.com** সেট করুন।',
        '৩. ডোমেইনটি VPS-এর সাথে যুক্ত করতে আপনার Droplet-এর IPv4 ঠিকানায় `A` রেকর্ড (এবং IPv6 থাকলে `AAAA` রেকর্ড) যোগ করুন।',
        '৪. Self-managed VPS SSL-এর জন্য DNS প্রোপাগেট হলে [My Droplets](/cloud/droplets) থেকে **Browser SSH** খুলে `sudo certbot --nginx -d yourdomain.com` (Let\'s Encrypt) চালান।'
      ].join('\n')
    },
    billingAndWallet: {
      route: '/billing',
      labelEn: 'Cloud Billing & Wallet',
      labelBn: 'বিলিং ও ওয়ালেট',
      en: 'Open [Cloud Billing & Wallet](/billing) (`/billing`) to view monthly VPS billing cycles, top up your Cloud Wallet credits, manage payment methods, and download itemized invoices.',
      bn: '[Cloud Billing & Wallet](/billing) (`/billing`) পেজ থেকে আপনি মাসিক VPS বিলিং দেখতে, Cloud Wallet-এ ক্রেডিট টপ-আপ (Top-Up) করতে এবং সকল ইনভয়েস ডাউনলোড করতে পারবেন।'
    },
    cloudFeatures: {
      images: { route: '/cloud/images', en: '**Images** ([/cloud/images](/cloud/images)): Curated Linux OS distributions (such as Ubuntu 24.04 LTS) and templates used as the base system when deploying a Droplet.', bn: '**Images** ([/cloud/images](/cloud/images)): নতুন ড্রপলেট তৈরির জন্য প্রস্তুত Linux অপারেটিং সিস্টেম (যেমন Ubuntu 24.04 LTS) ও অ্যাপ্লিকেশন টেমপ্লেট।' },
      snapshots: { route: '/cloud/snapshots', en: '**Snapshots** ([/cloud/snapshots](/cloud/snapshots)): On-demand point-in-time disk captures of a Droplet — ideal before major updates or cloning a server.', bn: '**Snapshots** ([/cloud/snapshots](/cloud/snapshots)): যেকোনো সময় আপনার VPS ডিস্কের তাৎক্ষণিক কপি (Point-in-time capture) নেওয়ার সুবিধা — বড় আপডেটের আগে বা সার্ভার ক্লোন করতে দারুণ কার্যকর।' },
      backups: { route: '/cloud/backups', en: '**Backups** ([/cloud/backups](/cloud/backups)): Automated scheduled disk backups for disaster recovery and quick rollback.', bn: '**Backups** ([/cloud/backups](/cloud/backups)): নির্দিষ্ট সময় পরপর স্বয়ংক্রিয়ভাবে সার্ভার ব্যাকআপ রাখার ব্যবস্থা, যাতে যেকোনো সমস্যায় দ্রুত রিস্টোর করা যায়।' },
      volumes: { route: '/cloud/volumes', en: '**Volumes** ([/cloud/volumes](/cloud/volumes)): Attachable, resizable NVMe block storage disks you can mount to Droplets independently of OS disk size.', bn: '**Volumes** ([/cloud/volumes](/cloud/volumes)): অতিরিক্ত হাই-স্পিড NVMe ব্লক স্টোরেজ, যা ড্রপলেটে যুক্ত করে আলাদাভাবে স্টোরেজ বাড়ানো যায়।' },
      kubernetes: { route: '/cloud/kubernetes', en: '**Kubernetes** ([/cloud/kubernetes](/cloud/kubernetes)): Managed container orchestration clusters for scaling containerized apps with automated node management.', bn: '**Kubernetes** ([/cloud/kubernetes](/cloud/kubernetes)): কন্টেইনারাইজড অ্যাপ্লিকেশন অটো-স্কেলিং ও ম্যানেজমেন্টের জন্য ম্যানেজড কুবারনেটিস ক্লাস্টার।' }
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
      `Each tenant receives a platform subdomain (*.${PLATFORM_CONFIG.storeDomain}). Eligible plans can register a custom domain, prove ownership with DNS TXT, point an A record to the platform server, and request an apex Let’s Encrypt certificate.`
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

  // 5. Query Knowledge Base for context (English + Bengali aware)
  queryKnowledge(topic = '') {
    const t = String(topic || '').toLowerCase();
    let relevantInfo = [];

    if (/droplet|vps|server|ubuntu|cpu|ram|ssh|ipv6|firewall|deploy|create|chart|monitor|ড্রপলেট|ভিপিএস|সার্ভার|ডিপ্লয়|তৈরি|এসএসএইচ|আইপিভি৬|ফায়ারওয়াল|ফায়ারওয়াল|চার্ট|সিপইউ/.test(t)) {
      relevantInfo.push(`Deploy Droplet Route (/cloud/create-droplet): ${this.cloudRoutesAndGuides.deployDroplet.en}`);
      relevantInfo.push(`Manage VPS Route (/cloud/droplets): ${this.cloudRoutesAndGuides.manageVps.en}`);
      relevantInfo.push(`Compute OS: ${this.cloudSpecs.supportedOS.map(o => o.name).join(', ')}.`);
      relevantInfo.push(`Regions: ${this.cloudSpecs.globalRegions.map(r => `${r.name} (${r.code})`).join(', ')}.`);
      relevantInfo.push(`Storage: ${this.cloudSpecs.storageType}.`);
    }

    if (/domain|dns|nameserver|ssl|https|certbot|cname|record|ডোমেইন|ডিএনএস|নেমসার্ভার|এসএসএল/.test(t)) {
      relevantInfo.push(`Domains & Self-Managed VPS SSL Route (/domains): ${this.cloudRoutesAndGuides.domainsAndSsl.en}`);
    }

    if (/image|snapshot|backup|volume|kubernetes|k8s|cluster|storage|disk|ইমেজ|স্ন্যাপশট|ব্যাকআপ|ভলিউম|কুবারনেটিস/.test(t)) {
      const f = this.cloudRoutesAndGuides.cloudFeatures;
      relevantInfo.push(`Cloud Infrastructure Features: ${f.images.en} | ${f.snapshots.en} | ${f.backups.en} | ${f.volumes.en} | ${f.kubernetes.en}`);
    }

    if (/tpanel|file manager|ফাইল ম্যানেজার|টিপ্যানেল/.test(t)) {
      relevantInfo.push(`TPanel Control Panel & File Manager are currently disabled/unavailable. Guide users to /cloud/droplets to manage their VPS and open Browser SSH instead.`);
    }

    if (/store|multi-tenant|database|isolation|postgres|স্টোর|দোকান/.test(t)) {
      relevantInfo.push(`DB Architecture: ${this.databaseArchitecture.isolationModel}.`);
      relevantInfo.push(`Tenant Rules: ${this.databaseArchitecture.storeIsolationRules.join(' ')}`);
    }

    if (/pos|barcode|printer|scanner|পস|বারকোড|প্রিন্টার/.test(t)) {
      relevantInfo.push(`POS Barcodes: ${this.posSpecs.barcodeCompatibility.join(', ')}.`);
      relevantInfo.push(`Supported Hardware: ${this.posSpecs.supportedHardware.join('; ')}.`);
    }

    if (/payment|charge|invoice|billing|wallet|top-up|topup|credit|বিল|পেমেন্ট|ওয়ালেট|ওয়ালেট|ইনভয়েস|ইনভয়েস|ক্রেডিট/.test(t)) {
      relevantInfo.push(`Monthly VPS Billing, Wallet Top-Up & Invoices Route (/billing): ${this.cloudRoutesAndGuides.billingAndWallet.en}`);
      relevantInfo.push(`Payment Resolution: ${this.troubleshootingPlaybooks.paymentIssues.resolutionSteps.join(' ')}`);
    }

    if (relevantInfo.length === 0) {
      relevantInfo.push(`Tiwlo Cloud Routes: Deploy Droplet (/cloud/create-droplet), My Droplets / Browser SSH / IPv6 / Firewall / Lifetime CPU Charts (/cloud/droplets), Domains & DNS (/domains with dns1.tiwlo.com & dns2.tiwlo.com), Billing & Wallet (/billing), Images (/cloud/images), Snapshots (/cloud/snapshots), Backups (/cloud/backups), Volumes (/cloud/volumes), Kubernetes (/cloud/kubernetes).`);
    }

    return relevantInfo.join('\n');
  }
};
