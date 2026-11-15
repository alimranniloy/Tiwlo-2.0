package com.example.ui.components

import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ColumnScope
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.outlined.ArrowBack
import androidx.compose.material.icons.automirrored.outlined.HelpOutline
import androidx.compose.material.icons.automirrored.outlined.Logout
import androidx.compose.material.icons.outlined.AccountBalanceWallet
import androidx.compose.material.icons.outlined.Add
import androidx.compose.material.icons.outlined.AddCircleOutline
import androidx.compose.material.icons.outlined.Analytics
import androidx.compose.material.icons.outlined.Backup
import androidx.compose.material.icons.outlined.Campaign
import androidx.compose.material.icons.outlined.Category
import androidx.compose.material.icons.outlined.CheckCircle
import androidx.compose.material.icons.outlined.ChevronRight
import androidx.compose.material.icons.outlined.CloudQueue
import androidx.compose.material.icons.outlined.Close
import androidx.compose.material.icons.outlined.ConfirmationNumber
import androidx.compose.material.icons.outlined.CreditCard
import androidx.compose.material.icons.outlined.Dashboard
import androidx.compose.material.icons.outlined.Dns
import androidx.compose.material.icons.outlined.Group
import androidx.compose.material.icons.outlined.GridView
import androidx.compose.material.icons.outlined.Hub
import androidx.compose.material.icons.outlined.Inventory2
import androidx.compose.material.icons.outlined.Language
import androidx.compose.material.icons.outlined.LocalShipping
import androidx.compose.material.icons.outlined.Mail
import androidx.compose.material.icons.outlined.ManageAccounts
import androidx.compose.material.icons.outlined.NotificationsNone
import androidx.compose.material.icons.outlined.Palette
import androidx.compose.material.icons.outlined.PeopleOutline
import androidx.compose.material.icons.outlined.Person
import androidx.compose.material.icons.outlined.PhotoCamera
import androidx.compose.material.icons.outlined.PointOfSale
import androidx.compose.material.icons.outlined.QrCodeScanner
import androidx.compose.material.icons.outlined.ReceiptLong
import androidx.compose.material.icons.outlined.Search
import androidx.compose.material.icons.outlined.Security
import androidx.compose.material.icons.outlined.Settings
import androidx.compose.material.icons.outlined.ShoppingBag
import androidx.compose.material.icons.outlined.ShoppingCart
import androidx.compose.material.icons.outlined.StarOutline
import androidx.compose.material.icons.outlined.Storage
import androidx.compose.material.icons.outlined.Storefront
import androidx.compose.material.icons.outlined.SwapHoriz
import androidx.compose.material.icons.outlined.Terminal
import androidx.compose.material.icons.outlined.VerifiedUser
import androidx.compose.material.icons.outlined.ViewInAr
import androidx.compose.material.icons.outlined.VpnKey
import androidx.compose.material.icons.outlined.WaterDrop
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.example.model.AppScreen
import com.example.model.NotificationItem
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
import com.example.ui.theme.ShadcnSurfaceSubtle

/**
 * Shared flat heading section for account and dashboard screens.
 */
@Composable
fun TiwloRingHeroCard(
    eyebrow: String? = null,
    title: String,
    subtitle: String? = null,
    badgeText: String? = null,
    modifier: Modifier = Modifier,
    content: (@Composable ColumnScope.() -> Unit)? = null
) {
    Box(
        modifier = modifier
            .fillMaxWidth()
    ) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = 18.dp, vertical = 18.dp)
        ) {
            if (!eyebrow.isNullOrBlank() || badgeText != null) {
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    if (!eyebrow.isNullOrBlank()) {
                        Text(
                            text = eyebrow,
                            fontFamily = FigtreeFontFamily,
                            fontWeight = FontWeight.Medium,
                            fontSize = 12.sp,
                            color = ShadcnMutedForeground
                        )
                    } else {
                        Spacer(modifier = Modifier.width(1.dp))
                    }
                    if (badgeText != null) {
                        Box(
                            modifier = Modifier
                                .clip(RoundedCornerShape(50))
                                .background(ShadcnPrimary.copy(alpha = 0.16f))
                                .border(1.dp, ShadcnPrimary.copy(alpha = 0.45f), RoundedCornerShape(50))
                                .padding(horizontal = 10.dp, vertical = 4.dp)
                        ) {
                            Text(
                                text = badgeText,
                                fontFamily = JetBrainsMonoFontFamily,
                                fontWeight = FontWeight.SemiBold,
                                fontSize = 10.sp,
                                color = ShadcnPrimary
                            )
                        }
                    }
                }
                Spacer(modifier = Modifier.height(6.dp))
            }

            Text(
                text = title,
                fontFamily = FigtreeFontFamily,
                fontWeight = FontWeight.Bold,
                fontSize = 21.sp,
                color = ShadcnForeground,
                letterSpacing = (-0.5).sp
            )

            if (!subtitle.isNullOrBlank()) {
                Spacer(modifier = Modifier.height(4.dp))
                Text(
                    text = subtitle,
                    fontFamily = FigtreeFontFamily,
                    fontSize = 12.sp,
                    color = ShadcnMutedForeground,
                    lineHeight = 17.sp
                )
            }

            if (content != null) {
                Spacer(modifier = Modifier.height(14.dp))
                content()
            }
        }
    }
}

/**
 * Main Console Mobile Shell (Droplets, Stores Hub, Mail, UIDs, Main Menu).
 */
@Composable
fun DashboardShell(
    currentScreen: AppScreen,
    screenTitle: String,
    screenSubtitle: String? = null,
    isSubPage: Boolean = false,
    darkTopHeader: Boolean = false,
    onBackClick: () -> Unit = {},
    unreadNotificationCount: Int,
    notifications: List<NotificationItem>,
    onNavigate: (AppScreen) -> Unit,
    onMarkAllNotificationsRead: () -> Unit,
    onNotificationClick: (String) -> Unit,
    content: @Composable (PaddingValues) -> Unit
) {
    var notificationsOpen by remember { mutableStateOf(false) }

    Scaffold(
        containerColor = ShadcnSurfaceSubtle,
        topBar = {
            MobileAppTopBar(
                currentScreen = currentScreen,
                screenTitle = screenTitle,
                screenSubtitle = screenSubtitle,
                isSubPage = isSubPage,
                darkTopHeader = darkTopHeader,
                unreadCount = unreadNotificationCount,
                onBackClick = onBackClick,
                onToggleNotifications = { notificationsOpen = !notificationsOpen },
                onNavigate = onNavigate
            )
        },
        bottomBar = {
            MobileBottomTabBar(
                currentScreen = currentScreen,
                onNavigate = onNavigate
            )
        }
    ) { innerPadding ->
        Box(modifier = Modifier.fillMaxSize()) {
            content(innerPadding)

            if (notificationsOpen) {
                NotificationPanelOverlay(
                    notifications = notifications,
                    unreadCount = unreadNotificationCount,
                    onMarkAllRead = onMarkAllNotificationsRead,
                    onNotificationClick = onNotificationClick,
                    onDismiss = { notificationsOpen = false },
                    modifier = Modifier
                        .align(Alignment.TopEnd)
                        .padding(top = innerPadding.calculateTopPadding() + 6.dp, end = 12.dp)
                )
            }
        }
    }
}

/**
 * Dedicated Store Admin Mobile Shell (used ONLY when inside a Store like TiwiMart).
 * Includes its own Store Admin Top Bar with a prominent "Switch to Dashboard" button
 * and its own Store Admin Bottom Bar (Overview, Products, POS / T-Scan, Orders, Store Menu).
 */
@Composable
fun StoreDashboardShell(
    storeName: String,
    storeDomain: String,
    currentScreen: AppScreen,
    screenTitle: String,
    isSubPage: Boolean = false,
    onBackClick: () -> Unit = {},
    onSwitchToMainDashboard: () -> Unit,
    onNavigate: (AppScreen) -> Unit,
    content: @Composable (PaddingValues) -> Unit
) {
    Scaffold(
        containerColor = ShadcnSurfaceSubtle,
        topBar = {
            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .background(ShadcnBackground)
                    .statusBarsPadding()
            ) {
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .height(58.dp)
                        .padding(horizontal = 12.dp),
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.SpaceBetween
                ) {
                    Row(
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(10.dp),
                        modifier = Modifier.weight(1f)
                    ) {
                        if (isSubPage) {
                            Box(
                                modifier = Modifier
                                    .size(38.dp)
                                    .clip(RoundedCornerShape(11.dp))
                                    .background(ShadcnMuted)
                                    .border(1.dp, ShadcnBorder, RoundedCornerShape(11.dp))
                                    .clickable(onClick = onBackClick)
                                    .testTag("store_back_button"),
                                contentAlignment = Alignment.Center
                            ) {
                                Icon(
                                    imageVector = Icons.AutoMirrored.Outlined.ArrowBack,
                                    contentDescription = "Back",
                                    tint = ShadcnForeground,
                                    modifier = Modifier.size(18.dp)
                                )
                            }
                        } else {
                            Box(
                                modifier = Modifier
                                    .size(36.dp)
                                    .clip(RoundedCornerShape(10.dp))
                                    .background(ShadcnInk),
                                contentAlignment = Alignment.Center
                            ) {
                                Icon(
                                    imageVector = Icons.Outlined.Storefront,
                                    contentDescription = storeName,
                                    tint = ShadcnPrimary,
                                    modifier = Modifier.size(18.dp)
                                )
                            }
                        }

                        Column(modifier = Modifier.weight(1f, fill = false)) {
                            Row(
                                verticalAlignment = Alignment.CenterVertically,
                                horizontalArrangement = Arrangement.spacedBy(6.dp)
                            ) {
                                Text(
                                    text = if (isSubPage) screenTitle else storeName,
                                    fontFamily = FigtreeFontFamily,
                                    fontWeight = FontWeight.Bold,
                                    fontSize = 15.sp,
                                    color = ShadcnForeground,
                                    maxLines = 1,
                                    overflow = TextOverflow.Ellipsis
                                )
                                Box(
                                    modifier = Modifier
                                        .clip(RoundedCornerShape(6.dp))
                                        .background(ShadcnPrimary.copy(alpha = 0.15f))
                                        .padding(horizontal = 6.dp, vertical = 2.dp)
                                ) {
                                    Text(
                                        text = "STORE",
                                        fontFamily = JetBrainsMonoFontFamily,
                                        fontWeight = FontWeight.Bold,
                                        fontSize = 9.sp,
                                        color = ShadcnPrimaryDark
                                    )
                                }
                            }
                            Text(
                                text = storeDomain,
                                fontFamily = JetBrainsMonoFontFamily,
                                fontSize = 10.sp,
                                color = ShadcnMutedForeground,
                                maxLines = 1,
                                overflow = TextOverflow.Ellipsis
                            )
                        }
                    }

                    // Prominent "Switch to Dashboard" button
                    Row(
                        modifier = Modifier
                            .clip(RoundedCornerShape(50))
                            .background(ShadcnInk)
                            .clickable(onClick = onSwitchToMainDashboard)
                            .padding(horizontal = 11.dp, vertical = 7.dp)
                            .testTag("switch_to_dashboard_button"),
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(5.dp)
                    ) {
                        Icon(
                            imageVector = Icons.Outlined.SwapHoriz,
                            contentDescription = "Switch to Dashboard",
                            tint = ShadcnPrimary,
                            modifier = Modifier.size(15.dp)
                        )
                        Text(
                            text = "Switch to Dashboard",
                            fontFamily = FigtreeFontFamily,
                            fontWeight = FontWeight.SemiBold,
                            fontSize = 11.sp,
                            color = Color.White
                        )
                    }
                }
                HorizontalDivider(color = ShadcnBorder, thickness = 1.dp)
            }
        },
        bottomBar = {
            StoreBottomTabBar(
                currentScreen = currentScreen,
                onNavigate = onNavigate
            )
        }
    ) { innerPadding ->
        content(innerPadding)
    }
}

@Composable
private fun MobileAppTopBar(
    currentScreen: AppScreen,
    screenTitle: String,
    screenSubtitle: String?,
    isSubPage: Boolean,
    darkTopHeader: Boolean,
    unreadCount: Int,
    onBackClick: () -> Unit,
    onToggleNotifications: () -> Unit,
    onNavigate: (AppScreen) -> Unit
) {
    val bgColor = if (darkTopHeader) ShadcnInk else ShadcnBackground
    val contentColor = if (darkTopHeader) Color.White else ShadcnForeground
    val subColor = if (darkTopHeader) Color.White.copy(alpha = 0.65f) else ShadcnMutedForeground

    Column(
        modifier = Modifier
            .fillMaxWidth()
            .background(bgColor)
            .statusBarsPadding()
    ) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .height(56.dp)
                .padding(horizontal = 14.dp),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.SpaceBetween
        ) {
            Row(
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(10.dp),
                modifier = Modifier.weight(1f)
            ) {
                if (isSubPage) {
                    Box(
                        modifier = Modifier
                            .size(38.dp)
                            .clip(RoundedCornerShape(11.dp))
                            .background(if (darkTopHeader) Color(0xFF1A1A1A) else ShadcnMuted)
                            .border(
                                1.dp,
                                if (darkTopHeader) Color(0xFF2B2B2B) else ShadcnBorder,
                                RoundedCornerShape(11.dp)
                            )
                            .clickable(onClick = onBackClick)
                            .testTag("mobile_back_button"),
                        contentAlignment = Alignment.Center
                    ) {
                        Icon(
                            imageVector = Icons.AutoMirrored.Outlined.ArrowBack,
                            contentDescription = "Back",
                            tint = contentColor,
                            modifier = Modifier.size(18.dp)
                        )
                    }
                } else {
                    TiwloRingBrandMark(size = 34)
                }

                Column(modifier = Modifier.weight(1f, fill = false)) {
                    Text(
                        text = screenTitle,
                        fontFamily = FigtreeFontFamily,
                        fontWeight = FontWeight.Bold,
                        fontSize = 16.sp,
                        color = contentColor,
                        maxLines = 1,
                        overflow = TextOverflow.Ellipsis
                    )
                    if (!screenSubtitle.isNullOrBlank()) {
                        Text(
                            text = screenSubtitle,
                            fontFamily = FigtreeFontFamily,
                            fontSize = 11.sp,
                            color = subColor,
                            maxLines = 1,
                            overflow = TextOverflow.Ellipsis
                        )
                    }
                }
            }

            Row(
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                if (!isSubPage && currentScreen == AppScreen.CLOUD) {
                    Row(
                        modifier = Modifier
                            .clip(RoundedCornerShape(50))
                            .background(ShadcnPrimary)
                            .clickable { onNavigate(AppScreen.CLOUD_CREATE_DROPLET) }
                            .padding(horizontal = 11.dp, vertical = 6.dp)
                            .testTag("topbar_quick_action"),
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(4.dp)
                    ) {
                        Icon(
                            imageVector = Icons.Outlined.Add,
                            contentDescription = "New Droplet",
                            tint = ShadcnInk,
                            modifier = Modifier.size(14.dp)
                        )
                        Text(
                            text = "Droplet",
                            fontFamily = FigtreeFontFamily,
                            fontWeight = FontWeight.Bold,
                            fontSize = 11.sp,
                            color = ShadcnInk
                        )
                    }
                }

                Box(
                    modifier = Modifier
                        .size(38.dp)
                        .clip(RoundedCornerShape(11.dp))
                        .background(if (darkTopHeader) Color(0xFF1A1A1A) else ShadcnMuted)
                        .clickable(onClick = onToggleNotifications)
                        .testTag("topbar_notifications_button"),
                    contentAlignment = Alignment.Center
                ) {
                    Icon(
                        imageVector = Icons.Outlined.NotificationsNone,
                        contentDescription = "Notifications",
                        tint = contentColor,
                        modifier = Modifier.size(19.dp)
                    )
                    if (unreadCount > 0) {
                        Box(
                            modifier = Modifier
                                .align(Alignment.TopEnd)
                                .padding(top = 7.dp, end = 7.dp)
                                .size(8.dp)
                                .clip(CircleShape)
                                .background(ShadcnPrimary)
                        )
                    }
                }

                Box(
                    modifier = Modifier
                        .size(36.dp)
                        .clip(CircleShape)
                        .background(if (darkTopHeader) Color(0xFF1F1F1F) else ShadcnInk)
                        .border(1.5.dp, ShadcnPrimary, CircleShape)
                        .clickable { onNavigate(AppScreen.ONEPROFILE) }
                        .testTag("topbar_avatar_button"),
                    contentAlignment = Alignment.Center
                ) {
                    Text(
                        text = "R",
                        fontFamily = FigtreeFontFamily,
                        fontWeight = FontWeight.Bold,
                        fontSize = 13.sp,
                        color = ShadcnPrimary
                    )
                }
            }
        }
        if (!darkTopHeader) {
            HorizontalDivider(color = ShadcnBorder, thickness = 1.dp)
        }
    }
}

@Composable
fun TiwloRingBrandMark(size: Int = 34) {
    Box(
        modifier = Modifier
            .size(size.dp)
            .clip(RoundedCornerShape(10.dp))
            .background(ShadcnInk),
        contentAlignment = Alignment.Center
    ) {
        Canvas(modifier = Modifier.size((size * 0.56f).dp)) {
            drawCircle(
                color = ShadcnPrimary,
                style = Stroke(width = 3.5.dp.toPx())
            )
        }
    }
}

@Composable
private fun NotificationPanelOverlay(
    notifications: List<NotificationItem>,
    unreadCount: Int,
    onMarkAllRead: () -> Unit,
    onNotificationClick: (String) -> Unit,
    onDismiss: () -> Unit,
    modifier: Modifier = Modifier
) {
    Surface(
        modifier = modifier
            .width(330.dp)
            .border(1.dp, ShadcnBorder, RoundedCornerShape(16.dp)),
        shape = RoundedCornerShape(16.dp),
        color = ShadcnBackground,
        shadowElevation = 12.dp
    ) {
        Column(modifier = Modifier.fillMaxWidth()) {
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(horizontal = 16.dp, vertical = 12.dp),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Row(
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    Text(
                        text = "Notifications",
                        fontFamily = FigtreeFontFamily,
                        fontWeight = FontWeight.SemiBold,
                        fontSize = 14.sp,
                        color = ShadcnForeground
                    )
                    if (unreadCount > 0) {
                        Box(
                            modifier = Modifier
                                .clip(RoundedCornerShape(50))
                                .background(ShadcnInk)
                                .padding(horizontal = 6.dp, vertical = 2.dp)
                        ) {
                            Text(
                                text = unreadCount.toString(),
                                fontFamily = FigtreeFontFamily,
                                fontWeight = FontWeight.Bold,
                                fontSize = 10.sp,
                                color = Color.White
                            )
                        }
                    }
                }
                Row(
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    if (unreadCount > 0) {
                        Text(
                            text = "Mark all read",
                            fontFamily = FigtreeFontFamily,
                            fontWeight = FontWeight.Medium,
                            fontSize = 12.sp,
                            color = ShadcnMutedForeground,
                            modifier = Modifier.clickable(onClick = onMarkAllRead)
                        )
                    }
                    Icon(
                        imageVector = Icons.Outlined.Close,
                        contentDescription = "Close notifications",
                        tint = ShadcnMutedForeground,
                        modifier = Modifier
                            .size(18.dp)
                            .clickable(onClick = onDismiss)
                    )
                }
            }
            HorizontalDivider(color = ShadcnBorder, thickness = 1.dp)

            Column(modifier = Modifier.fillMaxWidth()) {
                notifications.forEachIndexed { idx, item ->
                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .background(
                                if (item.unread) ShadcnMuted.copy(alpha = 0.45f)
                                else Color.Transparent
                            )
                            .clickable { onNotificationClick(item.id) }
                            .padding(horizontal = 16.dp, vertical = 12.dp),
                        horizontalArrangement = Arrangement.spacedBy(10.dp),
                        verticalAlignment = Alignment.Top
                    ) {
                        Box(
                            modifier = Modifier
                                .padding(top = 5.dp)
                                .size(7.dp)
                                .clip(CircleShape)
                                .background(if (item.unread) ShadcnPrimary else ShadcnBorder)
                        )
                        Column(modifier = Modifier.weight(1f)) {
                            Text(
                                text = item.title,
                                fontFamily = FigtreeFontFamily,
                                fontWeight = FontWeight.Medium,
                                fontSize = 13.sp,
                                color = ShadcnForeground
                            )
                            Spacer(modifier = Modifier.height(2.dp))
                            Text(
                                text = item.desc,
                                fontFamily = FigtreeFontFamily,
                                fontSize = 12.sp,
                                color = ShadcnMutedForeground
                            )
                            Spacer(modifier = Modifier.height(3.dp))
                            Text(
                                text = item.time,
                                fontFamily = FigtreeFontFamily,
                                fontSize = 11.sp,
                                color = ShadcnMutedForeground.copy(alpha = 0.8f)
                            )
                        }
                    }
                    if (idx < notifications.lastIndex) {
                        HorizontalDivider(color = ShadcnBorder.copy(alpha = 0.6f), thickness = 1.dp)
                    }
                }
            }
        }
    }
}

private data class BottomTabItem(
    val label: String,
    val screen: AppScreen,
    val icon: ImageVector,
    val matches: Set<AppScreen>
)

@Composable
private fun MobileBottomTabBar(
    currentScreen: AppScreen,
    onNavigate: (AppScreen) -> Unit
) {
    // Main Console Bottom Tab Bar:
    // Uses WaterDrop icon + "Droplets" label instead of Cloud text!
    // Clicking "Stores" opens STORES_HUB (Create Store + Your Stores list)
    val tabs = listOf(
        BottomTabItem(
            label = "Droplets",
            screen = AppScreen.CLOUD,
            icon = Icons.Outlined.WaterDrop,
            matches = setOf(
                AppScreen.CLOUD,
                AppScreen.CLOUD_DROPLETS,
                AppScreen.CLOUD_CREATE_DROPLET,
                AppScreen.CLOUD_TPANEL,
                AppScreen.CLOUD_KUBERNETES,
                AppScreen.CLOUD_VOLUMES,
                AppScreen.CLOUD_IMAGES,
                AppScreen.CLOUD_SNAPSHOTS,
                AppScreen.CLOUD_BACKUPS,
                AppScreen.CLOUD_DOMAINS,
                AppScreen.CLOUD_FIREWALL,
                AppScreen.CLOUD_SSH_KEYS,
                AppScreen.CLOUD_MARKETPLACE,
                AppScreen.CLOUD_IDENTITY,
                AppScreen.CLOUD_BILLING,
                AppScreen.CLOUD_SETTINGS,
                AppScreen.CLOUD_HELP
            )
        ),
        BottomTabItem(
            label = "Stores",
            screen = AppScreen.STORES_HUB,
            icon = Icons.Outlined.Storefront,
            matches = setOf(
                AppScreen.STORES_HUB,
                AppScreen.CREATE_STORE
            )
        ),
        BottomTabItem(
            label = "Mail",
            screen = AppScreen.EMAIL,
            icon = Icons.Outlined.Mail,
            matches = setOf(AppScreen.EMAIL, AppScreen.EMAIL_COMPOSE)
        ),
        BottomTabItem(
            label = "UIDs",
            screen = AppScreen.ONEPROFILE,
            icon = Icons.Outlined.Person,
            matches = setOf(
                AppScreen.ONEPROFILE,
                AppScreen.ONEPROFILE_EDIT,
                AppScreen.ONEPROFILE_SUBDOMAINS,
                AppScreen.ONEPROFILE_TEMPLATES,
                AppScreen.ONEPROFILE_HOSTING,
                AppScreen.ONEPROFILE_NFC,
                AppScreen.ONEPROFILE_ANALYTICS
            )
        ),
        BottomTabItem(
            label = "Menu",
            screen = AppScreen.MOBILE_MENU,
            icon = Icons.Outlined.GridView,
            matches = setOf(AppScreen.MOBILE_MENU)
        )
    )

    Column(
        modifier = Modifier
            .fillMaxWidth()
            .background(ShadcnBackground)
            .navigationBarsPadding()
    ) {
        HorizontalDivider(color = ShadcnBorder, thickness = 1.dp)
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .height(64.dp)
                .padding(horizontal = 8.dp),
            horizontalArrangement = Arrangement.SpaceAround,
            verticalAlignment = Alignment.CenterVertically
        ) {
            tabs.forEach { tab ->
                val active = currentScreen in tab.matches
                Column(
                    modifier = Modifier
                        .weight(1f)
                        .clip(RoundedCornerShape(12.dp))
                        .clickable { onNavigate(tab.screen) }
                        .padding(vertical = 6.dp)
                        .testTag("bottom_nav_${tab.label.lowercase()}"),
                    horizontalAlignment = Alignment.CenterHorizontally,
                    verticalArrangement = Arrangement.spacedBy(3.dp)
                ) {
                    Box(
                        modifier = Modifier
                            .clip(RoundedCornerShape(50))
                            .background(if (active) ShadcnInk else Color.Transparent)
                            .padding(horizontal = 14.dp, vertical = 4.dp),
                        contentAlignment = Alignment.Center
                    ) {
                        Icon(
                            imageVector = tab.icon,
                            contentDescription = tab.label,
                            tint = if (active) ShadcnPrimary else ShadcnMutedForeground,
                            modifier = Modifier.size(19.dp)
                        )
                    }
                    Text(
                        text = tab.label,
                        fontFamily = FigtreeFontFamily,
                        fontWeight = if (active) FontWeight.Bold else FontWeight.Medium,
                        fontSize = 11.sp,
                        color = if (active) ShadcnForeground else ShadcnMutedForeground
                    )
                }
            }
        }
    }
}

@Composable
private fun StoreBottomTabBar(
    currentScreen: AppScreen,
    onNavigate: (AppScreen) -> Unit
) {
    val tabs = listOf(
        BottomTabItem(
            label = "Overview",
            screen = AppScreen.ECOMMERCE,
            icon = Icons.Outlined.Dashboard,
            matches = setOf(
                AppScreen.ECOMMERCE,
                AppScreen.STORE_ANALYTICS,
                AppScreen.STORE_CHECKLIST
            )
        ),
        BottomTabItem(
            label = "Products",
            screen = AppScreen.STORE_PRODUCTS,
            icon = Icons.Outlined.ShoppingBag,
            matches = setOf(
                AppScreen.STORE_PRODUCTS,
                AppScreen.STORE_CREATE_PRODUCT,
                AppScreen.STORE_CATEGORIES,
                AppScreen.STORE_INVENTORY
            )
        ),
        BottomTabItem(
            label = "POS & Scan",
            screen = AppScreen.STORE_POS,
            icon = Icons.Outlined.QrCodeScanner,
            matches = setOf(
                AppScreen.STORE_POS,
                AppScreen.STORE_TSCAN
            )
        ),
        BottomTabItem(
            label = "Orders",
            screen = AppScreen.STORE_ORDERS,
            icon = Icons.Outlined.ShoppingCart,
            matches = setOf(
                AppScreen.STORE_ORDERS,
                AppScreen.STORE_PURCHASES,
                AppScreen.STORE_SUPPLIERS,
                AppScreen.STORE_CUSTOMERS
            )
        ),
        BottomTabItem(
            label = "Store Menu",
            screen = AppScreen.STORE_MENU,
            icon = Icons.Outlined.GridView,
            matches = setOf(
                AppScreen.STORE_MENU,
                AppScreen.STORE_MARKETING,
                AppScreen.STORE_PROMO_CODES,
                AppScreen.STORE_REVIEWS,
                AppScreen.STORE_THEME,
                AppScreen.STORE_PAYMENTS,
                AppScreen.STORE_SHIPPING,
                AppScreen.STORE_STAFF
            )
        )
    )

    Column(
        modifier = Modifier
            .fillMaxWidth()
            .background(ShadcnBackground)
            .navigationBarsPadding()
    ) {
        HorizontalDivider(color = ShadcnBorder, thickness = 1.dp)
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .height(64.dp)
                .padding(horizontal = 8.dp),
            horizontalArrangement = Arrangement.SpaceAround,
            verticalAlignment = Alignment.CenterVertically
        ) {
            tabs.forEach { tab ->
                val active = currentScreen in tab.matches
                Column(
                    modifier = Modifier
                        .weight(1f)
                        .clip(RoundedCornerShape(12.dp))
                        .clickable { onNavigate(tab.screen) }
                        .padding(vertical = 6.dp)
                        .testTag("store_bottom_nav_${tab.label.lowercase().replace(" ", "_")}"),
                    horizontalAlignment = Alignment.CenterHorizontally,
                    verticalArrangement = Arrangement.spacedBy(3.dp)
                ) {
                    Box(
                        modifier = Modifier
                            .clip(RoundedCornerShape(50))
                            .background(if (active) ShadcnInk else Color.Transparent)
                            .padding(horizontal = 14.dp, vertical = 4.dp),
                        contentAlignment = Alignment.Center
                    ) {
                        Icon(
                            imageVector = tab.icon,
                            contentDescription = tab.label,
                            tint = if (active) ShadcnPrimary else ShadcnMutedForeground,
                            modifier = Modifier.size(19.dp)
                        )
                    }
                    Text(
                        text = tab.label,
                        fontFamily = FigtreeFontFamily,
                        fontWeight = if (active) FontWeight.Bold else FontWeight.Medium,
                        fontSize = 11.sp,
                        color = if (active) ShadcnForeground else ShadcnMutedForeground
                    )
                }
            }
        }
    }
}

/**
 * Main Console Menu Screen (`AppScreen.MOBILE_MENU`).
 * Pure shadcn UI (NO dark ring card!).
 * Contains ONLY the Main Console menu items from `nav-config.ts -> cloud`:
 * - Infrastructure (Dashboard, My Droplets, Create Droplet, Kubernetes, Volumes, Images, Snapshots, Backups, Domains, TPanel, Firewall, SSH Keys)
 * - Workspace hub (Online store -> STORES_HUB, Email, OneProfile, Marketplace, Identity)
 * - Account (Billing, Settings, Help & support, Sign Out)
 */
@Composable
fun MobileMenuHubScreen(
    unreadCount: Int,
    notifications: List<NotificationItem>,
    userName: String,
    userEmail: String,
    accountVerified: Boolean,
    unreadMailCount: Int,
    onNavigate: (AppScreen) -> Unit,
    onSignOut: () -> Unit,
    onMarkAllNotificationsRead: () -> Unit,
    onNotificationClick: (String) -> Unit
) {
    val initials = userName.trim()
        .split(Regex("\\s+"))
        .filter(String::isNotBlank)
        .take(2)
        .joinToString("") { it.take(1).uppercase() }
        .ifBlank { "T" }
    DashboardShell(
        currentScreen = AppScreen.MOBILE_MENU,
        screenTitle = "Main Menu",
        screenSubtitle = "Infrastructure, Workspace Hub & Account",
        isSubPage = false,
        unreadNotificationCount = unreadCount,
        notifications = notifications,
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
            verticalArrangement = Arrangement.spacedBy(18.dp)
        ) {
            // Clean Shadcn User Summary Card (NO dark ring banner here)
            ShadcnCard {
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(16.dp),
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
                                .clip(CircleShape)
                                .background(ShadcnInk),
                            contentAlignment = Alignment.Center
                        ) {
                            Text(
                                text = initials,
                                fontFamily = FigtreeFontFamily,
                                fontWeight = FontWeight.Bold,
                                fontSize = 14.sp,
                                color = ShadcnPrimary
                            )
                        }
                        Column {
                            Text(
                                text = userName.ifBlank { "Tiwlo Account" },
                                fontFamily = FigtreeFontFamily,
                                fontWeight = FontWeight.Bold,
                                fontSize = 15.sp,
                                color = ShadcnForeground
                            )
                            Text(
                                text = userEmail,
                                fontFamily = JetBrainsMonoFontFamily,
                                fontSize = 11.sp,
                                color = ShadcnMutedForeground
                            )
                        }
                    }
                    StatusPill(
                        text = if (accountVerified) "Verified" else "Unverified",
                        tone = if (accountVerified) StatusTone.GREEN else StatusTone.AMBER
                    )
                }
            }

            // 1. Workspace Hub (Exact items from nav-config.ts -> cloud -> Workspace hub)
            MenuGroupCard(
                groupTitle = "WORKSPACE HUB",
                items = listOf(
                    MenuRowSpec(
                        title = "Online Store",
                        subtitle = "Create a new store or open your existing stores",
                        icon = Icons.Outlined.Storefront,
                        badge = "Stores",
                        onClick = { onNavigate(AppScreen.STORES_HUB) }
                    ),
                    MenuRowSpec(
                        title = "Tiwi Mail",
                        subtitle = "Custom domain inbox, threads & composer",
                        icon = Icons.Outlined.Mail,
                        badge = unreadMailCount.takeIf { it > 0 }?.let { "$it unread" },
                        onClick = { onNavigate(AppScreen.EMAIL) }
                    ),
                    MenuRowSpec(
                        title = "OneProfile (UIDs)",
                        subtitle = "Digital identity, NFC cards & static hosting",
                        icon = Icons.Outlined.Person,
                        onClick = { onNavigate(AppScreen.ONEPROFILE) }
                    ),
                    MenuRowSpec(
                        title = "Marketplace",
                        subtitle = "1-click preconfigured cloud apps & stacks",
                        icon = Icons.Outlined.GridView,
                        badge = "New",
                        onClick = { onNavigate(AppScreen.CLOUD_MARKETPLACE) }
                    ),
                    MenuRowSpec(
                        title = "Identity & IAM",
                        subtitle = "SSO, API tokens & team role permissions",
                        icon = Icons.Outlined.VerifiedUser,
                        onClick = { onNavigate(AppScreen.CLOUD_IDENTITY) }
                    )
                )
            )

            // 2. Infrastructure (Exact items from nav-config.ts -> cloud -> Infrastructure)
            MenuGroupCard(
                groupTitle = "INFRASTRUCTURE",
                items = listOf(
                    MenuRowSpec(
                        title = "Cloud Dashboard",
                        subtitle = "Overview of droplets, bandwidth & uptime",
                        icon = Icons.Outlined.Dashboard,
                        onClick = { onNavigate(AppScreen.CLOUD) }
                    ),
                    MenuRowSpec(
                        title = "My Droplets",
                        subtitle = "Manage 4 running virtual machines",
                        icon = Icons.Outlined.WaterDrop,
                        badge = "4",
                        onClick = { onNavigate(AppScreen.CLOUD_DROPLETS) }
                    ),
                    MenuRowSpec(
                        title = "Create Droplet",
                        subtitle = "Deploy a new cloud server in 55 seconds",
                        icon = Icons.Outlined.AddCircleOutline,
                        onClick = { onNavigate(AppScreen.CLOUD_CREATE_DROPLET) }
                    ),
                    MenuRowSpec(
                        title = "Kubernetes",
                        subtitle = "Managed container clusters & node pools",
                        icon = Icons.Outlined.Hub,
                        badge = "New",
                        onClick = { onNavigate(AppScreen.CLOUD_KUBERNETES) }
                    ),
                    MenuRowSpec(
                        title = "Volumes",
                        subtitle = "NVMe block storage volumes attached to droplets",
                        icon = Icons.Outlined.Storage,
                        onClick = { onNavigate(AppScreen.CLOUD_VOLUMES) }
                    ),
                    MenuRowSpec(
                        title = "Images",
                        subtitle = "Ubuntu, Debian, Docker & custom OS images",
                        icon = Icons.Outlined.ViewInAr,
                        onClick = { onNavigate(AppScreen.CLOUD_IMAGES) }
                    ),
                    MenuRowSpec(
                        title = "Snapshots",
                        subtitle = "On-demand point-in-time server snapshots",
                        icon = Icons.Outlined.PhotoCamera,
                        onClick = { onNavigate(AppScreen.CLOUD_SNAPSHOTS) }
                    ),
                    MenuRowSpec(
                        title = "Backups",
                        subtitle = "Automated weekly droplet backups",
                        icon = Icons.Outlined.Backup,
                        onClick = { onNavigate(AppScreen.CLOUD_BACKUPS) }
                    ),
                    MenuRowSpec(
                        title = "Domains & DNS",
                        subtitle = "Manage DNS zones, A/CNAME records & SSL",
                        icon = Icons.Outlined.Language,
                        onClick = { onNavigate(AppScreen.CLOUD_DOMAINS) }
                    ),
                    MenuRowSpec(
                        title = "TPanel",
                        subtitle = "Web server control panel, sites & databases",
                        icon = Icons.Outlined.Terminal,
                        badge = "v2.4",
                        onClick = { onNavigate(AppScreen.CLOUD_TPANEL) }
                    ),
                    MenuRowSpec(
                        title = "Firewall",
                        subtitle = "Inbound & outbound network security rules",
                        icon = Icons.Outlined.Security,
                        onClick = { onNavigate(AppScreen.CLOUD_FIREWALL) }
                    ),
                    MenuRowSpec(
                        title = "SSH Keys",
                        subtitle = "Public keys for passwordless root access",
                        icon = Icons.Outlined.VpnKey,
                        onClick = { onNavigate(AppScreen.CLOUD_SSH_KEYS) }
                    )
                )
            )

            // 3. Account (Exact items from nav-config.ts -> cloud -> Account)
            MenuGroupCard(
                groupTitle = "ACCOUNT",
                items = listOf(
                    MenuRowSpec(
                        title = "Billing & Invoices",
                        subtitle = "Account balance, usage & payment methods",
                        icon = Icons.Outlined.CreditCard,
                        onClick = { onNavigate(AppScreen.CLOUD_BILLING) }
                    ),
                    MenuRowSpec(
                        title = "Settings",
                        subtitle = "Profile, 2FA security & API keys",
                        icon = Icons.Outlined.Settings,
                        onClick = { onNavigate(AppScreen.CLOUD_SETTINGS) }
                    ),
                    MenuRowSpec(
                        title = "Help & Support",
                        subtitle = "24/7 engineering support tickets & docs",
                        icon = Icons.AutoMirrored.Outlined.HelpOutline,
                        onClick = { onNavigate(AppScreen.CLOUD_HELP) }
                    ),
                    MenuRowSpec(
                        title = "Sign Out",
                        subtitle = "Log out of this Tiwlo account",
                        icon = Icons.AutoMirrored.Outlined.Logout,
                        isDestructive = true,
                        onClick = onSignOut
                    )
                )
            )
        }
    }
}

/**
 * Separate Store Admin Menu Screen (`AppScreen.STORE_MENU`).
 * Only accessible inside a Store Dashboard (e.g., TiwiMart).
 */
@Composable
fun StoreMenuHubScreen(
    storeName: String,
    storeDomain: String,
    onSwitchToMainDashboard: () -> Unit,
    onNavigate: (AppScreen) -> Unit
) {
    StoreDashboardShell(
        storeName = storeName,
        storeDomain = storeDomain,
        currentScreen = AppScreen.STORE_MENU,
        screenTitle = "Store Admin Menu",
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
            verticalArrangement = Arrangement.spacedBy(18.dp)
        ) {
            // Store Banner Card (Clean Shadcn UI)
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
                            text = storeName,
                            fontFamily = FigtreeFontFamily,
                            fontWeight = FontWeight.Bold,
                            fontSize = 17.sp,
                            color = ShadcnForeground
                        )
                        Spacer(modifier = Modifier.height(2.dp))
                        Text(
                            text = storeDomain,
                            fontFamily = JetBrainsMonoFontFamily,
                            fontSize = 11.sp,
                            color = ShadcnMutedForeground
                        )
                    }
                    ShadcnOutlineButton(
                        text = "All Stores",
                        icon = Icons.Outlined.Storefront,
                        onClick = { onNavigate(AppScreen.STORES_HUB) }
                    )
                }
            }

            // 1. Main Control Center (from nav-config.ts -> ecommerce)
            MenuGroupCard(
                groupTitle = "MAIN CONTROL CENTER",
                items = listOf(
                    MenuRowSpec(
                        title = "Store Dashboard",
                        subtitle = "Sales overview, stock movement & daily targets",
                        icon = Icons.Outlined.Dashboard,
                        onClick = { onNavigate(AppScreen.ECOMMERCE) }
                    ),
                    MenuRowSpec(
                        title = "POS System",
                        subtitle = "In-store point of sale terminal & cart checkout",
                        icon = Icons.Outlined.PointOfSale,
                        badge = "Live",
                        onClick = { onNavigate(AppScreen.STORE_POS) }
                    ),
                    MenuRowSpec(
                        title = "QR & Barcode T-Scan",
                        subtitle = "Scan product QR / barcode for instant POS & stock lookup",
                        icon = Icons.Outlined.QrCodeScanner,
                        badge = "T-Scan",
                        onClick = { onNavigate(AppScreen.STORE_TSCAN) }
                    ),
                    MenuRowSpec(
                        title = "Products Catalog",
                        subtitle = "Manage all products, SKUs & pricing",
                        icon = Icons.Outlined.ShoppingBag,
                        onClick = { onNavigate(AppScreen.STORE_PRODUCTS) }
                    ),
                    MenuRowSpec(
                        title = "Create Product",
                        subtitle = "Add a new physical or digital product",
                        icon = Icons.Outlined.AddCircleOutline,
                        onClick = { onNavigate(AppScreen.STORE_CREATE_PRODUCT) }
                    ),
                    MenuRowSpec(
                        title = "Categories & Sub-categories",
                        subtitle = "Organize store catalog hierarchy",
                        icon = Icons.Outlined.Category,
                        onClick = { onNavigate(AppScreen.STORE_CATEGORIES) }
                    ),
                    MenuRowSpec(
                        title = "Inventory Control",
                        subtitle = "Stock quantities, warehouse alerts & restock",
                        icon = Icons.Outlined.Inventory2,
                        badge = "Low Stock",
                        onClick = { onNavigate(AppScreen.STORE_INVENTORY) }
                    ),
                    MenuRowSpec(
                        title = "Sales & Orders",
                        subtitle = "Fulfill customer orders & update status",
                        icon = Icons.Outlined.ShoppingCart,
                        badge = "12",
                        onClick = { onNavigate(AppScreen.STORE_ORDERS) }
                    ),
                    MenuRowSpec(
                        title = "Purchases (PO)",
                        subtitle = "Purchase orders & incoming supplier stock",
                        icon = Icons.Outlined.ReceiptLong,
                        onClick = { onNavigate(AppScreen.STORE_PURCHASES) }
                    ),
                    MenuRowSpec(
                        title = "Suppliers",
                        subtitle = "Manage wholesale vendors & lead times",
                        icon = Icons.Outlined.LocalShipping,
                        onClick = { onNavigate(AppScreen.STORE_SUPPLIERS) }
                    ),
                    MenuRowSpec(
                        title = "Customers",
                        subtitle = "Customer directory, order history & LTV",
                        icon = Icons.Outlined.PeopleOutline,
                        onClick = { onNavigate(AppScreen.STORE_CUSTOMERS) }
                    )
                )
            )

            // 2. Insights
            MenuGroupCard(
                groupTitle = "INSIGHTS & GROWTH",
                items = listOf(
                    MenuRowSpec(
                        title = "Store Analytics",
                        subtitle = "Conversion funnel, traffic sources & AOV",
                        icon = Icons.Outlined.Analytics,
                        onClick = { onNavigate(AppScreen.STORE_ANALYTICS) }
                    ),
                    MenuRowSpec(
                        title = "Marketing Campaigns",
                        subtitle = "SMS, WhatsApp & email retargeting",
                        icon = Icons.Outlined.Campaign,
                        onClick = { onNavigate(AppScreen.STORE_MARKETING) }
                    ),
                    MenuRowSpec(
                        title = "Promo Codes",
                        subtitle = "Discount coupons & flash sale vouchers",
                        icon = Icons.Outlined.ConfirmationNumber,
                        onClick = { onNavigate(AppScreen.STORE_PROMO_CODES) }
                    ),
                    MenuRowSpec(
                        title = "Product Reviews",
                        subtitle = "Customer ratings & moderation queue",
                        icon = Icons.Outlined.StarOutline,
                        onClick = { onNavigate(AppScreen.STORE_REVIEWS) }
                    )
                )
            )

            // 3. Store Management
            MenuGroupCard(
                groupTitle = "STORE MANAGEMENT",
                items = listOf(
                    MenuRowSpec(
                        title = "Storefront & Theme",
                        subtitle = "Customize colors, hero banner & domain",
                        icon = Icons.Outlined.Palette,
                        onClick = { onNavigate(AppScreen.STORE_THEME) }
                    ),
                    MenuRowSpec(
                        title = "Payments",
                        subtitle = "bKash, Nagad, SSLCommerz & Stripe setup",
                        icon = Icons.Outlined.AccountBalanceWallet,
                        onClick = { onNavigate(AppScreen.STORE_PAYMENTS) }
                    ),
                    MenuRowSpec(
                        title = "Shipping & Delivery",
                        subtitle = "Pathao, Steadfast & delivery zone rates",
                        icon = Icons.Outlined.LocalShipping,
                        onClick = { onNavigate(AppScreen.STORE_SHIPPING) }
                    ),
                    MenuRowSpec(
                        title = "Staff Management",
                        subtitle = "Cashier, manager & inventory roles",
                        icon = Icons.Outlined.ManageAccounts,
                        onClick = { onNavigate(AppScreen.STORE_STAFF) }
                    ),
                    MenuRowSpec(
                        title = "Store Setup Checklist",
                        subtitle = "Track store launch readiness steps",
                        icon = Icons.Outlined.CheckCircle,
                        onClick = { onNavigate(AppScreen.STORE_CHECKLIST) }
                    )
                )
            )

            ShadcnPrimaryButton(
                text = "Switch to Main Cloud Dashboard",
                icon = Icons.Outlined.SwapHoriz,
                onClick = onSwitchToMainDashboard,
                modifier = Modifier.fillMaxWidth()
            )
        }
    }
}

data class MenuRowSpec(
    val title: String,
    val subtitle: String,
    val icon: ImageVector,
    val badge: String? = null,
    val isDestructive: Boolean = false,
    val onClick: () -> Unit
)

@Composable
fun MenuGroupCard(
    groupTitle: String,
    items: List<MenuRowSpec>
) {
    Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
        Text(
            text = groupTitle,
            fontFamily = JetBrainsMonoFontFamily,
            fontWeight = FontWeight.SemiBold,
            fontSize = 11.sp,
            color = ShadcnMutedForeground,
            letterSpacing = 1.1.sp,
            modifier = Modifier.padding(horizontal = 4.dp)
        )
        ShadcnCard {
            Column(modifier = Modifier.fillMaxWidth()) {
                items.forEachIndexed { index, item ->
                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .clickable(onClick = item.onClick)
                            .padding(horizontal = 14.dp, vertical = 13.dp)
                            .testTag("menu_row_${item.title.lowercase().replace(" ", "_")}"),
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(12.dp)
                    ) {
                        Box(
                            modifier = Modifier
                                .size(38.dp)
                                .clip(RoundedCornerShape(10.dp))
                                .background(
                                    if (item.isDestructive) ShadcnDestructive.copy(alpha = 0.1f)
                                    else ShadcnMuted
                                ),
                            contentAlignment = Alignment.Center
                        ) {
                            Icon(
                                imageVector = item.icon,
                                contentDescription = item.title,
                                tint = if (item.isDestructive) ShadcnDestructive else ShadcnForeground,
                                modifier = Modifier.size(19.dp)
                            )
                        }

                        Column(modifier = Modifier.weight(1f)) {
                            Text(
                                text = item.title,
                                fontFamily = FigtreeFontFamily,
                                fontWeight = FontWeight.SemiBold,
                                fontSize = 14.sp,
                                color = if (item.isDestructive) ShadcnDestructive else ShadcnForeground
                            )
                            Text(
                                text = item.subtitle,
                                fontFamily = FigtreeFontFamily,
                                fontSize = 12.sp,
                                color = ShadcnMutedForeground
                            )
                        }

                        if (item.badge != null) {
                            Box(
                                modifier = Modifier
                                    .clip(RoundedCornerShape(50))
                                    .background(ShadcnPrimary.copy(alpha = 0.16f))
                                    .padding(horizontal = 8.dp, vertical = 3.dp)
                            ) {
                                Text(
                                    text = item.badge,
                                    fontFamily = JetBrainsMonoFontFamily,
                                    fontWeight = FontWeight.SemiBold,
                                    fontSize = 10.sp,
                                    color = ShadcnPrimaryDark
                                )
                            }
                        }

                        Icon(
                            imageVector = Icons.Outlined.ChevronRight,
                            contentDescription = null,
                            tint = ShadcnMutedForeground,
                            modifier = Modifier.size(18.dp)
                        )
                    }
                    if (index < items.lastIndex) {
                        HorizontalDivider(color = ShadcnBorder, thickness = 1.dp)
                    }
                }
            }
        }
    }
}
