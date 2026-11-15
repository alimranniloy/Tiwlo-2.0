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
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.outlined.Add
import androidx.compose.material.icons.outlined.Backup
import androidx.compose.material.icons.outlined.CheckCircle
import androidx.compose.material.icons.outlined.CreditCard
import androidx.compose.material.icons.outlined.Dns
import androidx.compose.material.icons.outlined.Hub
import androidx.compose.material.icons.outlined.Language
import androidx.compose.material.icons.outlined.PhotoCamera
import androidx.compose.material.icons.outlined.Security
import androidx.compose.material.icons.outlined.Storage
import androidx.compose.material.icons.outlined.VerifiedUser
import androidx.compose.material.icons.outlined.ViewInAr
import androidx.compose.material.icons.outlined.VpnKey
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
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.example.model.AppScreen
import com.example.ui.components.CardHeader
import com.example.ui.components.DashboardShell
import com.example.ui.components.PageHeader
import com.example.ui.components.ShadcnCard
import com.example.ui.components.ShadcnInput
import com.example.ui.components.ShadcnOutlineButton
import com.example.ui.components.ShadcnPrimaryButton
import com.example.ui.components.StatusPill
import com.example.ui.components.StatusTone
import com.example.ui.theme.FigtreeFontFamily
import com.example.ui.theme.JetBrainsMonoFontFamily
import com.example.ui.theme.ShadcnBackground
import com.example.ui.theme.ShadcnBorder
import com.example.ui.theme.ShadcnForeground
import com.example.ui.theme.ShadcnMuted
import com.example.ui.theme.ShadcnMutedForeground
import com.example.ui.theme.ShadcnPrimaryDark
import com.example.viewmodel.TiwloUiState

/**
 * Kubernetes Clusters Screen (`AppScreen.CLOUD_KUBERNETES`)
 */
@Composable
fun CloudKubernetesScreen(
    uiState: TiwloUiState,
    onNavigate: (AppScreen) -> Unit,
    onBack: () -> Unit,
    onMarkAllNotificationsRead: () -> Unit,
    onNotificationClick: (String) -> Unit
) {
    DashboardShell(
        currentScreen = AppScreen.CLOUD_KUBERNETES,
        screenTitle = "Kubernetes",
        screenSubtitle = "Managed K8s clusters & node pools",
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
                title = "Managed Kubernetes",
                subtitle = "Automated control plane, auto-scaling worker pools, and 1-click upgrades."
            )

            uiState.k8sClusters.forEach { cluster ->
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
                            Row(
                                verticalAlignment = Alignment.CenterVertically,
                                horizontalArrangement = Arrangement.spacedBy(10.dp)
                            ) {
                                Box(
                                    modifier = Modifier
                                        .size(38.dp)
                                        .clip(RoundedCornerShape(10.dp))
                                        .background(ShadcnMuted),
                                    contentAlignment = Alignment.Center
                                ) {
                                    Icon(
                                        imageVector = Icons.Outlined.Hub,
                                        contentDescription = cluster.name,
                                        tint = ShadcnForeground,
                                        modifier = Modifier.size(18.dp)
                                    )
                                }
                                Column {
                                    Text(
                                        text = cluster.name,
                                        fontFamily = FigtreeFontFamily,
                                        fontWeight = FontWeight.Bold,
                                        fontSize = 15.sp,
                                        color = ShadcnForeground
                                    )
                                    Text(
                                        text = "${cluster.region} · ${cluster.version}",
                                        fontFamily = JetBrainsMonoFontFamily,
                                        fontSize = 11.sp,
                                        color = ShadcnMutedForeground
                                    )
                                }
                            }
                            StatusPill(text = cluster.status, tone = StatusTone.GREEN, showDot = true)
                        }
                        HorizontalDivider(color = ShadcnBorder)
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.SpaceBetween
                        ) {
                            Text(
                                text = "${cluster.nodes} Worker Nodes",
                                fontFamily = FigtreeFontFamily,
                                fontSize = 12.sp,
                                color = ShadcnMutedForeground
                            )
                            Text(
                                text = "$${cluster.monthlyCost}/mo",
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

/**
 * Block Storage Volumes Screen (`AppScreen.CLOUD_VOLUMES`)
 */
@Composable
fun CloudVolumesScreen(
    uiState: TiwloUiState,
    onNavigate: (AppScreen) -> Unit,
    onBack: () -> Unit,
    onAddVolume: (String, Int, String) -> Unit,
    onMarkAllNotificationsRead: () -> Unit,
    onNotificationClick: (String) -> Unit
) {
    DashboardShell(
        currentScreen = AppScreen.CLOUD_VOLUMES,
        screenTitle = "Block Volumes",
        screenSubtitle = "NVMe SSD network block storage",
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
                title = "NVMe Block Storage",
                subtitle = "Attach high-IOPS persistent volumes to your droplets."
            )

            ShadcnCard {
                CardHeader(
                    title = "Volume management unavailable",
                    description = "The current Tiwlo API does not provide volume management."
                )
            }

            uiState.volumes.forEach { vol ->
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
                                text = vol.name,
                                fontFamily = JetBrainsMonoFontFamily,
                                fontWeight = FontWeight.Bold,
                                fontSize = 14.sp,
                                color = ShadcnForeground
                            )
                            Text(
                                text = "${vol.sizeGb} GB · ${vol.region} · Attached to ${vol.attachedTo}",
                                fontFamily = FigtreeFontFamily,
                                fontSize = 12.sp,
                                color = ShadcnMutedForeground
                            )
                        }
                        StatusPill(text = "${vol.sizeGb} GB", tone = StatusTone.GREEN)
                    }
                }
            }
        }
    }
}

/**
 * Domains & DNS Screen (`AppScreen.CLOUD_DOMAINS`)
 */
@Composable
fun CloudDomainsScreen(
    uiState: TiwloUiState,
    onNavigate: (AppScreen) -> Unit,
    onBack: () -> Unit,
    onAddDomain: (String, String) -> Unit,
    onMarkAllNotificationsRead: () -> Unit,
    onNotificationClick: (String) -> Unit
) {
    var domainInput by remember { mutableStateOf("") }
    var targetIpInput by remember { mutableStateOf("") }

    DashboardShell(
        currentScreen = AppScreen.CLOUD_DOMAINS,
        screenTitle = "Domains & DNS",
        screenSubtitle = "Global Anycast DNS & SSL certificates",
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
                title = "Domains & Anycast DNS",
                subtitle = "Manage domain zones, A/CNAME/MX records, and automatic Let's Encrypt SSL."
            )

            ShadcnCard {
                CardHeader(
                    title = "Add Domain Zone",
                    description = "Point your domain to a Droplet IP or Storefront"
                )
                Column(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(16.dp),
                    verticalArrangement = Arrangement.spacedBy(10.dp)
                ) {
                    ShadcnInput(
                        value = domainInput,
                        onValueChange = { domainInput = it },
                        placeholder = "example.com"
                    )
                    ShadcnInput(
                        value = targetIpInput,
                        onValueChange = { targetIpInput = it },
                        placeholder = "DNS target IPv4 (not saved by Tiwlo API)"
                    )
                    ShadcnPrimaryButton(
                        text = "Add Domain to DNS",
                        icon = Icons.Outlined.Add,
                        onClick = {
                            if (domainInput.isNotBlank()) {
                                onAddDomain(domainInput, targetIpInput)
                                domainInput = ""
                            }
                        },
                        modifier = Modifier.fillMaxWidth()
                    )
                }
            }

            uiState.domains.forEach { dom ->
                ShadcnCard {
                    Column(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(16.dp),
                        verticalArrangement = Arrangement.spacedBy(8.dp)
                    ) {
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.SpaceBetween,
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Row(
                                verticalAlignment = Alignment.CenterVertically,
                                horizontalArrangement = Arrangement.spacedBy(8.dp)
                            ) {
                                Icon(
                                    imageVector = Icons.Outlined.Language,
                                    contentDescription = dom.domain,
                                    tint = ShadcnForeground,
                                    modifier = Modifier.size(18.dp)
                                )
                                Text(
                                    text = dom.domain,
                                    fontFamily = JetBrainsMonoFontFamily,
                                    fontWeight = FontWeight.Bold,
                                    fontSize = 14.sp,
                                    color = ShadcnForeground
                                )
                            }
                            StatusPill(text = dom.sslStatus, tone = StatusTone.GREEN, showDot = true)
                        }
                        Text(
                            text = "Target: ${dom.targetIp} · ${dom.recordsCount} DNS records",
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

/**
 * Images Screen (`AppScreen.CLOUD_IMAGES`)
 */
@Composable
fun CloudImagesScreen(
    uiState: TiwloUiState,
    onNavigate: (AppScreen) -> Unit,
    onBack: () -> Unit,
    onMarkAllNotificationsRead: () -> Unit,
    onNotificationClick: (String) -> Unit
) {
    val images = listOf(
        Triple("Ubuntu 24.04 LTS", "x86_64 / ARM64 · Official", "620 MB"),
        Triple("Debian 12 Bookworm", "x86_64 · Minimal Cloud", "410 MB"),
        Triple("Docker 26.1 on Ubuntu", "Pre-installed Engine + Compose", "1.1 GB"),
        Triple("Rocky Linux 9.4", "Enterprise RHEL-compatible", "780 MB"),
        Triple("AlmaLinux 9.4", "Cloud-init ready", "740 MB"),
        Triple("Custom Next.js 15 Base", "Private Custom Image", "1.8 GB")
    )
    DashboardShell(
        currentScreen = AppScreen.CLOUD_IMAGES,
        screenTitle = "OS & Custom Images",
        screenSubtitle = "Distributions & custom QCOW2 images",
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
            verticalArrangement = Arrangement.spacedBy(14.dp)
        ) {
            PageHeader(
                title = "System & Custom Images",
                subtitle = "Launch droplets from verified OS distributions or uploaded images."
            )
            images.forEach { (title, subtitle, size) ->
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
                                text = "$subtitle · $size",
                                fontFamily = FigtreeFontFamily,
                                fontSize = 12.sp,
                                color = ShadcnMutedForeground
                            )
                        }
                        ShadcnOutlineButton(
                            text = "Launch",
                            onClick = { onNavigate(AppScreen.CLOUD_CREATE_DROPLET) }
                        )
                    }
                }
            }
        }
    }
}

/**
 * Snapshots & Backups Screen (`AppScreen.CLOUD_SNAPSHOTS` & `AppScreen.CLOUD_BACKUPS`)
 */
@Composable
fun CloudSnapshotsBackupsScreen(
    currentScreen: AppScreen,
    uiState: TiwloUiState,
    onNavigate: (AppScreen) -> Unit,
    onBack: () -> Unit,
    onMarkAllNotificationsRead: () -> Unit,
    onNotificationClick: (String) -> Unit
) {
    val isBackups = currentScreen == AppScreen.CLOUD_BACKUPS
    DashboardShell(
        currentScreen = currentScreen,
        screenTitle = if (isBackups) "Automated Backups" else "Droplet Snapshots",
        screenSubtitle = "Point-in-time recovery images",
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
                title = if (isBackups) "Weekly Automated Backups" else "On-Demand Snapshots",
                subtitle = "Restore any droplet or spin up a clone in seconds."
            )

            uiState.snapshots.forEach { snap ->
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
                                text = snap.name,
                                fontFamily = JetBrainsMonoFontFamily,
                                fontWeight = FontWeight.Bold,
                                fontSize = 13.sp,
                                color = ShadcnForeground
                            )
                            Text(
                                text = "Source: ${snap.sourceDroplet} · ${snap.sizeGb} GB · ${snap.createdAt}",
                                fontFamily = FigtreeFontFamily,
                                fontSize = 12.sp,
                                color = ShadcnMutedForeground
                            )
                        }
                        StatusPill(text = "${snap.sizeGb} GB", tone = StatusTone.BLUE)
                    }
                }
            }
        }
    }
}

/**
 * Cloud Firewall & SSH Keys Screen (`AppScreen.CLOUD_FIREWALL` & `AppScreen.CLOUD_SSH_KEYS`)
 */
@Composable
fun CloudSecurityNetworkScreen(
    currentScreen: AppScreen,
    uiState: TiwloUiState,
    onNavigate: (AppScreen) -> Unit,
    onBack: () -> Unit,
    onMarkAllNotificationsRead: () -> Unit,
    onNotificationClick: (String) -> Unit
) {
    val isSsh = currentScreen == AppScreen.CLOUD_SSH_KEYS
    DashboardShell(
        currentScreen = currentScreen,
        screenTitle = if (isSsh) "SSH Keys" else "Cloud Firewalls",
        screenSubtitle = if (isSsh) "Public keys for root access" else "Inbound & outbound packet filtering",
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
            verticalArrangement = Arrangement.spacedBy(14.dp)
        ) {
            if (isSsh) {
                PageHeader(
                    title = "Registered SSH Keys",
                    subtitle = "Automatically injected into new droplets during provisioning."
                )
                uiState.sshKeys.forEach { key ->
                    ShadcnCard {
                        Column(
                            modifier = Modifier
                                .fillMaxWidth()
                                .padding(16.dp),
                            verticalArrangement = Arrangement.spacedBy(6.dp)
                        ) {
                            Row(
                                modifier = Modifier.fillMaxWidth(),
                                horizontalArrangement = Arrangement.SpaceBetween,
                                verticalAlignment = Alignment.CenterVertically
                            ) {
                                Text(
                                    text = key.name,
                                    fontFamily = FigtreeFontFamily,
                                    fontWeight = FontWeight.Bold,
                                    fontSize = 14.sp,
                                    color = ShadcnForeground
                                )
                                StatusPill(text = key.addedAt, tone = StatusTone.SLATE)
                            }
                            Text(
                                text = key.fingerprint,
                                fontFamily = JetBrainsMonoFontFamily,
                                fontSize = 11.sp,
                                color = ShadcnMutedForeground
                            )
                        }
                    }
                }
            } else {
                PageHeader(
                    title = "Firewall Rules",
                    subtitle = "Stateful network firewall applied at the hypervisor edge."
                )
                uiState.firewallRules.forEach { rule ->
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
                                    text = "${rule.direction} · ${rule.protocol} Port ${rule.portRange}",
                                    fontFamily = JetBrainsMonoFontFamily,
                                    fontWeight = FontWeight.Bold,
                                    fontSize = 13.sp,
                                    color = ShadcnForeground
                                )
                                Text(
                                    text = "Sources: ${rule.sources}",
                                    fontFamily = FigtreeFontFamily,
                                    fontSize = 12.sp,
                                    color = ShadcnMutedForeground
                                )
                            }
                            StatusPill(text = rule.action, tone = StatusTone.GREEN)
                        }
                    }
                }
            }
        }
    }
}

/**
 * Marketplace, Identity, Billing, Settings, Help (`CLOUD_MARKETPLACE`, `CLOUD_IDENTITY`, `CLOUD_BILLING`, `CLOUD_SETTINGS`, `CLOUD_HELP`)
 */
@Composable
fun CloudAccountWorkspaceSubScreen(
    currentScreen: AppScreen,
    uiState: TiwloUiState,
    onNavigate: (AppScreen) -> Unit,
    onBack: () -> Unit,
    onMarkAllNotificationsRead: () -> Unit,
    onNotificationClick: (String) -> Unit
) {
    val title = when (currentScreen) {
        AppScreen.CLOUD_MARKETPLACE -> "1-Click Marketplace"
        AppScreen.CLOUD_IDENTITY -> "Identity & IAM"
        AppScreen.CLOUD_BILLING -> "Billing & Invoices"
        AppScreen.CLOUD_SETTINGS -> "Account Settings"
        else -> "Help & Support"
    }

    DashboardShell(
        currentScreen = currentScreen,
        screenTitle = title,
        screenSubtitle = "Tiwlo Console",
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
                AppScreen.CLOUD_MARKETPLACE -> {
                    PageHeader(
                        title = "1-Click Cloud Apps",
                        subtitle = "Marketplace deployment is not available through the current API."
                    )
                    ShadcnCard {
                        Text(
                            text = "No marketplace catalog or deployment endpoint is available.",
                            modifier = Modifier.padding(16.dp),
                            fontFamily = FigtreeFontFamily,
                            fontSize = 13.sp,
                            color = ShadcnMutedForeground
                        )
                    }
                }

                AppScreen.CLOUD_IDENTITY -> {
                    PageHeader(
                        title = "Identity & Access (IAM)",
                        subtitle = "Manage API tokens, SSO providers, and team member permissions."
                    )
                    ShadcnCard {
                        Text(
                            text = "Personal access token management is not available from the current API.",
                            modifier = Modifier.padding(16.dp),
                            fontFamily = FigtreeFontFamily,
                            fontSize = 13.sp,
                            color = ShadcnMutedForeground
                        )
                    }
                }

                AppScreen.CLOUD_BILLING -> {
                    PageHeader(
                        title = "Billing & Invoices",
                        subtitle = "Cloud billing account balance and payment gateway status."
                    )
                    ShadcnCard {
                        Column(
                            modifier = Modifier
                                .fillMaxWidth()
                                .padding(16.dp),
                            verticalArrangement = Arrangement.spacedBy(8.dp)
                        ) {
                            Text(
                                text = "Available Cloud Credits",
                                fontFamily = FigtreeFontFamily,
                                fontSize = 12.sp,
                                color = ShadcnMutedForeground
                            )
                            Text(
                                text = uiState.billingCreditBalance,
                                fontFamily = FigtreeFontFamily,
                                fontWeight = FontWeight.Bold,
                                fontSize = 26.sp,
                                color = ShadcnForeground
                            )
                            Text(
                                text = uiState.billingGatewayStatus,
                                fontFamily = JetBrainsMonoFontFamily,
                                fontSize = 11.sp,
                                color = ShadcnMutedForeground
                            )
                        }
                    }
                }

                AppScreen.CLOUD_SETTINGS -> {
                    PageHeader(
                        title = "Account Settings",
                        subtitle = "Profile details, security preferences, and login alerts."
                    )
                    ShadcnCard {
                        Column(
                            modifier = Modifier
                                .fillMaxWidth()
                                .padding(16.dp),
                            verticalArrangement = Arrangement.spacedBy(12.dp)
                        ) {
                            Text(
                                text = "${uiState.userName} (${uiState.userEmail})",
                                fontFamily = FigtreeFontFamily,
                                fontWeight = FontWeight.Bold,
                                fontSize = 15.sp,
                                color = ShadcnForeground
                            )
                            Text(
                                text = "Two-factor authentication status is not exposed by the current API.",
                                fontFamily = FigtreeFontFamily,
                                fontSize = 13.sp,
                                color = ShadcnMutedForeground
                            )
                        }
                    }
                }

                else -> {
                    PageHeader(
                        title = "24/7 Engineering Support",
                        subtitle = "Support ticket data is not available from the current API."
                    )
                    ShadcnCard {
                        Column(
                            modifier = Modifier
                                .fillMaxWidth()
                                .padding(16.dp),
                            verticalArrangement = Arrangement.spacedBy(10.dp)
                        ) {
                            Text(
                                text = "Contact Tiwlo support through the website.",
                                fontFamily = FigtreeFontFamily,
                                fontSize = 12.sp,
                                color = ShadcnMutedForeground
                            )
                        }
                    }
                }
            }
        }
    }
}
