package com.example.ui.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ExperimentalLayoutApi
import androidx.compose.foundation.layout.FlowRow
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
import androidx.compose.material.icons.outlined.DeleteOutline
import androidx.compose.material.icons.outlined.PointOfSale
import androidx.compose.material.icons.outlined.QrCodeScanner
import androidx.compose.material.icons.outlined.Remove
import androidx.compose.material.icons.outlined.Search
import androidx.compose.material.icons.outlined.ShoppingBag
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
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.example.model.AppScreen
import com.example.ui.components.CardHeader
import com.example.ui.components.PageHeader
import com.example.ui.components.ShadcnCard
import com.example.ui.components.ShadcnInput
import com.example.ui.components.ShadcnOutlineButton
import com.example.ui.components.ShadcnPrimaryButton
import com.example.ui.components.StatusPill
import com.example.ui.components.StatusTone
import com.example.ui.components.StoreDashboardShell
import com.example.ui.theme.FigtreeFontFamily
import com.example.ui.theme.JetBrainsMonoFontFamily
import com.example.ui.theme.ShadcnBackground
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
 * 1. Create Product Dedicated Page (`AppScreen.STORE_CREATE_PRODUCT`)
 * Pure shadcn UI, wrapped in `StoreDashboardShell` with mobile Back button (`<-`).
 */
@Composable
fun StoreCreateProductScreen(
    uiState: TiwloUiState,
    onNavigate: (AppScreen) -> Unit,
    onBack: () -> Unit,
    onSwitchToMainDashboard: () -> Unit,
    onAddProduct: (String, String, String, Int, Int) -> Unit
) {
    val activeStore = uiState.stores.firstOrNull { it.id == uiState.activeStoreId } ?: uiState.stores.first()
    var name by remember { mutableStateOf("") }
    var sku by remember { mutableStateOf("") }
    var selectedCategory by remember {
        mutableStateOf(uiState.categories.firstOrNull()?.name.orEmpty())
    }
    var priceText by remember { mutableStateOf("") }
    var stockText by remember { mutableStateOf("") }

    StoreDashboardShell(
        storeName = activeStore.name,
        storeDomain = activeStore.domain,
        currentScreen = AppScreen.STORE_CREATE_PRODUCT,
        screenTitle = "Create Product",
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
                title = "Add New Product",
                subtitle = "Publish a new item to ${activeStore.name} storefront and POS catalog."
            )

            ShadcnCard {
                CardHeader(
                    title = "Product Information",
                    description = "Enter title, SKU code, category, price, and initial stock"
                )
                Column(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(16.dp),
                    verticalArrangement = Arrangement.spacedBy(12.dp)
                ) {
                    Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
                        Text(
                            text = "Product Title",
                            fontFamily = FigtreeFontFamily,
                            fontWeight = FontWeight.Medium,
                            fontSize = 13.sp,
                            color = ShadcnForeground
                        )
                        ShadcnInput(
                            value = name,
                            onValueChange = { name = it },
                            placeholder = "e.g. Wireless ANC Earbuds Pro",
                            testTag = "product_name_input"
                        )
                    }

                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.spacedBy(10.dp)
                    ) {
                        Column(
                            modifier = Modifier.weight(1f),
                            verticalArrangement = Arrangement.spacedBy(6.dp)
                        ) {
                            Text(
                                text = "SKU / QR Code",
                                fontFamily = FigtreeFontFamily,
                                fontWeight = FontWeight.Medium,
                                fontSize = 13.sp,
                                color = ShadcnForeground
                            )
                            ShadcnInput(
                                value = sku,
                                onValueChange = { sku = it },
                                placeholder = "TW-109",
                                testTag = "product_sku_input"
                            )
                        }
                        Column(
                            modifier = Modifier.weight(1f),
                            verticalArrangement = Arrangement.spacedBy(6.dp)
                        ) {
                            Text(
                                text = "Price (BDT ৳)",
                                fontFamily = FigtreeFontFamily,
                                fontWeight = FontWeight.Medium,
                                fontSize = 13.sp,
                                color = ShadcnForeground
                            )
                            ShadcnInput(
                                value = priceText,
                                onValueChange = { priceText = it },
                                placeholder = "2400",
                                keyboardType = KeyboardType.Number,
                                testTag = "product_price_input"
                            )
                        }
                    }

                    Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
                        Text(
                            text = "Initial Stock Quantity",
                            fontFamily = FigtreeFontFamily,
                            fontWeight = FontWeight.Medium,
                            fontSize = 13.sp,
                            color = ShadcnForeground
                        )
                        ShadcnInput(
                            value = stockText,
                            onValueChange = { stockText = it },
                            placeholder = "25",
                            keyboardType = KeyboardType.Number,
                            testTag = "product_stock_input"
                        )
                    }
                }
            }

            ShadcnCard {
                CardHeader(
                    title = "Select Category",
                    description = "Assign this product to a store category"
                )
                Column(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(16.dp),
                    verticalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    uiState.categories.forEach { cat ->
                        val active = selectedCategory == cat.name
                        Row(
                            modifier = Modifier
                                .fillMaxWidth()
                                .clip(RoundedCornerShape(10.dp))
                                .background(if (active) ShadcnInk else ShadcnMuted.copy(alpha = 0.6f))
                                .clickable { selectedCategory = cat.name }
                                .padding(horizontal = 14.dp, vertical = 11.dp),
                            horizontalArrangement = Arrangement.SpaceBetween,
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Text(
                                text = cat.name,
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

            ShadcnPrimaryButton(
                text = "Save & Publish Product",
                icon = Icons.Outlined.Check,
                onClick = {
                    onAddProduct(
                        name,
                        sku,
                        selectedCategory,
                        priceText.toIntOrNull() ?: -1,
                        stockText.toIntOrNull() ?: -1
                    )
                },
                modifier = Modifier
                    .fillMaxWidth()
                    .testTag("save_product_button")
            )
        }
    }
}

/**
 * 2. Categories & Sub-Categories Dedicated Page (`AppScreen.STORE_CATEGORIES`)
 */
@OptIn(ExperimentalLayoutApi::class)
@Composable
fun StoreCategoriesScreen(
    uiState: TiwloUiState,
    onNavigate: (AppScreen) -> Unit,
    onBack: () -> Unit,
    onSwitchToMainDashboard: () -> Unit,
    onAddCategory: (String, String, List<String>) -> Unit,
    onAddSubCategory: (String, String) -> Unit
) {
    val activeStore = uiState.stores.firstOrNull { it.id == uiState.activeStoreId } ?: uiState.stores.first()
    var newCategoryName by remember { mutableStateOf("") }
    var newCategorySlug by remember { mutableStateOf("") }
    var newSubCategoriesCsv by remember { mutableStateOf("") }
    var subCatInputs by remember { mutableStateOf<Map<String, String>>(emptyMap()) }

    StoreDashboardShell(
        storeName = activeStore.name,
        storeDomain = activeStore.domain,
        currentScreen = AppScreen.STORE_CATEGORIES,
        screenTitle = "Categories & Sub-categories",
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
                title = "Categories & Sub-categories",
                subtitle = "Create parent categories and nested sub-categories for ${activeStore.name}."
            )

            ShadcnCard {
                CardHeader(
                    title = "Create New Category",
                    description = "Add a parent category with comma-separated sub-categories"
                )
                Column(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(16.dp),
                    verticalArrangement = Arrangement.spacedBy(10.dp)
                ) {
                    ShadcnInput(
                        value = newCategoryName,
                        onValueChange = {
                            newCategoryName = it
                            newCategorySlug = it.lowercase().replace(" ", "-")
                        },
                        placeholder = "Category name (e.g. Smart Home)",
                        testTag = "category_name_input"
                    )
                    ShadcnInput(
                        value = newSubCategoriesCsv,
                        onValueChange = { newSubCategoriesCsv = it },
                        placeholder = "Sub-categories (comma separated)",
                        testTag = "category_subs_input"
                    )
                    ShadcnPrimaryButton(
                        text = "Create Category",
                        icon = Icons.Outlined.Add,
                        onClick = {
                            if (newCategoryName.isNotBlank()) {
                                val subs = newSubCategoriesCsv
                                    .split(",")
                                    .map { it.trim() }
                                    .filter { it.isNotEmpty() }
                                onAddCategory(newCategoryName, newCategorySlug, subs)
                                newCategoryName = ""
                                newCategorySlug = ""
                            }
                        },
                        modifier = Modifier.fillMaxWidth()
                    )
                }
            }

            uiState.categories.forEach { category ->
                ShadcnCard {
                    Column(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(16.dp),
                        verticalArrangement = Arrangement.spacedBy(12.dp)
                    ) {
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.SpaceBetween,
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Column {
                                Text(
                                    text = category.name,
                                    fontFamily = FigtreeFontFamily,
                                    fontWeight = FontWeight.Bold,
                                    fontSize = 15.sp,
                                    color = ShadcnForeground
                                )
                                Text(
                                    text = "/${category.slug} · ${category.productCount} products",
                                    fontFamily = JetBrainsMonoFontFamily,
                                    fontSize = 11.sp,
                                    color = ShadcnMutedForeground
                                )
                            }
                            StatusPill(
                                text = "${category.subCategories.size} sub-categories",
                                tone = StatusTone.GREEN
                            )
                        }

                        FlowRow(
                            horizontalArrangement = Arrangement.spacedBy(8.dp),
                            verticalArrangement = Arrangement.spacedBy(8.dp)
                        ) {
                            category.subCategories.forEach { sub ->
                                Box(
                                    modifier = Modifier
                                        .padding(horizontal = 10.dp, vertical = 5.dp)
                                ) {
                                    Text(
                                        text = sub,
                                        fontFamily = FigtreeFontFamily,
                                        fontWeight = FontWeight.Medium,
                                        fontSize = 12.sp,
                                        color = ShadcnForeground
                                    )
                                }
                            }
                        }

                        val subInput = subCatInputs[category.id] ?: ""
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.spacedBy(8.dp),
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            ShadcnInput(
                                value = subInput,
                                onValueChange = {
                                    subCatInputs = subCatInputs + (category.id to it)
                                },
                                placeholder = "Add sub-category...",
                                modifier = Modifier.weight(1f)
                            )
                            ShadcnOutlineButton(
                                text = "Add Sub",
                                icon = Icons.Outlined.Add,
                                onClick = {
                                    if (subInput.isNotBlank()) {
                                        onAddSubCategory(category.id, subInput)
                                        subCatInputs = subCatInputs + (category.id to "")
                                    }
                                }
                            )
                        }
                    }
                }
            }
        }
    }
}

/**
 * 3. Products Catalog Page (`AppScreen.STORE_PRODUCTS`)
 */
@Composable
fun StoreProductsCatalogScreen(
    uiState: TiwloUiState,
    onNavigate: (AppScreen) -> Unit,
    onBack: () -> Unit,
    onSwitchToMainDashboard: () -> Unit
) {
    val activeStore = uiState.stores.firstOrNull { it.id == uiState.activeStoreId } ?: uiState.stores.first()
    var query by remember { mutableStateOf("") }

    val filtered = remember(uiState.products, query) {
        if (query.isBlank()) uiState.products
        else uiState.products.filter {
            it.name.contains(query, ignoreCase = true) ||
                it.sku.contains(query, ignoreCase = true) ||
                it.category.contains(query, ignoreCase = true)
        }
    }

    StoreDashboardShell(
        storeName = activeStore.name,
        storeDomain = activeStore.domain,
        currentScreen = AppScreen.STORE_PRODUCTS,
        screenTitle = "Products Catalog",
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
                title = "Products (${uiState.products.size})",
                subtitle = "Manage pricing, SKUs, and categories for ${activeStore.name}."
            ) {
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    ShadcnPrimaryButton(
                        text = "Create Product",
                        icon = Icons.Outlined.Add,
                        onClick = { onNavigate(AppScreen.STORE_CREATE_PRODUCT) }
                    )
                    ShadcnOutlineButton(
                        text = "Categories",
                        onClick = { onNavigate(AppScreen.STORE_CATEGORIES) }
                    )
                }
            }

            ShadcnInput(
                value = query,
                onValueChange = { query = it },
                placeholder = "Search by product name, SKU or category...",
                leadingIcon = Icons.Outlined.Search
            )

            filtered.forEach { product ->
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
                                text = product.name,
                                fontFamily = FigtreeFontFamily,
                                fontWeight = FontWeight.Bold,
                                fontSize = 14.sp,
                                color = ShadcnForeground
                            )
                            Text(
                                text = "SKU: ${product.sku} · ${product.category}",
                                fontFamily = JetBrainsMonoFontFamily,
                                fontSize = 11.sp,
                                color = ShadcnMutedForeground
                            )
                            Spacer(modifier = Modifier.height(4.dp))
                            Text(
                                text = "৳${product.priceBdt} · ${product.soldCount} sold",
                                fontFamily = FigtreeFontFamily,
                                fontWeight = FontWeight.SemiBold,
                                fontSize = 13.sp,
                                color = ShadcnForeground
                            )
                        }
                        val tone = when (product.status) {
                            "In Stock" -> StatusTone.GREEN
                            "Low Stock" -> StatusTone.AMBER
                            else -> StatusTone.RED
                        }
                        Column(horizontalAlignment = Alignment.End) {
                            StatusPill(text = product.status, tone = tone)
                            Spacer(modifier = Modifier.height(4.dp))
                            Text(
                                text = "${product.stock} units",
                                fontFamily = JetBrainsMonoFontFamily,
                                fontSize = 11.sp,
                                color = ShadcnMutedForeground
                            )
                        }
                    }
                }
            }
        }
    }
}

/**
 * 4. POS Terminal Page (`AppScreen.STORE_POS`)
 */
@Composable
fun StorePosScreen(
    uiState: TiwloUiState,
    onNavigate: (AppScreen) -> Unit,
    onBack: () -> Unit,
    onSwitchToMainDashboard: () -> Unit,
    onAddToPosCart: (String) -> Unit,
    onRemoveFromPosCart: (String) -> Unit,
    onClearPosCart: () -> Unit,
    onCheckoutPos: (String, String) -> Unit
) {
    val activeStore = uiState.stores.firstOrNull { it.id == uiState.activeStoreId } ?: uiState.stores.first()
    var customerName by remember { mutableStateOf("Walk-in Customer") }
    var paymentMethod by remember { mutableStateOf("") }

    val cartProducts = uiState.posCart.mapNotNull { (pid, qty) ->
        uiState.products.firstOrNull { it.id == pid }?.let { it to qty }
    }
    val subtotal = cartProducts.sumOf { (prod, qty) -> prod.priceBdt * qty }

    StoreDashboardShell(
        storeName = activeStore.name,
        storeDomain = activeStore.domain,
        currentScreen = AppScreen.STORE_POS,
        screenTitle = "POS Terminal",
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
                title = "Point of Sale (POS)",
                subtitle = "Tap products or use QR T-Scan to add items to the counter bill."
            ) {
                ShadcnOutlineButton(
                    text = "Open QR / Barcode T-Scan",
                    icon = Icons.Outlined.QrCodeScanner,
                    onClick = { onNavigate(AppScreen.STORE_TSCAN) }
                )
            }

            // Cart Summary Card
            ShadcnCard {
                CardHeader(
                    title = "Active Cart (${uiState.posCart.values.sum()} items)",
                    description = "Subtotal: ৳$subtotal",
                    action = {
                        if (cartProducts.isNotEmpty()) {
                            ShadcnOutlineButton(
                                text = "Clear",
                                icon = Icons.Outlined.DeleteOutline,
                                onClick = onClearPosCart
                            )
                        }
                    }
                )
                Column(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(16.dp),
                    verticalArrangement = Arrangement.spacedBy(10.dp)
                ) {
                    if (cartProducts.isEmpty()) {
                        Text(
                            text = "No items in cart. Tap any product below or scan with T-Scan.",
                            fontFamily = FigtreeFontFamily,
                            fontSize = 13.sp,
                            color = ShadcnMutedForeground
                        )
                    } else {
                        cartProducts.forEach { (prod, qty) ->
                            Row(
                                modifier = Modifier.fillMaxWidth(),
                                horizontalArrangement = Arrangement.SpaceBetween,
                                verticalAlignment = Alignment.CenterVertically
                            ) {
                                Column(modifier = Modifier.weight(1f)) {
                                    Text(
                                        text = prod.name,
                                        fontFamily = FigtreeFontFamily,
                                        fontWeight = FontWeight.SemiBold,
                                        fontSize = 13.sp,
                                        color = ShadcnForeground
                                    )
                                    Text(
                                        text = "৳${prod.priceBdt} × $qty = ৳${prod.priceBdt * qty}",
                                        fontFamily = JetBrainsMonoFontFamily,
                                        fontSize = 11.sp,
                                        color = ShadcnMutedForeground
                                    )
                                }
                                Row(
                                    verticalAlignment = Alignment.CenterVertically,
                                    horizontalArrangement = Arrangement.spacedBy(6.dp)
                                ) {
                                    Box(
                                        modifier = Modifier
                                            .size(28.dp)
                                            .clip(RoundedCornerShape(6.dp))
                                            .background(ShadcnMuted)
                                            .clickable { onRemoveFromPosCart(prod.id) },
                                        contentAlignment = Alignment.Center
                                    ) {
                                        Icon(
                                            imageVector = Icons.Outlined.Remove,
                                            contentDescription = "Decrease",
                                            tint = ShadcnForeground,
                                            modifier = Modifier.size(14.dp)
                                        )
                                    }
                                    Text(
                                        text = qty.toString(),
                                        fontFamily = JetBrainsMonoFontFamily,
                                        fontWeight = FontWeight.Bold,
                                        fontSize = 13.sp,
                                        color = ShadcnForeground
                                    )
                                    Box(
                                        modifier = Modifier
                                            .size(28.dp)
                                            .clip(RoundedCornerShape(6.dp))
                                            .background(ShadcnInk)
                                            .clickable { onAddToPosCart(prod.id) },
                                        contentAlignment = Alignment.Center
                                    ) {
                                        Icon(
                                            imageVector = Icons.Outlined.Add,
                                            contentDescription = "Increase",
                                            tint = ShadcnPrimary,
                                            modifier = Modifier.size(14.dp)
                                        )
                                    }
                                }
                            }
                        }
                    }

                    HorizontalDivider(color = ShadcnBorder)

                    ShadcnInput(
                        value = customerName,
                        onValueChange = { customerName = it },
                        placeholder = "Customer Name"
                    )

                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.spacedBy(8.dp)
                    ) {
                        listOf("bKash QR", "Cash", "Card", "Nagad").forEach { method ->
                            val active = paymentMethod == method
                            Box(
                                modifier = Modifier
                                    .weight(1f)
                                    .clip(RoundedCornerShape(8.dp))
                                    .background(if (active) ShadcnInk else ShadcnMuted)
                                    .clickable { paymentMethod = method }
                                    .padding(vertical = 8.dp),
                                contentAlignment = Alignment.Center
                            ) {
                                Text(
                                    text = method,
                                    fontFamily = FigtreeFontFamily,
                                    fontWeight = FontWeight.SemiBold,
                                    fontSize = 11.sp,
                                    color = if (active) Color.White else ShadcnForeground
                                )
                            }
                        }
                    }

                    ShadcnPrimaryButton(
                        text = "Complete POS Sale (৳$subtotal)",
                        icon = Icons.Outlined.PointOfSale,
                        onClick = { onCheckoutPos(customerName, paymentMethod) },
                        modifier = Modifier
                            .fillMaxWidth()
                            .testTag("pos_complete_sale_button")
                    )
                }
            }

            // Quick Tap Products Grid
            ShadcnCard {
                CardHeader(
                    title = "Quick Tap Products",
                    description = "Tap any item to add +1 to POS cart"
                )
                Column(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(16.dp),
                    verticalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    uiState.products.forEach { prod ->
                        Row(
                            modifier = Modifier
                                .fillMaxWidth()
                                .clickable { onAddToPosCart(prod.id) }
                                .padding(horizontal = 14.dp, vertical = 10.dp),
                            horizontalArrangement = Arrangement.SpaceBetween,
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Column {
                                Text(
                                    text = prod.name,
                                    fontFamily = FigtreeFontFamily,
                                    fontWeight = FontWeight.SemiBold,
                                    fontSize = 13.sp,
                                    color = ShadcnForeground
                                )
                                Text(
                                    text = "${prod.sku} · Stock: ${prod.stock}",
                                    fontFamily = JetBrainsMonoFontFamily,
                                    fontSize = 11.sp,
                                    color = ShadcnMutedForeground
                                )
                            }
                            Text(
                                text = "+ ৳${prod.priceBdt}",
                                fontFamily = JetBrainsMonoFontFamily,
                                fontWeight = FontWeight.Bold,
                                fontSize = 13.sp,
                                color = ShadcnPrimaryDark
                            )
                        }
                    }
                }
            }
        }
    }
}

/**
 * 5. Sales & Orders Page (`AppScreen.STORE_ORDERS`)
 */
@Composable
fun StoreOrdersScreen(
    uiState: TiwloUiState,
    onNavigate: (AppScreen) -> Unit,
    onBack: () -> Unit,
    onSwitchToMainDashboard: () -> Unit,
    onAdvanceOrderStatus: (String) -> Unit
) {
    val activeStore = uiState.stores.firstOrNull { it.id == uiState.activeStoreId } ?: uiState.stores.first()

    StoreDashboardShell(
        storeName = activeStore.name,
        storeDomain = activeStore.domain,
        currentScreen = AppScreen.STORE_ORDERS,
        screenTitle = "Sales & Orders",
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
                title = "Customer Orders (${uiState.orders.size})",
                subtitle = "Fulfill orders, print shipping labels, and advance delivery states."
            )

            uiState.orders.forEach { order ->
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
                            Column {
                                Text(
                                    text = "${order.id} · ${order.customer}",
                                    fontFamily = FigtreeFontFamily,
                                    fontWeight = FontWeight.Bold,
                                    fontSize = 14.sp,
                                    color = ShadcnForeground
                                )
                                Text(
                                    text = "${order.items} items · ${order.payment} · ${order.date}",
                                    fontFamily = FigtreeFontFamily,
                                    fontSize = 12.sp,
                                    color = ShadcnMutedForeground
                                )
                            }
                            val tone = when (order.status) {
                                "Delivered", "Completed" -> StatusTone.GREEN
                                "Processing", "Shipped" -> StatusTone.BLUE
                                else -> StatusTone.AMBER
                            }
                            StatusPill(text = order.status, tone = tone)
                        }
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.SpaceBetween,
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Text(
                                text = "Total: ৳${order.totalBdt}",
                                fontFamily = JetBrainsMonoFontFamily,
                                fontWeight = FontWeight.Bold,
                                fontSize = 14.sp,
                                color = ShadcnForeground
                            )
                            ShadcnOutlineButton(
                                text = "Advance Status",
                                onClick = { onAdvanceOrderStatus(order.id) }
                            )
                        }
                    }
                }
            }
        }
    }
}
