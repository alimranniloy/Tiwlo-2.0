package com.example.model

enum class AppScreen {
    // 1. Auth
    LOGIN,
    SIGNUP,
    AUTH_VERIFICATION,

    // 2. Main Cloud & Workspace Console (World 1)
    CLOUD,
    CLOUD_DROPLETS,
    CLOUD_CREATE_DROPLET,
    CLOUD_KUBERNETES,
    CLOUD_VOLUMES,
    CLOUD_IMAGES,
    CLOUD_SNAPSHOTS,
    CLOUD_BACKUPS,
    CLOUD_DOMAINS,
    CLOUD_TPANEL,
    CLOUD_FIREWALL,
    CLOUD_SSH_KEYS,
    CLOUD_MARKETPLACE,
    CLOUD_IDENTITY,
    CLOUD_BILLING,
    CLOUD_SETTINGS,
    CLOUD_HELP,
    MOBILE_MENU,

    // 3. Stores Hub & Store Creation (Bridge between Main Console & Store Admin)
    STORES_HUB,
    CREATE_STORE,

    // 4. Separate Store Admin Panel (World 2 - inside an active store like TiwiMart)
    ECOMMERCE,
    STORE_MENU,
    STORE_PRODUCTS,
    STORE_CREATE_PRODUCT,
    STORE_CATEGORIES,
    STORE_POS,
    STORE_TSCAN,
    STORE_INVENTORY,
    STORE_ORDERS,
    STORE_PURCHASES,
    STORE_SUPPLIERS,
    STORE_CUSTOMERS,
    STORE_ANALYTICS,
    STORE_MARKETING,
    STORE_PROMO_CODES,
    STORE_REVIEWS,
    STORE_THEME,
    STORE_PAYMENTS,
    STORE_SHIPPING,
    STORE_STAFF,
    STORE_CHECKLIST,

    // 5. Tiwlo Mail
    EMAIL,
    EMAIL_COMPOSE,

    // 6. OneProfile (UIDs)
    ONEPROFILE,
    ONEPROFILE_SUBDOMAINS,
    ONEPROFILE_TEMPLATES,
    ONEPROFILE_HOSTING,
    ONEPROFILE_NFC,
    ONEPROFILE_ANALYTICS,
    ONEPROFILE_EDIT
}

data class NotificationItem(
    val id: String,
    val title: String,
    val desc: String,
    val time: String,
    val unread: Boolean = true
)

data class ProfileWebsiteItem(
    val title: String,
    val domain: String,
    val views: Int
)

data class StoreInstance(
    val id: String,
    val name: String,
    val domain: String,
    val category: String,
    val currency: String,
    val productsCount: Int,
    val ordersCount: Int,
    val revenueLabel: String,
    val status: String = ""
)

data class DropletItem(
    val id: String,
    val name: String,
    val ip: String,
    val region: String,
    val flag: String,
    val image: String,
    val vcpu: Int,
    val ramGb: Int,
    val diskGb: Int,
    val priceMo: Int,
    val status: String,
    val cpuPercent: Int?
)

data class K8sClusterItem(
    val id: String,
    val name: String,
    val region: String,
    val version: String,
    val nodes: Int,
    val status: String,
    val monthlyCost: Int
)

data class VolumeItem(
    val id: String,
    val name: String,
    val sizeGb: Int,
    val region: String,
    val attachedTo: String
)

data class DomainRecordItem(
    val id: String,
    val domain: String,
    val targetIp: String,
    val sslStatus: String,
    val recordsCount: Int
)

data class SnapshotItem(
    val id: String,
    val name: String,
    val sourceDroplet: String,
    val sizeGb: Double,
    val createdAt: String
)

data class FirewallRuleItem(
    val id: String,
    val direction: String,
    val protocol: String,
    val portRange: String,
    val sources: String,
    val action: String
)

data class SshKeyItem(
    val id: String,
    val name: String,
    val fingerprint: String,
    val addedAt: String
)

data class StoreCategory(
    val id: String,
    val name: String,
    val slug: String,
    val subCategories: List<String>,
    val productCount: Int
)

data class ProductItem(
    val id: String,
    val name: String,
    val sku: String,
    val category: String,
    val priceBdt: Int,
    val stock: Int,
    val status: String,
    val soldCount: Int
)

data class OrderItem(
    val id: String,
    val customer: String,
    val items: Int,
    val totalBdt: Int,
    val payment: String,
    val status: String,
    val date: String,
    val channel: String = "",
    val promoCode: String = ""
)

data class PurchaseOrderItem(
    val id: String,
    val supplier: String,
    val itemsCount: Int,
    val totalBdt: Int,
    val status: String,
    val expectedDate: String
)

data class SupplierItem(
    val id: String,
    val name: String,
    val contactPerson: String,
    val phone: String,
    val city: String,
    val activeSkus: Int
)

data class CustomerItem(
    val id: String,
    val name: String,
    val phone: String,
    val totalOrders: Int,
    val totalSpentBdt: Int,
    val lastOrder: String
)

data class PromoCodeItem(
    val id: String,
    val code: String,
    val discount: String,
    val uses: Int,
    val status: String
)

data class ProductReviewItem(
    val id: String,
    val productName: String,
    val customer: String,
    val rating: Int,
    val comment: String,
    val date: String
)

data class StaffMemberItem(
    val id: String,
    val name: String,
    val role: String,
    val email: String,
    val status: String
)

data class EmailAttachment(
    val name: String,
    val size: String,
    val type: String
)

data class EmailMessage(
    val id: String,
    val sender: String,
    val senderEmail: String,
    val avatar: String,
    val subject: String,
    val preview: String,
    val body: List<String>,
    val time: String,
    val date: String,
    val unread: Boolean,
    val starred: Boolean,
    val category: String,
    val folder: String,
    val attachments: List<EmailAttachment> = emptyList()
)
