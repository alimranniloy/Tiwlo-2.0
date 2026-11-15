package com.example.ui.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.outlined.ArrowForward
import androidx.compose.material.icons.outlined.Add
import androidx.compose.material.icons.outlined.AddCircleOutline
import androidx.compose.material.icons.outlined.Category
import androidx.compose.material.icons.outlined.CheckCircle
import androidx.compose.material.icons.outlined.Inventory2
import androidx.compose.material.icons.outlined.Payments
import androidx.compose.material.icons.outlined.PointOfSale
import androidx.compose.material.icons.outlined.QrCodeScanner
import androidx.compose.material.icons.outlined.ReceiptLong
import androidx.compose.material.icons.outlined.ShoppingBag
import androidx.compose.material.icons.outlined.ShoppingCart
import androidx.compose.material.icons.outlined.Storefront
import androidx.compose.material.icons.outlined.TrendingUp
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.example.model.AppScreen
import com.example.ui.components.CardHeader
import com.example.ui.components.DashboardShell
import com.example.ui.components.DonutRingChart
import com.example.ui.components.DonutSegment
import com.example.ui.components.GroupedBarChart
import com.example.ui.components.PageHeader
import com.example.ui.components.ProgressBarMeter
import com.example.ui.components.SegmentedPeriodToggle
import com.example.ui.components.ShadcnCard
import com.example.ui.components.ShadcnInput
import com.example.ui.components.ShadcnOutlineButton
import com.example.ui.components.ShadcnPrimaryButton
import com.example.ui.components.SparklineTrend
import com.example.ui.components.StatCard
import com.example.ui.components.StatusPill
import com.example.ui.components.StatusTone
import com.example.ui.components.StoreDashboardShell
import com.example.ui.theme.FigtreeFontFamily
import com.example.ui.theme.JetBrainsMonoFontFamily
import com.example.ui.theme.ShadcnAmber
import com.example.ui.theme.ShadcnBackground
import com.example.ui.theme.ShadcnBlue
import com.example.ui.theme.ShadcnBorder
import com.example.ui.theme.ShadcnDestructive
import com.example.ui.theme.ShadcnForeground
import com.example.ui.theme.ShadcnInk
import com.example.ui.theme.ShadcnMuted
import com.example.ui.theme.ShadcnMutedForeground
import com.example.ui.theme.ShadcnPrimary
import com.example.ui.theme.ShadcnPrimaryDark
import com.example.viewmodel.TiwloUiState

/**
 * 1. Online Stores Hub (`AppScreen.STORES_HUB`)
 * Shown when the user taps "Stores" in the Main Console Bottom Bar or Main Menu.
 * Displays a prominent "Create Store" card at the top and the user's existing stores
 * below it. Clicking a store enters its separate Store Admin Dashboard.
 */
@Composable
fun StoresHubScreen(
    uiState: TiwloUiState,
    onNavigate: (AppScreen) -> Unit,
    onOpenCreateStore: () -> Unit,
    onEnterStoreDashboard: (String) -> Unit,
    onMarkAllNotificationsRead: () -> Unit,
    onNotificationClick: (String) -> Unit
) {
    DashboardShell(
        currentScreen = AppScreen.STORES_HUB,
        screenTitle = "Online Stores",
        screenSubtitle = "Create a store or open Store Admin",
        isSubPage = false,
        unreadNotificationCount = uiState.notifications.count { it.unread },
        notifications = uiState.notifications,
        onNavigate = onNavigate,
        onMarkAllNotificationsRead = onMarkAllNotificationsRead,
        onNotificationClick = onNotificationClick
    ) { innerPadding ->
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(innerPadding)
                .verticalScroll(rememberScrollState())
                .padding(horizontal = 16.dp, vertical = 16.dp),
            verticalArrangement = Arrangement.spacedBy(16.dp)
        ) {
            PageHeader(
                title = "Your Commerce Stores",
                subtitle = "Launch a new e-commerce storefront or enter an existing store's admin panel."
            )

            // Prominent "Create Store" Card at the top
            ShadcnCard {
                Column(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(18.dp),
                    verticalArrangement = Arrangement.spacedBy(12.dp)
                ) {
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Row(
                            verticalAlignment = Alignment.CenterVertically,
                            horizontalArrangement = Arrangement.spacedBy(12.dp)
                        ) {
                            Box(
                                modifier = Modifier
                                    .size(44.dp)
                                    .clip(RoundedCornerShape(12.dp))
                                    .background(ShadcnPrimary.copy(alpha = 0.16f)),
                                contentAlignment = Alignment.Center
                            ) {
                                Icon(
                                    imageVector = Icons.Outlined.AddCircleOutline,
                                    contentDescription = "Create New Store",
                                    tint = ShadcnPrimaryDark,
                                    modifier = Modifier.size(22.dp)
                                )
                            }
                            Column {
                                Text(
                                    text = "Create a New Online Store",
                                    fontFamily = FigtreeFontFamily,
                                    fontWeight = FontWeight.Bold,
                                    fontSize = 16.sp,
                                    color = ShadcnForeground
                                )
                                Text(
                                    text = "Includes Storefront, POS, QR T-Scan & Inventory",
                                    fontFamily = FigtreeFontFamily,
                                    fontSize = 12.sp,
                                    color = ShadcnMutedForeground
                                )
                            }
                        }
                    }

                    ShadcnPrimaryButton(
                        text = "+ Create Store",
                        icon = Icons.Outlined.Storefront,
                        onClick = onOpenCreateStore,
                        modifier = Modifier
                            .fillMaxWidth()
                            .testTag("open_create_store_button")
                    )
                }
            }

            // Section Title for Active Stores
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(top = 4.dp),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Text(
                    text = "ACTIVE STORES (${uiState.stores.size})",
                    fontFamily = JetBrainsMonoFontFamily,
                    fontWeight = FontWeight.SemiBold,
                    fontSize = 11.sp,
                    color = ShadcnMutedForeground,
                    letterSpacing = 1.sp
                )
                StatusPill(text = "Store overview", tone = StatusTone.SLATE)
            }

            // Existing stores returned by the account API
            uiState.stores.forEach { store ->
                ShadcnCard(
                    modifier = Modifier
                        .clickable { onEnterStoreDashboard(store.id) }
                        .testTag("store_card_${store.id}")
                ) {
                    Column(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(18.dp),
                        verticalArrangement = Arrangement.spacedBy(14.dp)
                    ) {
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.SpaceBetween,
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Row(
                                verticalAlignment = Alignment.CenterVertically,
                                horizontalArrangement = Arrangement.spacedBy(12.dp)
                            ) {
                                Box(
                                    modifier = Modifier
                                        .size(46.dp)
                                        .clip(RoundedCornerShape(12.dp))
                                        .background(ShadcnInk),
                                    contentAlignment = Alignment.Center
                                ) {
                                    Icon(
                                        imageVector = Icons.Outlined.Storefront,
                                        contentDescription = store.name,
                                        tint = ShadcnPrimary,
                                        modifier = Modifier.size(22.dp)
                                    )
                                }
                                Column {
                                    Row(
                                        verticalAlignment = Alignment.CenterVertically,
                                        horizontalArrangement = Arrangement.spacedBy(8.dp)
                                    ) {
                                        Text(
                                            text = store.name,
                                            fontFamily = FigtreeFontFamily,
                                            fontWeight = FontWeight.Bold,
                                            fontSize = 17.sp,
                                            color = ShadcnForeground
                                        )
                                    }
                                    Text(
                                        text = "${store.domain} · ${store.category}",
                                        fontFamily = JetBrainsMonoFontFamily,
                                        fontSize = 11.sp,
                                        color = ShadcnMutedForeground
                                    )
                                }
                            }
                            StatusPill(
                                text = store.status.ifBlank { "Status unavailable" },
                                tone = if (store.status.equals("live", ignoreCase = true) ||
                                    store.status.equals("active", ignoreCase = true)
                                ) StatusTone.GREEN else StatusTone.SLATE,
                                showDot = true
                            )
                        }

                        HorizontalDivider(color = ShadcnBorder, thickness = 1.dp)

                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.SpaceBetween
                        ) {
                            Column {
                                Text(
                                    text = "Total Revenue",
                                    fontFamily = FigtreeFontFamily,
                                    fontSize = 11.sp,
                                    color = ShadcnMutedForeground
                                )
                                Text(
                                    text = store.revenueLabel,
                                    fontFamily = FigtreeFontFamily,
                                    fontWeight = FontWeight.Bold,
                                    fontSize = 15.sp,
                                    color = ShadcnForeground
                                )
                            }
                            Column {
                                Text(
                                    text = "Products",
                                    fontFamily = FigtreeFontFamily,
                                    fontSize = 11.sp,
                                    color = ShadcnMutedForeground
                                )
                                Text(
                                    text = "${store.productsCount} SKUs",
                                    fontFamily = JetBrainsMonoFontFamily,
                                    fontWeight = FontWeight.SemiBold,
                                    fontSize = 13.sp,
                                    color = ShadcnForeground
                                )
                            }
                            Column {
                                Text(
                                    text = "Orders",
                                    fontFamily = FigtreeFontFamily,
                                    fontSize = 11.sp,
                                    color = ShadcnMutedForeground
                                )
                                Text(
                                    text = "${store.ordersCount} Orders",
                                    fontFamily = JetBrainsMonoFontFamily,
                                    fontWeight = FontWeight.SemiBold,
                                    fontSize = 13.sp,
                                    color = ShadcnForeground
                                )
                            }
                        }

                        Row(
                            modifier = Modifier
                                .fillMaxWidth()
                                .height(40.dp)
                                .clip(RoundedCornerShape(10.dp))
                                .background(ShadcnInk)
                                .clickable { onEnterStoreDashboard(store.id) }
                                .testTag("enter_store_dashboard_${store.id}"),
                            horizontalArrangement = Arrangement.Center,
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Text(
                                text = "Open ${store.name} Store Dashboard",
                                fontFamily = FigtreeFontFamily,
                                fontWeight = FontWeight.SemiBold,
                                fontSize = 13.sp,
                                color = Color.White
                            )
                            Spacer(modifier = Modifier.size(6.dp))
                            Icon(
                                imageVector = Icons.AutoMirrored.Outlined.ArrowForward,
                                contentDescription = null,
                                tint = ShadcnPrimary,
                                modifier = Modifier.size(16.dp)
                            )
                        }
                    }
                }
            }
        }
    }
}

/**
 * 2. Create Store Full-Screen Mobile Page (`AppScreen.CREATE_STORE`)
 * Separate page with a mobile Back button (`<-`) to create a new store.
 */
@Composable
fun CreateStoreScreen(
    uiState: TiwloUiState,
    onNavigate: (AppScreen) -> Unit,
    onBack: () -> Unit,
    onCreateStore: (String, String, String, String) -> Unit,
    onMarkAllNotificationsRead: () -> Unit,
    onNotificationClick: (String) -> Unit
) {
    var storeName by remember { mutableStateOf("") }
    var storeSlug by remember { mutableStateOf("") }
    var selectedCategory by remember { mutableStateOf("") }
    var selectedCurrency by remember { mutableStateOf("BDT (৳)") }

    val categories = listOf(
        "Electronics & Gadgets",
        "Fashion & Apparel",
        "Grocery & Superstore",
        "Beauty & Cosmetics",
        "Digital Products"
    )
    val currencies = listOf("BDT (৳)", "USD ($)", "EUR (€)", "GBP (£)")

    DashboardShell(
        currentScreen = AppScreen.CREATE_STORE,
        screenTitle = "Create New Store",
        screenSubtitle = "Launch a dedicated e-commerce store",
        isSubPage = true,
        onBackClick = onBack,
        unreadNotificationCount = uiState.notifications.count { it.unread },
        notifications = uiState.notifications,
        onNavigate = onNavigate,
        onMarkAllNotificationsRead = onMarkAllNotificationsRead,
        onNotificationClick = onNotificationClick
    ) { innerPadding ->
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(innerPadding)
                .verticalScroll(rememberScrollState())
                .padding(horizontal = 16.dp, vertical = 16.dp),
            verticalArrangement = Arrangement.spacedBy(16.dp)
        ) {
            PageHeader(
                title = "Launch Your Online Store",
                subtitle = "Get an instant storefront, POS system, QR T-Scan inventory, and order admin."
            )

            ShadcnCard {
                CardHeader(
                    title = "1. Store Identity",
                    description = "Name your brand and choose your free .tiwlo.store domain"
                )
                Column(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(16.dp),
                    verticalArrangement = Arrangement.spacedBy(12.dp)
                ) {
                    Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
                        Text(
                            text = "Store Name",
                            fontFamily = FigtreeFontFamily,
                            fontWeight = FontWeight.Medium,
                            fontSize = 13.sp,
                            color = ShadcnForeground
                        )
                        ShadcnInput(
                            value = storeName,
                            onValueChange = {
                                storeName = it
                                if (storeSlug.isBlank() || storeSlug == storeName.dropLast(1).lowercase().replace(" ", "-")) {
                                    storeSlug = it.lowercase().replace(" ", "-")
                                }
                            },
                            placeholder = "e.g. Dhaka Gadget Hub",
                            testTag = "create_store_name_input"
                        )
                    }

                    Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
                        Text(
                            text = "Store Subdomain",
                            fontFamily = FigtreeFontFamily,
                            fontWeight = FontWeight.Medium,
                            fontSize = 13.sp,
                            color = ShadcnForeground
                        )
                        ShadcnInput(
                            value = storeSlug,
                            onValueChange = { storeSlug = it },
                            placeholder = "dhakagadget",
                            testTag = "create_store_slug_input"
                        )
                        Text(
                            text = "Live URL: https://${storeSlug.ifBlank { "yourstore" }}.tiwlo.store",
                            fontFamily = JetBrainsMonoFontFamily,
                            fontSize = 11.sp,
                            color = ShadcnPrimaryDark
                        )
                    }
                }
            }

            ShadcnCard {
                CardHeader(
                    title = "2. Industry Category",
                    description = "Choose a category for this store"
                )
                Column(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(16.dp),
                    verticalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    categories.forEach { cat ->
                        val active = selectedCategory == cat
                        Row(
                            modifier = Modifier
                                .fillMaxWidth()
                                .clip(RoundedCornerShape(10.dp))
                                .background(if (active) ShadcnInk else ShadcnMuted.copy(alpha = 0.6f))
                                .clickable { selectedCategory = cat }
                                .padding(horizontal = 14.dp, vertical = 11.dp),
                            horizontalArrangement = Arrangement.SpaceBetween,
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Text(
                                text = cat,
                                fontFamily = FigtreeFontFamily,
                                fontWeight = FontWeight.SemiBold,
                                fontSize = 13.sp,
                                color = if (active) Color.White else ShadcnForeground
                            )
                            if (active) {
                                StatusPill(text = "Selected", tone = StatusTone.GREEN)
                            }
                        }
                    }
                }
            }

            ShadcnCard {
                CardHeader(
                    title = "3. Store Currency",
                    description = "Used for product pricing, invoices, and POS receipts"
                )
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(16.dp),
                    horizontalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    currencies.forEach { curr ->
                        val active = selectedCurrency == curr
                        Box(
                            modifier = Modifier
                                .weight(1f)
                                .clip(RoundedCornerShape(10.dp))
                                .background(if (active) ShadcnPrimary else ShadcnMuted)
                                .clickable { selectedCurrency = curr }
                                .padding(vertical = 10.dp),
                            contentAlignment = Alignment.Center
                        ) {
                            Text(
                                text = curr,
                                fontFamily = FigtreeFontFamily,
                                fontWeight = FontWeight.Bold,
                                fontSize = 12.sp,
                                color = if (active) ShadcnInk else ShadcnForeground
                            )
                        }
                    }
                }
            }

            ShadcnPrimaryButton(
                text = "Create Store & Open Store Admin",
                icon = Icons.Outlined.Storefront,
                onClick = {
                    onCreateStore(storeName, storeSlug, selectedCategory, selectedCurrency)
                },
                modifier = Modifier
                    .fillMaxWidth()
                    .testTag("confirm_create_store_button")
            )
        }
    }
}

/**
 * 3. Separate Store Admin Dashboard (`AppScreen.ECOMMERCE`)
 * Uses `StoreDashboardShell` (with "Switch to Dashboard" button and Store Admin Bottom Bar).
 * Pure shadcn UI — NO dark ring card!
 */
@Composable
fun EcommerceScreen(
    uiState: TiwloUiState,
    onNavigate: (AppScreen) -> Unit,
    onSwitchToMainDashboard: () -> Unit,
    onSelectStockPeriod: (String) -> Unit,
    onOpenProductModal: () -> Unit,
    onOpenCategoryModal: () -> Unit,
    onOpenPosModal: () -> Unit
) {
    val activeStore = uiState.stores.firstOrNull { it.id == uiState.activeStoreId }
        ?: uiState.stores.first()
    val totalRevenue = uiState.orders.sumOf { it.totalBdt }
    val currencyLabel = uiState.storeSettings["currencySymbol"].orEmpty()
        .ifBlank { activeStore.currency }
    val outOfStockCount = uiState.products.count {
        it.stock <= 0 || it.status.contains("out of stock", ignoreCase = true)
    }
    val lowStockCount = uiState.products.count {
        it.stock > 0 && it.status.contains("low", ignoreCase = true)
    }
    val inStockCount = (uiState.products.size - outOfStockCount - lowStockCount).coerceAtLeast(0)
    val productCount = uiState.products.size
    fun inventoryPercent(count: Int): String =
        if (productCount == 0) "0%" else "${count * 100 / productCount}%"

    StoreDashboardShell(
        storeName = activeStore.name,
        storeDomain = activeStore.domain,
        currentScreen = AppScreen.ECOMMERCE,
        screenTitle = "${activeStore.name} Admin",
        isSubPage = false,
        onSwitchToMainDashboard = onSwitchToMainDashboard,
        onNavigate = onNavigate
    ) { innerPadding ->
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(innerPadding)
                .verticalScroll(rememberScrollState())
                .padding(horizontal = 16.dp, vertical = 16.dp),
            verticalArrangement = Arrangement.spacedBy(16.dp)
        ) {
            // Pure Shadcn Store Header + Quick Actions
            PageHeader(
                title = "${activeStore.name} Control Center",
                subtitle = "${activeStore.domain} · ${activeStore.category} · Live Storefront"
            ) {
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    ShadcnPrimaryButton(
                        text = "Add Product",
                        icon = Icons.Outlined.Add,
                        onClick = onOpenProductModal,
                        modifier = Modifier
                            .weight(1f)
                            .testTag("store_add_product_button")
                    )
                    ShadcnOutlineButton(
                        text = "QR T-Scan",
                        icon = Icons.Outlined.QrCodeScanner,
                        onClick = { onNavigate(AppScreen.STORE_TSCAN) },
                        modifier = Modifier
                            .weight(1f)
                            .testTag("store_tscan_button")
                    )
                }
            }

            // 6 Dedicated Store Admin Quick Action Tiles
            Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.spacedBy(10.dp)
                ) {
                    StoreQuickTile(
                        title = "POS Terminal",
                        subtitle = "In-store checkout",
                        icon = Icons.Outlined.PointOfSale,
                        onClick = onOpenPosModal,
                        modifier = Modifier.weight(1f)
                    )
                    StoreQuickTile(
                        title = "Categories",
                        subtitle = "${uiState.categories.size} groups",
                        icon = Icons.Outlined.Category,
                        onClick = onOpenCategoryModal,
                        modifier = Modifier.weight(1f)
                    )
                    StoreQuickTile(
                        title = "Inventory",
                        subtitle = "${uiState.products.size} SKUs",
                        icon = Icons.Outlined.Inventory2,
                        onClick = { onNavigate(AppScreen.STORE_INVENTORY) },
                        modifier = Modifier.weight(1f)
                    )
                }
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.spacedBy(10.dp)
                ) {
                    StoreQuickTile(
                        title = "Purchases (PO)",
                        subtitle = "${uiState.purchaseOrders.size} POs",
                        icon = Icons.Outlined.ReceiptLong,
                        onClick = { onNavigate(AppScreen.STORE_PURCHASES) },
                        modifier = Modifier.weight(1f)
                    )
                    StoreQuickTile(
                        title = "Promo Codes",
                        subtitle = "${uiState.promoCodes.size} active",
                        icon = Icons.Outlined.Payments,
                        onClick = { onNavigate(AppScreen.STORE_PROMO_CODES) },
                        modifier = Modifier.weight(1f)
                    )
                    StoreQuickTile(
                        title = "Checklist",
                        subtitle = "Setup status unavailable",
                        icon = Icons.Outlined.CheckCircle,
                        onClick = { onNavigate(AppScreen.STORE_CHECKLIST) },
                        modifier = Modifier.weight(1f)
                    )
                }
            }

            // 4 Store KPI StatCards
            Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.spacedBy(12.dp)
                ) {
                    StatCard(
                        label = "Total Sales",
                        value = "$currencyLabel${"%,d".format(totalRevenue)}",
                        change = "From recorded orders",
                        trend = SparklineTrend.NEUTRAL,
                        icon = Icons.Outlined.Payments,
                        sparkline = emptyList(),
                        modifier = Modifier.weight(1f)
                    )
                    StatCard(
                        label = "Total Orders",
                        value = uiState.orders.size.toString(),
                        change = "Recorded orders",
                        trend = SparklineTrend.NEUTRAL,
                        icon = Icons.Outlined.ShoppingCart,
                        sparkline = emptyList(),
                        modifier = Modifier.weight(1f)
                    )
                }
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.spacedBy(12.dp)
                ) {
                    StatCard(
                        label = "Active Products",
                        value = uiState.products.size.toString(),
                        change = "${uiState.categories.size} categories",
                        trend = SparklineTrend.NEUTRAL,
                        icon = Icons.Outlined.ShoppingBag,
                        sparkline = emptyList(),
                        modifier = Modifier.weight(1f)
                    )
                    StatCard(
                        label = "Conversion Rate",
                        value = "Unavailable",
                        change = "No conversion analytics API",
                        trend = SparklineTrend.NEUTRAL,
                        icon = Icons.Outlined.TrendingUp,
                        sparkline = emptyList(),
                        modifier = Modifier.weight(1f)
                    )
                }
            }

            // Stock Movement Grouped Bar Chart
            ShadcnCard {
                CardHeader(
                    title = "Stock Movement",
                    description = "Movement history is not available from the current API",
                    action = {
                        SegmentedPeriodToggle(
                            options = listOf("7D", "30D", "90D"),
                            selected = uiState.selectedStockPeriod,
                            onSelect = onSelectStockPeriod
                        )
                    }
                )
                Column(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(16.dp),
                    verticalArrangement = Arrangement.spacedBy(12.dp)
                ) {
                    Text(
                        text = "Inventory movement data is not available.",
                        fontFamily = FigtreeFontFamily,
                        fontSize = 13.sp,
                        color = ShadcnMutedForeground
                    )
                }
            }

            // Inventory Status Donut Ring Chart
            ShadcnCard {
                CardHeader(
                    title = "Inventory Health",
                    description = "Stock distribution across ${uiState.products.size} SKUs",
                    action = {
                        ShadcnOutlineButton(
                            text = "Inventory Page",
                            onClick = { onNavigate(AppScreen.STORE_INVENTORY) }
                        )
                    }
                )
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(16.dp),
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(18.dp)
                ) {
                    DonutRingChart(
                        segments = listOf(
                            DonutSegment("In Stock", inStockCount.toFloat(), ShadcnPrimary),
                            DonutSegment("Low Stock", lowStockCount.toFloat(), ShadcnAmber),
                            DonutSegment("Out of Stock", outOfStockCount.toFloat(), ShadcnDestructive)
                        ),
                        centerValue = productCount.toString(),
                        centerLabel = "Products",
                        size = 130.dp
                    )
                    Column(
                        modifier = Modifier.weight(1f),
                        verticalArrangement = Arrangement.spacedBy(10.dp)
                    ) {
                        InventoryLegendRow("In Stock ($inStockCount SKUs)", inventoryPercent(inStockCount), ShadcnPrimary)
                        InventoryLegendRow("Low Stock ($lowStockCount SKUs)", inventoryPercent(lowStockCount), ShadcnAmber)
                        InventoryLegendRow("Out of Stock ($outOfStockCount SKUs)", inventoryPercent(outOfStockCount), ShadcnDestructive)
                    }
                }
            }

            // Recent Customer Orders Preview
            ShadcnCard {
                CardHeader(
                    title = "Recent Customer Orders",
                    description = "Latest storefront & POS transactions",
                    action = {
                        ShadcnOutlineButton(
                            text = "All Orders",
                            trailingIcon = Icons.AutoMirrored.Outlined.ArrowForward,
                            onClick = { onNavigate(AppScreen.STORE_ORDERS) }
                        )
                    }
                )
                Column(modifier = Modifier.fillMaxWidth()) {
                    uiState.orders.take(4).forEachIndexed { idx, order ->
                        Row(
                            modifier = Modifier
                                .fillMaxWidth()
                                .clickable { onNavigate(AppScreen.STORE_ORDERS) }
                                .padding(horizontal = 16.dp, vertical = 12.dp),
                            horizontalArrangement = Arrangement.SpaceBetween,
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Column(modifier = Modifier.weight(1f)) {
                                Text(
                                    text = "${order.id} · ${order.customer}",
                                    fontFamily = FigtreeFontFamily,
                                    fontWeight = FontWeight.SemiBold,
                                    fontSize = 13.sp,
                                    color = ShadcnForeground
                                )
                                Text(
                                    text = "${order.items} items · ${order.payment} · ${order.date}",
                                    fontFamily = FigtreeFontFamily,
                                    fontSize = 11.sp,
                                    color = ShadcnMutedForeground
                                )
                            }
                            Column(horizontalAlignment = Alignment.End) {
                                Text(
                                    text = "৳${order.totalBdt}",
                                    fontFamily = JetBrainsMonoFontFamily,
                                    fontWeight = FontWeight.Bold,
                                    fontSize = 13.sp,
                                    color = ShadcnForeground
                                )
                                val tone = when (order.status) {
                                    "Completed", "Delivered" -> StatusTone.GREEN
                                    "Processing" -> StatusTone.BLUE
                                    else -> StatusTone.AMBER
                                }
                                StatusPill(text = order.status, tone = tone)
                            }
                        }
                        if (idx < 3) {
                            HorizontalDivider(color = ShadcnBorder, thickness = 1.dp)
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun StoreQuickTile(
    title: String,
    subtitle: String,
    icon: ImageVector,
    onClick: () -> Unit,
    modifier: Modifier = Modifier
) {
    Column(
        modifier = modifier
            .clip(RoundedCornerShape(12.dp))
            .clickable(onClick = onClick)
            .padding(12.dp),
        verticalArrangement = Arrangement.spacedBy(6.dp)
    ) {
        Box(
            modifier = Modifier
                .size(32.dp)
                .clip(RoundedCornerShape(8.dp))
                .background(ShadcnMuted),
            contentAlignment = Alignment.Center
        ) {
            Icon(
                imageVector = icon,
                contentDescription = title,
                tint = ShadcnForeground,
                modifier = Modifier.size(17.dp)
            )
        }
        Text(
            text = title,
            fontFamily = FigtreeFontFamily,
            fontWeight = FontWeight.Bold,
            fontSize = 12.sp,
            color = ShadcnForeground
        )
        Text(
            text = subtitle,
            fontFamily = FigtreeFontFamily,
            fontSize = 10.sp,
            color = ShadcnMutedForeground
        )
    }
}

@Composable
private fun LegendPill(color: Color, label: String) {
    Row(
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(6.dp)
    ) {
        Box(
            modifier = Modifier
                .size(8.dp)
                .clip(CircleShape)
                .background(color)
        )
        Text(
            text = label,
            fontFamily = FigtreeFontFamily,
            fontSize = 12.sp,
            color = ShadcnMutedForeground
        )
    }
}

@Composable
private fun InventoryLegendRow(label: String, pct: String, color: Color) {
    Row(
        modifier = Modifier.fillMaxWidth(),
        horizontalArrangement = Arrangement.SpaceBetween,
        verticalAlignment = Alignment.CenterVertically
    ) {
        Row(
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(8.dp)
        ) {
            Box(
                modifier = Modifier
                    .size(8.dp)
                    .clip(CircleShape)
                    .background(color)
            )
            Text(
                text = label,
                fontFamily = FigtreeFontFamily,
                fontSize = 12.sp,
                color = ShadcnForeground
            )
        }
        Text(
            text = pct,
            fontFamily = JetBrainsMonoFontFamily,
            fontWeight = FontWeight.Bold,
            fontSize = 12.sp,
            color = ShadcnForeground
        )
    }
}
