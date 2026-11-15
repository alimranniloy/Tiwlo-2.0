package com.example.ui.screens

import androidx.compose.foundation.Canvas
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
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.outlined.Add
import androidx.compose.material.icons.outlined.Check
import androidx.compose.material.icons.outlined.ConfirmationNumber
import androidx.compose.material.icons.outlined.PointOfSale
import androidx.compose.material.icons.outlined.QrCodeScanner
import androidx.compose.material.icons.outlined.Star
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.Switch
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.geometry.CornerRadius
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.example.model.AppScreen
import com.example.ui.components.CardHeader
import com.example.ui.components.PageHeader
import com.example.ui.components.ProgressBarMeter
import com.example.ui.components.ShadcnCard
import com.example.ui.components.ShadcnInput
import com.example.ui.components.ShadcnOutlineButton
import com.example.ui.components.ShadcnPrimaryButton
import com.example.ui.components.StatusPill
import com.example.ui.components.StatusTone
import com.example.ui.components.StoreDashboardShell
import com.example.ui.theme.FigtreeFontFamily
import com.example.ui.theme.JetBrainsMonoFontFamily
import com.example.ui.theme.ShadcnAmber
import com.example.ui.theme.ShadcnBackground
import com.example.ui.theme.ShadcnBorder
import com.example.ui.theme.ShadcnForeground
import com.example.ui.theme.ShadcnInk
import com.example.ui.theme.ShadcnMuted
import com.example.ui.theme.ShadcnMutedForeground
import com.example.ui.theme.ShadcnPrimary
import com.example.ui.theme.ShadcnPrimaryDark
import com.example.viewmodel.TiwloUiState

/**
 * 1. QR & Barcode T-Scan Dedicated Page (`AppScreen.STORE_TSCAN`)
 * Interactive mobile scanner viewfinder + instant SKU scan + POS cart integration.
 */
@Composable
fun StoreTScanScreen(
    uiState: TiwloUiState,
    onNavigate: (AppScreen) -> Unit,
    onBack: () -> Unit,
    onSwitchToMainDashboard: () -> Unit,
    onScanCode: (String) -> Unit
) {
    val activeStore = uiState.stores.firstOrNull { it.id == uiState.activeStoreId } ?: uiState.stores.first()
    var manualSku by remember { mutableStateOf("") }

    StoreDashboardShell(
        storeName = activeStore.name,
        storeDomain = activeStore.domain,
        currentScreen = AppScreen.STORE_TSCAN,
        screenTitle = "T-Scan SKU Lookup",
        isSubPage = true,
        onBackClick = onBack,
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
            PageHeader(
                title = "T-Scan Instant Scanner",
                subtitle = "Look up a product by SKU or select it from your live catalog to add it to POS."
            ) {
                ShadcnOutlineButton(
                    text = "Go to POS Cart (${uiState.posCart.values.sum()})",
                    icon = Icons.Outlined.PointOfSale,
                    onClick = { onNavigate(AppScreen.STORE_POS) }
                )
            }

            // SKU lookup card
            ShadcnCard {
                Column(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(16.dp),
                    verticalArrangement = Arrangement.spacedBy(12.dp)
                ) {
                    Box(
                        modifier = Modifier
                            .fillMaxWidth()
                            .height(210.dp)
                            .clip(RoundedCornerShape(16.dp))
                            .background(ShadcnInk),
                        contentAlignment = Alignment.Center
                    ) {
                        Canvas(modifier = Modifier.fillMaxSize()) {
                            val frameW = size.width * 0.65f
                            val frameH = size.height * 0.62f
                            val left = (size.width - frameW) / 2f
                            val top = (size.height - frameH) / 2f
                            drawRoundRect(
                                color = ShadcnPrimary,
                                topLeft = Offset(left, top),
                                size = Size(frameW, frameH),
                                cornerRadius = CornerRadius(18.dp.toPx(), 18.dp.toPx()),
                                style = Stroke(width = 2.5.dp.toPx())
                            )
                            drawLine(
                                color = ShadcnPrimary.copy(alpha = 0.85f),
                                start = Offset(left + 12.dp.toPx(), size.height / 2f),
                                end = Offset(left + frameW - 12.dp.toPx(), size.height / 2f),
                                strokeWidth = 2.dp.toPx()
                            )
                        }
                        Column(
                            horizontalAlignment = Alignment.CenterHorizontally,
                            verticalArrangement = Arrangement.spacedBy(6.dp)
                        ) {
                            Icon(
                                imageVector = Icons.Outlined.QrCodeScanner,
                                contentDescription = "SKU lookup",
                                tint = ShadcnPrimary,
                                modifier = Modifier.size(34.dp)
                            )
                            Text(
                                text = "SKU LOOKUP",
                                fontFamily = JetBrainsMonoFontFamily,
                                fontWeight = FontWeight.Bold,
                                fontSize = 12.sp,
                                color = Color.White
                            )
                            Text(
                                text = "Last Scanned: ${uiState.lastScannedCode}",
                                fontFamily = JetBrainsMonoFontFamily,
                                fontSize = 11.sp,
                                color = ShadcnPrimary
                            )
                        }
                    }

                    // Catalog shortcuts
                    Text(
                        text = "SELECT A PRODUCT FROM YOUR CATALOG:",
                        fontFamily = JetBrainsMonoFontFamily,
                        fontWeight = FontWeight.SemiBold,
                        fontSize = 10.sp,
                        color = ShadcnMutedForeground
                    )
                    Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                        uiState.products.take(4).forEach { prod ->
                            Row(
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .clickable { onScanCode(prod.sku) }
                                    .padding(horizontal = 12.dp, vertical = 10.dp)
                                    .testTag("tscan_item_${prod.sku}"),
                                horizontalArrangement = Arrangement.SpaceBetween,
                                verticalAlignment = Alignment.CenterVertically
                            ) {
                                Column {
                                    Text(
                                        text = "${prod.sku} · ${prod.name}",
                                        fontFamily = FigtreeFontFamily,
                                        fontWeight = FontWeight.SemiBold,
                                        fontSize = 13.sp,
                                        color = ShadcnForeground
                                    )
                                    Text(
                                        text = "Price: ৳${prod.priceBdt} · Stock: ${prod.stock}",
                                        fontFamily = JetBrainsMonoFontFamily,
                                        fontSize = 11.sp,
                                        color = ShadcnMutedForeground
                                    )
                                }
                                StatusPill(text = "Scan +1", tone = StatusTone.GREEN)
                            }
                        }
                    }

                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.spacedBy(8.dp)
                    ) {
                        ShadcnInput(
                            value = manualSku,
                            onValueChange = { manualSku = it },
                            placeholder = "Enter SKU or Barcode (e.g. TW-101)",
                            modifier = Modifier.weight(1f)
                        )
                        ShadcnPrimaryButton(
                            text = "Lookup",
                            onClick = {
                                if (manualSku.isNotBlank()) {
                                    onScanCode(manualSku)
                                    manualSku = ""
                                }
                            }
                        )
                    }
                }
            }
        }
    }
}

/**
 * 2. Inventory Control Page (`AppScreen.STORE_INVENTORY`)
 */
@Composable
fun StoreInventoryScreen(
    uiState: TiwloUiState,
    onNavigate: (AppScreen) -> Unit,
    onBack: () -> Unit,
    onSwitchToMainDashboard: () -> Unit,
    onRestockProduct: (String, Int) -> Unit
) {
    val activeStore = uiState.stores.firstOrNull { it.id == uiState.activeStoreId } ?: uiState.stores.first()

    StoreDashboardShell(
        storeName = activeStore.name,
        storeDomain = activeStore.domain,
        currentScreen = AppScreen.STORE_INVENTORY,
        screenTitle = "Inventory Control",
        isSubPage = true,
        onBackClick = onBack,
        onSwitchToMainDashboard = onSwitchToMainDashboard,
        onNavigate = onNavigate
    ) { innerPadding ->
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(innerPadding)
                .verticalScroll(rememberScrollState())
                .padding(horizontal = 16.dp, vertical = 16.dp),
            verticalArrangement = Arrangement.spacedBy(14.dp)
        ) {
            PageHeader(
                title = "Warehouse Inventory",
                subtitle = "Monitor stock thresholds and trigger instant +20 unit restocks."
            )

            uiState.products.forEach { prod ->
                ShadcnCard {
                    Column(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(16.dp),
                        verticalArrangement = Arrangement.spacedBy(10.dp)
                    ) {
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.SpaceBetween,
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Column(modifier = Modifier.weight(1f)) {
                                Text(
                                    text = prod.name,
                                    fontFamily = FigtreeFontFamily,
                                    fontWeight = FontWeight.Bold,
                                    fontSize = 14.sp,
                                    color = ShadcnForeground
                                )
                                Text(
                                    text = "SKU: ${prod.sku} · ${prod.category}",
                                    fontFamily = JetBrainsMonoFontFamily,
                                    fontSize = 11.sp,
                                    color = ShadcnMutedForeground
                                )
                            }
                            val tone = when (prod.status) {
                                "In Stock" -> StatusTone.GREEN
                                "Low Stock" -> StatusTone.AMBER
                                else -> StatusTone.RED
                            }
                            StatusPill(text = "${prod.stock} in stock", tone = tone)
                        }
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.SpaceBetween,
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Text(
                                text = "Unit Price: ৳${prod.priceBdt}",
                                fontFamily = JetBrainsMonoFontFamily,
                                fontSize = 12.sp,
                                color = ShadcnMutedForeground
                            )
                            ShadcnOutlineButton(
                                text = "+20 Restock",
                                icon = Icons.Outlined.Add,
                                onClick = { onRestockProduct(prod.id, 20) }
                            )
                        }
                    }
                }
            }
        }
    }
}

/**
 * 3. Purchases (PO), Suppliers, Customers (`STORE_PURCHASES`, `STORE_SUPPLIERS`, `STORE_CUSTOMERS`)
 */
@Composable
fun StoreOperationsSubScreen(
    currentScreen: AppScreen,
    uiState: TiwloUiState,
    onNavigate: (AppScreen) -> Unit,
    onBack: () -> Unit,
    onSwitchToMainDashboard: () -> Unit
) {
    val activeStore = uiState.stores.firstOrNull { it.id == uiState.activeStoreId } ?: uiState.stores.first()
    val title = when (currentScreen) {
        AppScreen.STORE_PURCHASES -> "Purchase Orders (PO)"
        AppScreen.STORE_SUPPLIERS -> "Suppliers Directory"
        else -> "Customer Directory"
    }

    StoreDashboardShell(
        storeName = activeStore.name,
        storeDomain = activeStore.domain,
        currentScreen = currentScreen,
        screenTitle = title,
        isSubPage = true,
        onBackClick = onBack,
        onSwitchToMainDashboard = onSwitchToMainDashboard,
        onNavigate = onNavigate
    ) { innerPadding ->
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(innerPadding)
                .verticalScroll(rememberScrollState())
                .padding(horizontal = 16.dp, vertical = 16.dp),
            verticalArrangement = Arrangement.spacedBy(14.dp)
        ) {
            when (currentScreen) {
                AppScreen.STORE_PURCHASES -> {
                    PageHeader(
                        title = "Purchase Orders",
                        subtitle = "Incoming wholesale inventory orders from verified suppliers."
                    )
                    uiState.purchaseOrders.forEach { po ->
                        ShadcnCard {
                            Row(
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .padding(16.dp),
                                horizontalArrangement = Arrangement.SpaceBetween,
                                verticalAlignment = Alignment.CenterVertically
                            ) {
                                Column {
                                    Text(
                                        text = "${po.id} · ${po.supplier}",
                                        fontFamily = FigtreeFontFamily,
                                        fontWeight = FontWeight.Bold,
                                        fontSize = 14.sp,
                                        color = ShadcnForeground
                                    )
                                    Text(
                                        text = "${po.itemsCount} units · ${po.expectedDate} · ৳${po.totalBdt}",
                                        fontFamily = JetBrainsMonoFontFamily,
                                        fontSize = 11.sp,
                                        color = ShadcnMutedForeground
                                    )
                                }
                                StatusPill(
                                    text = po.status,
                                    tone = if (po.status == "Received") StatusTone.GREEN else StatusTone.BLUE
                                )
                            }
                        }
                    }
                }

                AppScreen.STORE_SUPPLIERS -> {
                    PageHeader(
                        title = "Wholesale Suppliers",
                        subtitle = "Active vendor contacts and active product lines."
                    )
                    uiState.suppliers.forEach { sup ->
                        ShadcnCard {
                            Column(
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .padding(16.dp),
                                verticalArrangement = Arrangement.spacedBy(6.dp)
                            ) {
                                Row(
                                    modifier = Modifier.fillMaxWidth(),
                                    horizontalArrangement = Arrangement.SpaceBetween
                                ) {
                                    Text(
                                        text = sup.name,
                                        fontFamily = FigtreeFontFamily,
                                        fontWeight = FontWeight.Bold,
                                        fontSize = 14.sp,
                                        color = ShadcnForeground
                                    )
                                    StatusPill(text = "${sup.activeSkus} SKUs", tone = StatusTone.GREEN)
                                }
                                Text(
                                    text = "${sup.contactPerson} · ${sup.phone} · ${sup.city}",
                                    fontFamily = FigtreeFontFamily,
                                    fontSize = 12.sp,
                                    color = ShadcnMutedForeground
                                )
                            }
                        }
                    }
                }

                else -> {
                    PageHeader(
                        title = "Store Customers",
                        subtitle = "Repeat buyers, order counts, and lifetime spend."
                    )
                    uiState.customers.forEach { cust ->
                        ShadcnCard {
                            Row(
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .padding(16.dp),
                                horizontalArrangement = Arrangement.SpaceBetween,
                                verticalAlignment = Alignment.CenterVertically
                            ) {
                                Column {
                                    Text(
                                        text = cust.name,
                                        fontFamily = FigtreeFontFamily,
                                        fontWeight = FontWeight.Bold,
                                        fontSize = 14.sp,
                                        color = ShadcnForeground
                                    )
                                    Text(
                                        text = "${cust.phone} · ${cust.totalOrders} orders (${cust.lastOrder})",
                                        fontFamily = FigtreeFontFamily,
                                        fontSize = 12.sp,
                                        color = ShadcnMutedForeground
                                    )
                                }
                                Text(
                                    text = "৳${cust.totalSpentBdt}",
                                    fontFamily = JetBrainsMonoFontFamily,
                                    fontWeight = FontWeight.Bold,
                                    fontSize = 13.sp,
                                    color = ShadcnForeground
                                )
                            }
                        }
                    }
                }
            }
        }
    }
}

/**
 * 4. Store Insights & Management Pages (`STORE_ANALYTICS`, `STORE_MARKETING`, `STORE_PROMO_CODES`,
 * `STORE_REVIEWS`, `STORE_THEME`, `STORE_PAYMENTS`, `STORE_SHIPPING`, `STORE_STAFF`, `STORE_CHECKLIST`)
 */
@Composable
fun StoreManagementSubScreen(
    currentScreen: AppScreen,
    uiState: TiwloUiState,
    onNavigate: (AppScreen) -> Unit,
    onBack: () -> Unit,
    onSwitchToMainDashboard: () -> Unit,
    onAddPromoCode: (String, String) -> Unit
) {
    val activeStore = uiState.stores.firstOrNull { it.id == uiState.activeStoreId } ?: uiState.stores.first()
    var promoCodeInput by remember { mutableStateOf("") }
    var promoDiscountInput by remember { mutableStateOf("") }

    val screenTitle = when (currentScreen) {
        AppScreen.STORE_ANALYTICS -> "Store Analytics"
        AppScreen.STORE_MARKETING -> "Marketing Campaigns"
        AppScreen.STORE_PROMO_CODES -> "Promo Codes"
        AppScreen.STORE_REVIEWS -> "Product Reviews"
        AppScreen.STORE_THEME -> "Storefront & Theme"
        AppScreen.STORE_PAYMENTS -> "Payment Gateways"
        AppScreen.STORE_SHIPPING -> "Shipping & Courier"
        AppScreen.STORE_STAFF -> "Staff Management"
        else -> "Store Setup Checklist"
    }

    StoreDashboardShell(
        storeName = activeStore.name,
        storeDomain = activeStore.domain,
        currentScreen = currentScreen,
        screenTitle = screenTitle,
        isSubPage = true,
        onBackClick = onBack,
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
            when (currentScreen) {
                AppScreen.STORE_PROMO_CODES -> {
                    PageHeader(
                        title = "Discount & Promo Codes",
                        subtitle = "Create checkout coupon codes for ${activeStore.name}."
                    )
                    ShadcnCard {
                        CardHeader(
                            title = "Create Promo Code",
                            description = "Instant percentage or flat BDT discount"
                        )
                        Column(
                            modifier = Modifier
                                .fillMaxWidth()
                                .padding(16.dp),
                            verticalArrangement = Arrangement.spacedBy(10.dp)
                        ) {
                            ShadcnInput(
                                value = promoCodeInput,
                                onValueChange = { promoCodeInput = it },
                                placeholder = "Code (e.g. WINTER25)"
                            )
                            ShadcnInput(
                                value = promoDiscountInput,
                                onValueChange = { promoDiscountInput = it },
                                placeholder = "Discount percentage (e.g. 25%)"
                            )
                            ShadcnPrimaryButton(
                                text = "Create Coupon",
                                icon = Icons.Outlined.Add,
                                onClick = {
                                    if (promoCodeInput.isNotBlank()) {
                                        onAddPromoCode(promoCodeInput, promoDiscountInput)
                                    }
                                },
                                modifier = Modifier.fillMaxWidth()
                            )
                        }
                    }
                    uiState.promoCodes.forEach { promo ->
                        ShadcnCard {
                            Row(
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .padding(16.dp),
                                horizontalArrangement = Arrangement.SpaceBetween,
                                verticalAlignment = Alignment.CenterVertically
                            ) {
                                Column {
                                    Text(
                                        text = promo.code,
                                        fontFamily = JetBrainsMonoFontFamily,
                                        fontWeight = FontWeight.Bold,
                                        fontSize = 15.sp,
                                        color = ShadcnForeground
                                    )
                                    Text(
                                        text = "${promo.discount} · ${promo.uses} redemptions",
                                        fontFamily = FigtreeFontFamily,
                                        fontSize = 12.sp,
                                        color = ShadcnMutedForeground
                                    )
                                }
                                StatusPill(text = promo.status, tone = StatusTone.GREEN)
                            }
                        }
                    }
                }

                AppScreen.STORE_REVIEWS -> {
                    PageHeader(
                        title = "Customer Product Reviews",
                        subtitle = "Ratings and feedback returned by Tiwlo."
                    )
                    uiState.reviews.forEach { rev ->
                        ShadcnCard {
                            Column(
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .padding(16.dp),
                                verticalArrangement = Arrangement.spacedBy(6.dp)
                            ) {
                                Row(
                                    modifier = Modifier.fillMaxWidth(),
                                    horizontalArrangement = Arrangement.SpaceBetween
                                ) {
                                    Text(
                                        text = rev.productName,
                                        fontFamily = FigtreeFontFamily,
                                        fontWeight = FontWeight.Bold,
                                        fontSize = 14.sp,
                                        color = ShadcnForeground
                                    )
                                    StatusPill(text = "${rev.rating} ★", tone = StatusTone.GREEN)
                                }
                                Text(
                                    text = "\"${rev.comment}\"",
                                    fontFamily = FigtreeFontFamily,
                                    fontSize = 13.sp,
                                    color = ShadcnForeground
                                )
                                Text(
                                    text = "— ${rev.customer} · ${rev.date}",
                                    fontFamily = FigtreeFontFamily,
                                    fontSize = 11.sp,
                                    color = ShadcnMutedForeground
                                )
                            }
                        }
                    }
                }

                AppScreen.STORE_STAFF -> {
                    PageHeader(
                        title = "Store Staff & Roles",
                        subtitle = "Manage POS cashiers, inventory managers, and admins."
                    )
                    uiState.staffMembers.forEach { staff ->
                        ShadcnCard {
                            Row(
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .padding(16.dp),
                                horizontalArrangement = Arrangement.SpaceBetween,
                                verticalAlignment = Alignment.CenterVertically
                            ) {
                                Column {
                                    Text(
                                        text = staff.name,
                                        fontFamily = FigtreeFontFamily,
                                        fontWeight = FontWeight.Bold,
                                        fontSize = 14.sp,
                                        color = ShadcnForeground
                                    )
                                    Text(
                                        text = "${staff.role} · ${staff.email}",
                                        fontFamily = FigtreeFontFamily,
                                        fontSize = 12.sp,
                                        color = ShadcnMutedForeground
                                    )
                                }
                                StatusPill(text = staff.status, tone = StatusTone.GREEN)
                            }
                        }
                    }
                }

                AppScreen.STORE_PAYMENTS -> {
                    PageHeader(
                        title = "Payment Gateways",
                        subtitle = "Gateway configuration is unavailable through the current API."
                    )
                    listOf(
                        Triple("bKash Merchant API", "Live gateway status is not available.", false),
                        Triple("Nagad Merchant", "Live gateway status is not available.", false),
                        Triple("SSLCommerz Cards", "Live gateway status is not available.", false),
                        Triple("Cash on Delivery (COD)", "Live gateway status is not available.", false)
                    ).forEach { (title, desc, enabled) ->
                        var checked by remember { mutableStateOf(enabled) }
                        ShadcnCard {
                            Row(
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .padding(16.dp),
                                horizontalArrangement = Arrangement.SpaceBetween,
                                verticalAlignment = Alignment.CenterVertically
                            ) {
                                Column(modifier = Modifier.weight(1f)) {
                                    Text(
                                        text = title,
                                        fontFamily = FigtreeFontFamily,
                                        fontWeight = FontWeight.Bold,
                                        fontSize = 14.sp,
                                        color = ShadcnForeground
                                    )
                                    Text(
                                        text = desc,
                                        fontFamily = FigtreeFontFamily,
                                        fontSize = 12.sp,
                                        color = ShadcnMutedForeground
                                    )
                                }
                                Switch(
                                    checked = checked,
                                    onCheckedChange = { checked = it },
                                    enabled = false
                                )
                            }
                        }
                    }
                }

                AppScreen.STORE_SHIPPING -> {
                    PageHeader(
                        title = "Shipping & Courier Partners",
                        subtitle = "Courier connections and rates are unavailable through the current API."
                    )
                    listOf(
                        Triple("Pathao Courier", "Live connection and rates are unavailable.", "Unavailable"),
                        Triple("Steadfast Courier", "Live connection and rates are unavailable.", "Unavailable"),
                        Triple("RedX Logistics", "Live connection status is unavailable.", "Unavailable")
                    ).forEach { (courier, rate, status) ->
                        ShadcnCard {
                            Row(
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .padding(16.dp),
                                horizontalArrangement = Arrangement.SpaceBetween,
                                verticalAlignment = Alignment.CenterVertically
                            ) {
                                Column(modifier = Modifier.weight(1f)) {
                                    Text(
                                        text = courier,
                                        fontFamily = FigtreeFontFamily,
                                        fontWeight = FontWeight.Bold,
                                        fontSize = 14.sp,
                                        color = ShadcnForeground
                                    )
                                    Text(
                                        text = rate,
                                        fontFamily = FigtreeFontFamily,
                                        fontSize = 12.sp,
                                        color = ShadcnMutedForeground
                                    )
                                }
                                StatusPill(
                                    text = status,
                                    tone = StatusTone.SLATE
                                )
                            }
                        }
                    }
                }

                else -> {
                    PageHeader(
                        title = screenTitle,
                        subtitle = "Configure and monitor ${activeStore.name} performance."
                    )
                    ShadcnCard {
                        Column(
                            modifier = Modifier
                                .fillMaxWidth()
                                .padding(16.dp),
                            verticalArrangement = Arrangement.spacedBy(12.dp)
                        ) {
                            ProgressBarMeter(
                                label = "Storefront Launch Readiness",
                                usedLabel = "Unavailable",
                                fraction = 0f,
                                color = ShadcnPrimary
                            )
                            ProgressBarMeter(
                                label = "Conversion Funnel Rate",
                                usedLabel = "Unavailable",
                                fraction = 0f,
                                color = ShadcnInk
                            )
                        }
                    }
                }
            }
        }
    }
}
