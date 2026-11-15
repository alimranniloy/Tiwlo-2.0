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
import androidx.compose.material.icons.outlined.Analytics
import androidx.compose.material.icons.outlined.Check
import androidx.compose.material.icons.outlined.Contactless
import androidx.compose.material.icons.outlined.Edit
import androidx.compose.material.icons.outlined.Language
import androidx.compose.material.icons.outlined.Link
import androidx.compose.material.icons.outlined.Nfc
import androidx.compose.material.icons.outlined.Palette
import androidx.compose.material.icons.outlined.Public
import androidx.compose.material.icons.outlined.QrCode2
import androidx.compose.material.icons.outlined.TouchApp
import androidx.compose.material.icons.outlined.Visibility
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
import com.example.ui.components.PageHeader
import com.example.ui.components.SegmentedPeriodToggle
import com.example.ui.components.ShadcnCard
import com.example.ui.components.ShadcnInput
import com.example.ui.components.ShadcnOutlineButton
import com.example.ui.components.ShadcnPrimaryButton
import com.example.ui.components.SmoothAreaLineChart
import com.example.ui.components.SparklineTrend
import com.example.ui.components.StatCard
import com.example.ui.components.StatusPill
import com.example.ui.components.StatusTone
import com.example.ui.components.TiwloRingHeroCard
import com.example.ui.theme.FigtreeFontFamily
import com.example.ui.theme.JetBrainsMonoFontFamily
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
 * 1. OneProfile / UIDs Main Screen (`AppScreen.ONEPROFILE`)
 * Uses the signature Dark Ink + Green Ring card (clean, NO green dot at top).
 */
@Composable
fun OneProfileScreen(
    uiState: TiwloUiState,
    onNavigate: (AppScreen) -> Unit,
    onSelectAnalyticsPeriod: (String) -> Unit,
    onSelectTheme: (String) -> Unit,
    onOpenEditProfile: () -> Unit,
    onMarkAllNotificationsRead: () -> Unit,
    onNotificationClick: (String) -> Unit
) {
    DashboardShell(
        currentScreen = AppScreen.ONEPROFILE,
        screenTitle = "OneProfile (UIDs)",
        screenSubtitle = uiState.profileSlug.ifBlank { "OneProfile account" },
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
            // Flat account heading section
            TiwloRingHeroCard(
                eyebrow = null,
                title = uiState.profileDisplayName,
                subtitle = listOf(uiState.profileRole, uiState.profileSlug)
                    .filter(String::isNotBlank)
                    .joinToString(" · ")
                    .ifBlank { "OneProfile account" },
                badgeText = "ONEPROFILE"
            ) {
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.spacedBy(10.dp)
                ) {
                    ShadcnPrimaryButton(
                        text = "Edit Profile",
                        icon = Icons.Outlined.Edit,
                        onClick = onOpenEditProfile,
                        modifier = Modifier
                            .weight(1f)
                            .testTag("oneprofile_edit_button")
                    )
                    Row(
                        modifier = Modifier
                            .weight(1f)
                            .height(38.dp)
                            .clip(RoundedCornerShape(10.dp))
                            .background(Color(0xFF191919))
                            .border(1.dp, Color(0xFF2E2E2E), RoundedCornerShape(10.dp))
                            .clickable { onNavigate(AppScreen.ONEPROFILE_NFC) },
                        horizontalArrangement = Arrangement.Center,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Icon(
                            imageVector = Icons.Outlined.Contactless,
                            contentDescription = "NFC Cards",
                            tint = ShadcnPrimary,
                            modifier = Modifier.size(16.dp)
                        )
                        Spacer(modifier = Modifier.size(6.dp))
                        Text(
                            text = "NFC Card",
                            fontFamily = FigtreeFontFamily,
                            fontWeight = FontWeight.SemiBold,
                            fontSize = 13.sp,
                            color = Color.White
                        )
                    }
                }
            }

            // 5 Quick Navigation Tiles for OneProfile Sub-Pages
            Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.spacedBy(10.dp)
                ) {
                    OneProfileSubTile(
                        title = "Subdomains",
                        subtitle = "${uiState.profileDomains.size} domains",
                        icon = Icons.Outlined.Language,
                        onClick = { onNavigate(AppScreen.ONEPROFILE_SUBDOMAINS) },
                        modifier = Modifier.weight(1f)
                    )
                    OneProfileSubTile(
                        title = "Templates",
                        subtitle = uiState.selectedProfileTheme,
                        icon = Icons.Outlined.Palette,
                        onClick = { onNavigate(AppScreen.ONEPROFILE_TEMPLATES) },
                        modifier = Modifier.weight(1f)
                    )
                }
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.spacedBy(10.dp)
                ) {
                    OneProfileSubTile(
                        title = "Static Hosting",
                        subtitle = "Edge HTML/JS",
                        icon = Icons.Outlined.Public,
                        onClick = { onNavigate(AppScreen.ONEPROFILE_HOSTING) },
                        modifier = Modifier.weight(1f)
                    )
                    OneProfileSubTile(
                        title = "NFC Cards",
                        subtitle = "Usage unavailable",
                        icon = Icons.Outlined.Nfc,
                        onClick = { onNavigate(AppScreen.ONEPROFILE_NFC) },
                        modifier = Modifier.weight(1f)
                    )
                    OneProfileSubTile(
                        title = "Analytics",
                        subtitle = "${uiState.profileViews} views",
                        icon = Icons.Outlined.Analytics,
                        onClick = { onNavigate(AppScreen.ONEPROFILE_ANALYTICS) },
                        modifier = Modifier.weight(1f)
                    )
                }
            }

            // 4 KPI Cards
            Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.spacedBy(12.dp)
                ) {
                    StatCard(
                        label = "Profile Views",
                        value = uiState.profileViews.toString(),
                        change = "Lifetime website views",
                        trend = SparklineTrend.NEUTRAL,
                        icon = Icons.Outlined.Visibility,
                        sparkline = emptyList(),
                        modifier = Modifier.weight(1f)
                    )
                    StatCard(
                        label = "Link Clicks",
                        value = "Unavailable",
                        change = "No click analytics API",
                        trend = SparklineTrend.NEUTRAL,
                        icon = Icons.Outlined.TouchApp,
                        sparkline = emptyList(),
                        modifier = Modifier.weight(1f)
                    )
                }
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.spacedBy(12.dp)
                ) {
                    StatCard(
                        label = "NFC Card Taps",
                        value = "Unavailable",
                        change = "No NFC analytics API",
                        trend = SparklineTrend.NEUTRAL,
                        icon = Icons.Outlined.Nfc,
                        sparkline = emptyList(),
                        modifier = Modifier.weight(1f)
                    )
                    StatCard(
                        label = "QR Code Scans",
                        value = "Unavailable",
                        change = "No QR analytics API",
                        trend = SparklineTrend.NEUTRAL,
                        icon = Icons.Outlined.QrCode2,
                        sparkline = emptyList(),
                        modifier = Modifier.weight(1f)
                    )
                }
            }

            // Profile Analytics Chart
            ShadcnCard {
                CardHeader(
                    title = "Profile Views & Clicks",
                    description = "Website view totals from OneProfile",
                    action = {
                        SegmentedPeriodToggle(
                            options = listOf("7D", "30D", "90D"),
                            selected = uiState.selectedAnalyticsPeriod,
                            onSelect = onSelectAnalyticsPeriod
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
                        text = "Daily analytics history is not available from the current API.",
                        fontFamily = FigtreeFontFamily,
                        fontSize = 13.sp,
                        color = ShadcnMutedForeground
                    )
                }
            }

            // Active Bio Links Card
            ShadcnCard {
                CardHeader(
                    title = "Bio Links & Socials",
                    description = uiState.profileSlug.ifBlank { "OneProfile websites" },
                    action = {
                        ShadcnOutlineButton(
                            text = "Edit Bio",
                            onClick = onOpenEditProfile
                        )
                    }
                )
                Column(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(16.dp),
                    verticalArrangement = Arrangement.spacedBy(10.dp)
                ) {
                    if (uiState.profileWebsites.isEmpty()) {
                        Text(
                            text = "No OneProfile websites are available.",
                            fontFamily = FigtreeFontFamily,
                            fontSize = 13.sp,
                            color = ShadcnMutedForeground
                        )
                    } else {
                        uiState.profileWebsites.forEachIndexed { index, website ->
                            if (index > 0) HorizontalDivider(color = ShadcnBorder)
                            BioLinkRow(website.title, website.domain, "${website.views} views")
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun OneProfileSubTile(
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
        verticalArrangement = Arrangement.spacedBy(5.dp)
    ) {
        Icon(
            imageVector = icon,
            contentDescription = title,
            tint = ShadcnForeground,
            modifier = Modifier.size(18.dp)
        )
        Text(
            text = title,
            fontFamily = FigtreeFontFamily,
            fontWeight = FontWeight.Bold,
            fontSize = 12.sp,
            color = ShadcnForeground
        )
        Text(
            text = subtitle,
            fontFamily = JetBrainsMonoFontFamily,
            fontSize = 10.sp,
            color = ShadcnMutedForeground
        )
    }
}

@Composable
private fun BioLinkRow(title: String, url: String, clicks: String) {
    Row(
        modifier = Modifier.fillMaxWidth(),
        horizontalArrangement = Arrangement.SpaceBetween,
        verticalAlignment = Alignment.CenterVertically
    ) {
        Column(modifier = Modifier.weight(1f)) {
            Text(
                text = title,
                fontFamily = FigtreeFontFamily,
                fontWeight = FontWeight.SemiBold,
                fontSize = 13.sp,
                color = ShadcnForeground
            )
            Text(
                text = url,
                fontFamily = JetBrainsMonoFontFamily,
                fontSize = 11.sp,
                color = ShadcnMutedForeground
            )
        }
        StatusPill(text = clicks, tone = StatusTone.GREEN)
    }
}

/**
 * 2. Edit OneProfile Page (`AppScreen.ONEPROFILE_EDIT`)
 * Pure shadcn UI — NO dark ring card! Includes mobile Back button (`<-`).
 */
@Composable
fun OneProfileEditScreen(
    uiState: TiwloUiState,
    onNavigate: (AppScreen) -> Unit,
    onBack: () -> Unit,
    onSaveProfile: (String, String, String, String) -> Unit,
    onMarkAllNotificationsRead: () -> Unit,
    onNotificationClick: (String) -> Unit
) {
    var displayName by remember { mutableStateOf(uiState.profileDisplayName) }
    var role by remember { mutableStateOf(uiState.profileRole) }
    var bio by remember { mutableStateOf(uiState.profileBio) }
    var location by remember { mutableStateOf(uiState.profileLocation) }

    DashboardShell(
        currentScreen = AppScreen.ONEPROFILE_EDIT,
        screenTitle = "Edit OneProfile",
        screenSubtitle = uiState.profileSlug.ifBlank { "OneProfile account" },
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
                title = "Edit Digital Identity",
                subtitle = "Profile changes sync to your Tiwlo account."
            )

            ShadcnCard {
                CardHeader(
                    title = "Profile Details",
                    description = "Public name, headline, bio, and location"
                )
                Column(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(16.dp),
                    verticalArrangement = Arrangement.spacedBy(12.dp)
                ) {
                    ShadcnInput(
                        value = displayName,
                        onValueChange = { displayName = it },
                        placeholder = "Display Name",
                        testTag = "profile_name_input"
                    )
                    ShadcnInput(
                        value = role,
                        onValueChange = { role = it },
                        placeholder = "Headline / Role",
                        testTag = "profile_role_input"
                    )
                    ShadcnInput(
                        value = location,
                        onValueChange = { location = it },
                        placeholder = "Location",
                        testTag = "profile_location_input"
                    )
                    ShadcnInput(
                        value = bio,
                        onValueChange = { bio = it },
                        placeholder = "Short Bio",
                        singleLine = false,
                        modifier = Modifier.height(100.dp),
                        testTag = "profile_bio_input"
                    )
                    ShadcnPrimaryButton(
                        text = "Save Profile Changes",
                        icon = Icons.Outlined.Check,
                        onClick = { onSaveProfile(displayName, role, bio, location) },
                        modifier = Modifier
                            .fillMaxWidth()
                            .testTag("save_profile_button")
                    )
                }
            }
        }
    }
}

/**
 * 3. OneProfile Sub-Pages (`ONEPROFILE_SUBDOMAINS`, `ONEPROFILE_TEMPLATES`, `ONEPROFILE_HOSTING`, `ONEPROFILE_NFC`, `ONEPROFILE_ANALYTICS`)
 * Pure shadcn UI — NO dark ring card! Includes mobile Back button (`<-`).
 */
@Composable
fun OneProfileSubPageScreen(
    currentScreen: AppScreen,
    uiState: TiwloUiState,
    onNavigate: (AppScreen) -> Unit,
    onBack: () -> Unit,
    onSelectTheme: (String) -> Unit,
    onMarkAllNotificationsRead: () -> Unit,
    onNotificationClick: (String) -> Unit
) {
    val title = when (currentScreen) {
        AppScreen.ONEPROFILE_SUBDOMAINS -> "UID Subdomains"
        AppScreen.ONEPROFILE_TEMPLATES -> "Profile Templates"
        AppScreen.ONEPROFILE_HOSTING -> "Static Edge Hosting"
        AppScreen.ONEPROFILE_NFC -> "NFC Smart Cards"
        else -> "UID Analytics"
    }

    DashboardShell(
        currentScreen = currentScreen,
        screenTitle = title,
        screenSubtitle = "OneProfile Console",
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
            when (currentScreen) {
                AppScreen.ONEPROFILE_SUBDOMAINS -> {
                    PageHeader(
                        title = "Claimed .tiwlo.id Subdomains",
                        subtitle = "Manage your personal handles and custom domain aliases."
                    )
                    if (uiState.profileDomains.isEmpty()) {
                        Text(
                            text = "No OneProfile domains are available.",
                            fontFamily = FigtreeFontFamily,
                            fontSize = 13.sp,
                            color = ShadcnMutedForeground
                        )
                    }
                    uiState.profileDomains.forEach { domain ->
                        ShadcnCard {
                            Text(
                                text = domain,
                                modifier = Modifier.padding(16.dp),
                                fontFamily = JetBrainsMonoFontFamily,
                                fontWeight = FontWeight.Bold,
                                fontSize = 14.sp,
                                color = ShadcnForeground
                            )
                        }
                    }
                }

                AppScreen.ONEPROFILE_TEMPLATES -> {
                    PageHeader(
                        title = "OneProfile Visual Templates",
                        subtitle = "Choose a theme for your public bio page."
                    )
                    listOf(
                        "Obsidian Emerald",
                        "Minimal Light",
                        "Terminal Mono",
                        "Glass Neon"
                    ).forEach { theme ->
                        val active = uiState.selectedProfileTheme == theme
                        ShadcnCard {
                            Row(
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .clickable { onSelectTheme(theme) }
                                    .padding(16.dp),
                                horizontalArrangement = Arrangement.SpaceBetween,
                                verticalAlignment = Alignment.CenterVertically
                            ) {
                                Text(
                                    text = theme,
                                    fontFamily = FigtreeFontFamily,
                                    fontWeight = FontWeight.Bold,
                                    fontSize = 14.sp,
                                    color = ShadcnForeground
                                )
                                if (active) {
                                    StatusPill(text = "Active Theme", tone = StatusTone.GREEN)
                                } else {
                                    ShadcnOutlineButton(
                                        text = "Apply",
                                        onClick = { onSelectTheme(theme) }
                                    )
                                }
                            }
                        }
                    }
                }

                AppScreen.ONEPROFILE_HOSTING -> {
                    PageHeader(
                        title = "Static Edge Hosting",
                        subtitle = "Deploy static HTML/CSS/JS portfolios to Tiwlo's global CDN."
                    )
                    ShadcnCard {
                        Text(
                            text = "Hosting deployments are not available from the current API.",
                            modifier = Modifier.padding(16.dp),
                            fontFamily = FigtreeFontFamily,
                            fontSize = 13.sp,
                            color = ShadcnMutedForeground
                        )
                    }
                }

                AppScreen.ONEPROFILE_NFC -> {
                    PageHeader(
                        title = "NFC Smart Business Cards",
                        subtitle = "Physical matte-black NFC cards paired to your OneProfile."
                    )
                    ShadcnCard {
                        Text(
                            text = "NFC card inventory and activity are not available from the current API.",
                            modifier = Modifier.padding(16.dp),
                            fontFamily = FigtreeFontFamily,
                            fontSize = 13.sp,
                            color = ShadcnMutedForeground
                        )
                    }
                }

                else -> {
                    PageHeader(
                        title = "Audience & Link Analytics",
                        subtitle = "${uiState.profileViews} total website views"
                    )
                    Text(
                        text = "Referrer and daily analytics are not available from the current API.",
                        fontFamily = FigtreeFontFamily,
                        fontSize = 13.sp,
                        color = ShadcnMutedForeground
                    )
                }
            }
        }
    }
}
