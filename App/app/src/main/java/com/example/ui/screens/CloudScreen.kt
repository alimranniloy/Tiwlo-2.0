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
import androidx.compose.material.icons.outlined.Backup
import androidx.compose.material.icons.outlined.Bolt
import androidx.compose.material.icons.outlined.Check
import androidx.compose.material.icons.outlined.CloudQueue
import androidx.compose.material.icons.outlined.Dns
import androidx.compose.material.icons.outlined.Hub
import androidx.compose.material.icons.outlined.Language
import androidx.compose.material.icons.outlined.Memory
import androidx.compose.material.icons.outlined.PhotoCamera
import androidx.compose.material.icons.outlined.Public
import androidx.compose.material.icons.outlined.Refresh
import androidx.compose.material.icons.outlined.Security
import androidx.compose.material.icons.outlined.Speed
import androidx.compose.material.icons.outlined.Storage
import androidx.compose.material.icons.outlined.SwapVert
import androidx.compose.material.icons.outlined.Terminal
import androidx.compose.material.icons.outlined.VerifiedUser
import androidx.compose.material.icons.outlined.ViewInAr
import androidx.compose.material.icons.outlined.VpnKey
import androidx.compose.material.icons.outlined.WaterDrop
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
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
import com.example.model.DropletItem
import com.example.ui.components.CardHeader
import com.example.ui.components.DashboardShell
import com.example.ui.components.PageHeader
import com.example.ui.components.ProgressBarMeter
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
import com.example.ui.theme.ShadcnAmber
import com.example.ui.theme.ShadcnBackground
import com.example.ui.theme.ShadcnBlue
import com.example.ui.theme.ShadcnBorder
import com.example.ui.theme.ShadcnForeground
import com.example.ui.theme.ShadcnInk
import com.example.ui.theme.ShadcnMuted
import com.example.ui.theme.ShadcnMutedForeground
import com.example.ui.theme.ShadcnPrimary
import com.example.ui.theme.ShadcnPrimaryDark
import com.example.viewmodel.TiwloUiState

/**
 * 1. Main Cloud Dashboard (`AppScreen.CLOUD`)
 * Connected dark header at the top with the signature green ring, NO green dot,
 * and NO cluttered "GOOD MORNING · CLOUD CONSOLE" text.
 */
@Composable
fun CloudScreen(
    uiState: TiwloUiState,
    onNavigate: (AppScreen) -> Unit,
    onOpenCreateDroplet: () -> Unit,
    onSelectWorkloadPeriod: (String) -> Unit,
    onOpenTPanel: () -> Unit,
    onMarkAllNotificationsRead: () -> Unit,
    onNotificationClick: (String) -> Unit
) {
    val runningDroplets = uiState.droplets.count { it.status.equals("Running", true) }
    val allocatedVcpus = uiState.droplets.sumOf { it.vcpu }
    val allocatedMemoryGb = uiState.droplets.sumOf { it.ramGb }
    val allocatedStorageGb = uiState.droplets.sumOf { it.diskGb }
    DashboardShell(
        currentScreen = AppScreen.CLOUD,
        screenTitle = "Tiwlo Console",
        screenSubtitle = null,
        isSubPage = false,
        darkTopHeader = true,
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
                .verticalScroll(rememberScrollState()),
            verticalArrangement = Arrangement.spacedBy(16.dp)
        ) {
            // Flat welcome section below the dark navigation header
            TiwloRingHeroCard(
                eyebrow = null,
                title = "Welcome back, ${uiState.userName.substringBefore(" ")}",
                subtitle = "$runningDroplets running · ${uiState.droplets.size} total droplets",
                badgeText = null
            ) {
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.spacedBy(10.dp)
                ) {
                    ShadcnPrimaryButton(
                        text = "Create Droplet",
                        icon = Icons.Outlined.Add,
                        onClick = onOpenCreateDroplet,
                        modifier = Modifier
                            .weight(1f)
                            .testTag("cloud_create_droplet_button")
                    )
                    Row(
                        modifier = Modifier
                            .weight(1f)
                            .height(38.dp)
                            .clip(RoundedCornerShape(10.dp))
                            .background(Color(0xFF191919))
                            .border(1.dp, Color(0xFF2E2E2E), RoundedCornerShape(10.dp))
                            .clickable(onClick = onOpenTPanel)
                            .testTag("cloud_open_tpanel_button"),
                        horizontalArrangement = Arrangement.Center,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Icon(
                            imageVector = Icons.Outlined.Terminal,
                            contentDescription = "Open TPanel",
                            tint = ShadcnPrimary,
                            modifier = Modifier.size(16.dp)
                        )
                        Spacer(modifier = Modifier.size(6.dp))
                        Text(
                            text = "Open TPanel",
                            fontFamily = FigtreeFontFamily,
                            fontWeight = FontWeight.SemiBold,
                            fontSize = 13.sp,
                            color = Color.White
                        )
                    }
                }
            }

            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(horizontal = 16.dp),
                verticalArrangement = Arrangement.spacedBy(16.dp)
            ) {
                // 4 StatCards
                Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.spacedBy(12.dp)
                    ) {
                        StatCard(
                            label = "Running Droplets",
                            value = uiState.droplets.count { it.status.equals("Running", true) }.toString(),
                            change = "Current account total",
                            trend = SparklineTrend.NEUTRAL,
                            icon = Icons.Outlined.WaterDrop,
                            sparkline = emptyList(),
                            modifier = Modifier.weight(1f)
                        )
                        StatCard(
                            label = "vCPU Utilization",
                            value = uiState.cloudMetrics["cpuUsed"] ?: "Unavailable",
                            change = "Live telemetry unavailable",
                            trend = SparklineTrend.NEUTRAL,
                            icon = Icons.Outlined.Memory,
                            sparkline = emptyList(),
                            modifier = Modifier.weight(1f)
                        )
                    }
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.spacedBy(12.dp)
                    ) {
                        StatCard(
                            label = "Bandwidth Out",
                            value = uiState.cloudMetrics["bandwidthUsed"] ?: "Unavailable",
                            change = "Usage data unavailable",
                            trend = SparklineTrend.NEUTRAL,
                            icon = Icons.Outlined.SwapVert,
                            sparkline = emptyList(),
                            modifier = Modifier.weight(1f)
                        )
                        StatCard(
                            label = "Monthly Spend",
                            value = "$${uiState.droplets.sumOf { it.priceMo }}.00",
                            change = "Based on listed droplets",
                            trend = SparklineTrend.NEUTRAL,
                            icon = Icons.Outlined.Speed,
                            sparkline = emptyList(),
                            modifier = Modifier.weight(1f)
                        )
                    }
                }

                // Workload Performance Chart
                ShadcnCard {
                    CardHeader(
                        title = "Workload Performance",
                        description = "Aggregate CPU & memory load across all droplets",
                        action = {
                            SegmentedPeriodToggle(
                                options = listOf("1H", "24H", "7D", "30D"),
                                selected = uiState.selectedWorkloadPeriod,
                                onSelect = onSelectWorkloadPeriod
                            )
                        }
                    )
                    Column(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(16.dp),
                        verticalArrangement = Arrangement.spacedBy(12.dp)
                    ) {
                        Row(
                            horizontalArrangement = Arrangement.spacedBy(16.dp),
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            LegendDotItem(color = ShadcnPrimary, label = "CPU %")
                            LegendDotItem(color = ShadcnInk, label = "Memory %")
                        }
                        Text(
                            text = "Live CPU and memory history is not available from the current API.",
                            fontFamily = FigtreeFontFamily,
                            fontSize = 13.sp,
                            color = ShadcnMutedForeground
                        )
                    }
                }

                // Usage Overview Card
                ShadcnCard {
                    CardHeader(
                        title = "Usage Overview",
                        description = "Account quota & resource allocation"
                    )
                    Column(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(16.dp),
                        verticalArrangement = Arrangement.spacedBy(14.dp)
                    ) {
                        Text(
                            text = "vCPU cores allocated: $allocatedVcpus",
                            fontFamily = FigtreeFontFamily,
                            fontSize = 13.sp,
                            color = ShadcnForeground
                        )
                        Text(
                            text = "Memory allocated: $allocatedMemoryGb GB",
                            fontFamily = FigtreeFontFamily,
                            fontSize = 13.sp,
                            color = ShadcnForeground
                        )
                        Text(
                            text = "Storage allocated: $allocatedStorageGb GB",
                            fontFamily = FigtreeFontFamily,
                            fontSize = 13.sp,
                            color = ShadcnForeground
                        )
                        Text(
                            text = "Outbound bandwidth: ${uiState.cloudMetrics["bandwidthUsed"] ?: "Unavailable"}",
                            fontFamily = FigtreeFontFamily,
                            fontSize = 13.sp,
                            color = ShadcnMutedForeground
                        )
                    }
                }

                // My Droplets Preview Card
                ShadcnCard {
                    CardHeader(
                        title = "My Droplets",
                        description = "${uiState.droplets.size} virtual machines across ${uiState.droplets.map { it.region }.distinct().count()} regions",
                        action = {
                            ShadcnOutlineButton(
                                text = "Manage All",
                                trailingIcon = Icons.AutoMirrored.Outlined.ArrowForward,
                                onClick = { onNavigate(AppScreen.CLOUD_DROPLETS) }
                            )
                        }
                    )
                    Column(modifier = Modifier.fillMaxWidth()) {
                        uiState.droplets.take(3).forEachIndexed { idx, droplet ->
                            DropletMobileRow(
                                droplet = droplet,
                                onClick = { onNavigate(AppScreen.CLOUD_DROPLETS) }
                            )
                            if (idx < 2) {
                                HorizontalDivider(color = ShadcnBorder, thickness = 1.dp)
                            }
                        }
                    }
                }

                // Create New Grid (6 Tiles — each opens its own dedicated page)
                ShadcnCard {
                    CardHeader(
                        title = "Create New",
                        description = "Deploy infrastructure in seconds"
                    )
                    Column(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(16.dp),
                        verticalArrangement = Arrangement.spacedBy(10.dp)
                    ) {
                        val createItems = listOf(
                            CreateTileSpec(
                                title = "Create Droplet",
                                desc = "Linux / Docker VM in 55s",
                                badge = "Popular",
                                icon = Icons.Outlined.WaterDrop,
                                onClick = onOpenCreateDroplet
                            ),
                            CreateTileSpec(
                                title = "Kubernetes",
                                desc = "Managed K8s cluster",
                                badge = "New",
                                icon = Icons.Outlined.Hub,
                                onClick = { onNavigate(AppScreen.CLOUD_KUBERNETES) }
                            ),
                            CreateTileSpec(
                                title = "Volumes",
                                desc = "NVMe block storage",
                                badge = null,
                                icon = Icons.Outlined.Storage,
                                onClick = { onNavigate(AppScreen.CLOUD_VOLUMES) }
                            ),
                            CreateTileSpec(
                                title = "Custom Image",
                                desc = "Import QCOW2 / ISO",
                                badge = null,
                                icon = Icons.Outlined.ViewInAr,
                                onClick = { onNavigate(AppScreen.CLOUD_IMAGES) }
                            ),
                            CreateTileSpec(
                                title = "Static Hosting",
                                desc = "Zero-config edge deploy",
                                badge = "Free",
                                icon = Icons.Outlined.Public,
                                onClick = { onNavigate(AppScreen.ONEPROFILE_HOSTING) }
                            ),
                            CreateTileSpec(
                                title = "TPanel Server",
                                desc = "Managed web hosting stack",
                                badge = null,
                                icon = Icons.Outlined.Terminal,
                                onClick = onOpenTPanel
                            )
                        )
                        createItems.chunked(2).forEach { pair ->
                            Row(
                                modifier = Modifier.fillMaxWidth(),
                                horizontalArrangement = Arrangement.spacedBy(10.dp)
                            ) {
                                pair.forEach { item ->
                                    CreateNewTile(
                                        spec = item,
                                        modifier = Modifier.weight(1f)
                                    )
                                }
                            }
                        }
                    }
                }

                // Quick Access Infrastructure Card (Domains, Firewall, SSH Keys, Snapshots, Backups)
                ShadcnCard {
                    CardHeader(
                        title = "Networking & Data Protection",
                        description = "Manage DNS zones, security rules, keys & backups"
                    )
                    Column(modifier = Modifier.fillMaxWidth()) {
                        QuickAccessRow(
                            icon = Icons.Outlined.Language,
                            title = "Domains & DNS",
                            desc = "${uiState.domains.size} active domains · Auto-SSL enabled",
                            onClick = { onNavigate(AppScreen.CLOUD_DOMAINS) }
                        )
                        HorizontalDivider(color = ShadcnBorder, thickness = 1.dp)
                        QuickAccessRow(
                            icon = Icons.Outlined.Security,
                            title = "Cloud Firewalls",
                            desc = "${uiState.firewallRules.size} active inbound/outbound rules",
                            onClick = { onNavigate(AppScreen.CLOUD_FIREWALL) }
                        )
                        HorizontalDivider(color = ShadcnBorder, thickness = 1.dp)
                        QuickAccessRow(
                            icon = Icons.Outlined.VpnKey,
                            title = "SSH Keys",
                            desc = "SSH key data is not available from the current API",
                            onClick = { onNavigate(AppScreen.CLOUD_SSH_KEYS) }
                        )
                        HorizontalDivider(color = ShadcnBorder, thickness = 1.dp)
                        QuickAccessRow(
                            icon = Icons.Outlined.PhotoCamera,
                            title = "Snapshots & Backups",
                            desc = "Snapshot and backup data is not available from the current API",
                            onClick = { onNavigate(AppScreen.CLOUD_SNAPSHOTS) }
                        )
                    }
                }

                // Service Status Card
                ShadcnCard {
                    CardHeader(
                        title = "Regional Service Status",
                        description = "Live health across Tiwlo data centers",
                        action = { StatusPill(text = "Status unavailable", tone = StatusTone.AMBER) }
                    )
                    Column(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(16.dp),
                        verticalArrangement = Arrangement.spacedBy(12.dp)
                    ) {
                        Text(
                            text = "Live regional service status is not available from the current API.",
                            fontFamily = FigtreeFontFamily,
                            fontSize = 13.sp,
                            color = ShadcnMutedForeground
                        )
                    }
                }

                Spacer(modifier = Modifier.height(8.dp))
            }
        }
    }
}

/**
 * 2. Create Droplet Sub-Page (`AppScreen.CLOUD_CREATE_DROPLET`)
 * Pure shadcn UI — NO dark ring card here! Includes mobile Back button (`<-`).
 */
@Composable
fun CloudCreateDropletScreen(
    uiState: TiwloUiState,
    onNavigate: (AppScreen) -> Unit,
    onBack: () -> Unit,
    onCreateDroplet: (String, String, String, String, Int, Int, Int, Int) -> Unit,
    onMarkAllNotificationsRead: () -> Unit,
    onNotificationClick: (String) -> Unit
) {
    var name by remember { mutableStateOf("prod-node-${uiState.droplets.size + 1}") }
    var selectedRegion by remember { mutableStateOf("Singapore · SG1") }
    var selectedImage by remember { mutableStateOf("Ubuntu 24.04 LTS") }
    var selectedPlanIndex by remember { mutableIntStateOf(1) }

    val regions = listOf(
        "Singapore · SG1" to "🇸🇬",
        "Frankfurt · FRA1" to "🇩🇪",
        "New York · NYC1" to "🇺🇸",
        "Bangalore · BLR1" to "🇮🇳"
    )
    val images = listOf(
        "Ubuntu 24.04 LTS",
        "Debian 12 Bookworm",
        "Docker 26 on Ubuntu",
        "Rocky Linux 9.4"
    )
    val plans = listOf(
        DropletPlanOption("Basic Shared", 1, 2, 50, 12),
        DropletPlanOption("General Purpose", 2, 4, 80, 24),
        DropletPlanOption("CPU Optimized", 4, 8, 160, 48),
        DropletPlanOption("Memory Heavy", 8, 16, 320, 96)
    )

    DashboardShell(
        currentScreen = AppScreen.CLOUD_CREATE_DROPLET,
        screenTitle = "Create Droplet",
        screenSubtitle = "Deploy a new Linux or Docker server",
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
                title = "Deploy Cloud Droplet",
                subtitle = "Choose hostname, datacenter region, OS image, and compute size."
            )

            // 1. Hostname
            ShadcnCard {
                CardHeader(
                    title = "1. Droplet Hostname",
                    description = "Choose a unique identifier for your server"
                )
                Column(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(16.dp),
                    verticalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    ShadcnInput(
                        value = name,
                        onValueChange = { name = it },
                        placeholder = "e.g. prod-api-sg1",
                        testTag = "droplet_hostname_input"
                    )
                    Text(
                        text = "FQDN: ${name.ifBlank { "droplet" }}.tiwlo.cloud",
                        fontFamily = JetBrainsMonoFontFamily,
                        fontSize = 11.sp,
                        color = ShadcnMutedForeground
                    )
                }
            }

            // 2. Datacenter Region
            ShadcnCard {
                CardHeader(
                    title = "2. Choose Region",
                    description = "Select the closest datacenter to your users"
                )
                Column(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(16.dp),
                    verticalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    regions.forEach { (regionName, flag) ->
                        val active = selectedRegion == regionName
                        Row(
                            modifier = Modifier
                                .fillMaxWidth()
                                .clip(RoundedCornerShape(10.dp))
                                .background(if (active) ShadcnPrimary.copy(alpha = 0.12f) else ShadcnBackground)
                                .border(
                                    1.dp,
                                    if (active) ShadcnPrimary else ShadcnBorder,
                                    RoundedCornerShape(10.dp)
                                )
                                .clickable { selectedRegion = regionName }
                                .padding(horizontal = 14.dp, vertical = 12.dp),
                            horizontalArrangement = Arrangement.SpaceBetween,
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Row(
                                verticalAlignment = Alignment.CenterVertically,
                                horizontalArrangement = Arrangement.spacedBy(10.dp)
                            ) {
                                Text(text = flag, fontSize = 18.sp)
                                Text(
                                    text = regionName,
                                    fontFamily = FigtreeFontFamily,
                                    fontWeight = FontWeight.SemiBold,
                                    fontSize = 13.sp,
                                    color = ShadcnForeground
                                )
                            }
                            if (active) {
                                Icon(
                                    imageVector = Icons.Outlined.Check,
                                    contentDescription = "Selected",
                                    tint = ShadcnPrimaryDark,
                                    modifier = Modifier.size(18.dp)
                                )
                            }
                        }
                    }
                }
            }

            // 3. OS Image
            ShadcnCard {
                CardHeader(
                    title = "3. Choose OS Image",
                    description = "Pre-configured Linux & container distributions"
                )
                Column(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(16.dp),
                    verticalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    images.forEach { img ->
                        val active = selectedImage == img
                        Row(
                            modifier = Modifier
                                .fillMaxWidth()
                                .clip(RoundedCornerShape(10.dp))
                                .background(if (active) ShadcnInk else ShadcnMuted.copy(alpha = 0.6f))
                                .clickable { selectedImage = img }
                                .padding(horizontal = 14.dp, vertical = 12.dp),
                            horizontalArrangement = Arrangement.SpaceBetween,
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Text(
                                text = img,
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

            // 4. Plan Size
            ShadcnCard {
                CardHeader(
                    title = "4. Droplet Size",
                    description = "Dedicated NVMe SSD & high-frequency vCPUs"
                )
                Column(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(16.dp),
                    verticalArrangement = Arrangement.spacedBy(10.dp)
                ) {
                    plans.forEachIndexed { index, plan ->
                        val active = selectedPlanIndex == index
                        Row(
                            modifier = Modifier
                                .fillMaxWidth()
                                .clip(RoundedCornerShape(12.dp))
                                .background(if (active) ShadcnPrimary.copy(alpha = 0.12f) else ShadcnBackground)
                                .border(
                                    1.dp,
                                    if (active) ShadcnPrimary else ShadcnBorder,
                                    RoundedCornerShape(12.dp)
                                )
                                .clickable { selectedPlanIndex = index }
                                .padding(14.dp),
                            horizontalArrangement = Arrangement.SpaceBetween,
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Column {
                                Text(
                                    text = plan.label,
                                    fontFamily = FigtreeFontFamily,
                                    fontWeight = FontWeight.Bold,
                                    fontSize = 14.sp,
                                    color = ShadcnForeground
                                )
                                Text(
                                    text = "${plan.vcpu} vCPU · ${plan.ramGb} GB RAM · ${plan.diskGb} GB NVMe",
                                    fontFamily = JetBrainsMonoFontFamily,
                                    fontSize = 11.sp,
                                    color = ShadcnMutedForeground
                                )
                            }
                            Text(
                                text = "$${plan.priceMo}/mo",
                                fontFamily = FigtreeFontFamily,
                                fontWeight = FontWeight.Bold,
                                fontSize = 16.sp,
                                color = ShadcnForeground
                            )
                        }
                    }
                }
            }

            val chosenPlan = plans[selectedPlanIndex]
            ShadcnPrimaryButton(
                text = "Deploy Droplet ($${chosenPlan.priceMo}/mo)",
                icon = Icons.Outlined.Bolt,
                onClick = {
                    val flag = regions.firstOrNull { it.first == selectedRegion }?.second ?: "🇸🇬"
                    onCreateDroplet(
                        name,
                        selectedRegion,
                        flag,
                        selectedImage,
                        chosenPlan.vcpu,
                        chosenPlan.ramGb,
                        chosenPlan.diskGb,
                        chosenPlan.priceMo
                    )
                },
                modifier = Modifier
                    .fillMaxWidth()
                    .testTag("confirm_deploy_droplet_button")
            )
        }
    }
}

private data class DropletPlanOption(
    val label: String,
    val vcpu: Int,
    val ramGb: Int,
    val diskGb: Int,
    val priceMo: Int
)

/**
 * 3. My Droplets Sub-Page (`AppScreen.CLOUD_DROPLETS`)
 * Pure shadcn UI — NO dark ring card! Includes mobile Back button (`<-`).
 */
@Composable
fun CloudDropletsListScreen(
    uiState: TiwloUiState,
    onNavigate: (AppScreen) -> Unit,
    onBack: () -> Unit,
    onToggleDropletPower: (String) -> Unit,
    onMarkAllNotificationsRead: () -> Unit,
    onNotificationClick: (String) -> Unit
) {
    DashboardShell(
        currentScreen = AppScreen.CLOUD_DROPLETS,
        screenTitle = "My Droplets",
        screenSubtitle = "${uiState.droplets.size} virtual machines",
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
                title = "Virtual Machines",
                subtitle = "Monitor CPU, memory, IPv4 addresses, and power states."
            ) {
                ShadcnPrimaryButton(
                    text = "Create Droplet",
                    icon = Icons.Outlined.Add,
                    onClick = { onNavigate(AppScreen.CLOUD_CREATE_DROPLET) }
                )
            }

            uiState.droplets.forEach { droplet ->
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
                                    Text(text = droplet.flag, fontSize = 18.sp)
                                }
                                Column {
                                    Text(
                                        text = droplet.name,
                                        fontFamily = FigtreeFontFamily,
                                        fontWeight = FontWeight.Bold,
                                        fontSize = 15.sp,
                                        color = ShadcnForeground
                                    )
                                    Text(
                                        text = "${droplet.region} · ${droplet.image}",
                                        fontFamily = FigtreeFontFamily,
                                        fontSize = 12.sp,
                                        color = ShadcnMutedForeground
                                    )
                                }
                            }
                            val tone = when (droplet.status) {
                                "Running" -> StatusTone.GREEN
                                "Provisioning" -> StatusTone.AMBER
                                else -> StatusTone.SLATE
                            }
                            StatusPill(text = droplet.status, tone = tone, showDot = true)
                        }

                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.SpaceBetween
                        ) {
                            Text(
                                text = "IPv4: ${droplet.ip}",
                                fontFamily = JetBrainsMonoFontFamily,
                                fontSize = 12.sp,
                                color = ShadcnForeground
                            )
                            Text(
                                text = "${droplet.vcpu} vCPU · ${droplet.ramGb} GB · $${droplet.priceMo}/mo",
                                fontFamily = JetBrainsMonoFontFamily,
                                fontSize = 11.sp,
                                color = ShadcnMutedForeground
                            )
                        }

                        if (droplet.cpuPercent != null) {
                            ProgressBarMeter(
                                label = "CPU Load",
                                usedLabel = "${droplet.cpuPercent}%",
                                fraction = droplet.cpuPercent / 100f,
                                color = ShadcnPrimary
                            )
                        } else {
                            Text(
                                text = "CPU metrics unavailable",
                                fontSize = 12.sp,
                                color = ShadcnMutedForeground
                            )
                        }

                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.spacedBy(8.dp)
                        ) {
                            ShadcnOutlineButton(
                                text = if (droplet.status == "Running") "Power Off" else "Boot Server",
                                icon = Icons.Outlined.Refresh,
                                onClick = { onToggleDropletPower(droplet.id) },
                                modifier = Modifier.weight(1f)
                            )
                            ShadcnOutlineButton(
                                text = "Open TPanel",
                                icon = Icons.Outlined.Terminal,
                                onClick = { onNavigate(AppScreen.CLOUD_TPANEL) },
                                modifier = Modifier.weight(1f)
                            )
                        }
                    }
                }
            }
        }
    }
}

/**
 * 4. TPanel Sub-Page (`AppScreen.CLOUD_TPANEL`)
 * Pure shadcn UI — NO dark ring card! Includes mobile Back button (`<-`).
 */
@Composable
fun CloudTPanelScreen(
    uiState: TiwloUiState,
    onNavigate: (AppScreen) -> Unit,
    onBack: () -> Unit,
    onMarkAllNotificationsRead: () -> Unit,
    onNotificationClick: (String) -> Unit
) {
    DashboardShell(
        currentScreen = AppScreen.CLOUD_TPANEL,
        screenTitle = "TPanel Control Center",
        screenSubtitle = "Web stack, SSL, Databases & Terminal",
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
                title = "TPanel Server Manager",
                subtitle = "TPanel data is not available from the current API."
            ) {
                StatusPill(text = "Unavailable", tone = StatusTone.AMBER, showDot = true)
            }

            ShadcnCard {
                CardHeader(
                    title = "Hosted Sites & Reverse Proxies",
                    description = "Hosted site data is not available from the current API."
                )
                Column(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(16.dp),
                    verticalArrangement = Arrangement.spacedBy(12.dp)
                ) {
                    Text(
                        text = "Connect a supported TPanel API to view hosted sites.",
                        fontFamily = FigtreeFontFamily,
                        fontSize = 13.sp,
                        color = ShadcnMutedForeground
                    )
                }
            }

            ShadcnCard {
                CardHeader(
                    title = "Root SSH Console",
                    description = "SSH access is not available from the current API."
                )
                Column(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(16.dp)
                ) {
                    Text(
                        text = "Server console access is not supported in this app.",
                        fontFamily = FigtreeFontFamily,
                        fontSize = 13.sp,
                        color = ShadcnMutedForeground
                    )
                }
            }
        }
    }
}

@Composable
private fun DropletMobileRow(
    droplet: DropletItem,
    onClick: () -> Unit
) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .clickable(onClick = onClick)
            .padding(horizontal = 16.dp, vertical = 13.dp),
        horizontalArrangement = Arrangement.SpaceBetween,
        verticalAlignment = Alignment.CenterVertically
    ) {
        Row(
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(10.dp),
            modifier = Modifier.weight(1f)
        ) {
            Text(text = droplet.flag, fontSize = 18.sp)
            Column {
                Text(
                    text = droplet.name,
                    fontFamily = FigtreeFontFamily,
                    fontWeight = FontWeight.SemiBold,
                    fontSize = 13.sp,
                    color = ShadcnForeground
                )
                Text(
                    text = "${droplet.ip} · ${droplet.vcpu} vCPU / ${droplet.ramGb} GB",
                    fontFamily = JetBrainsMonoFontFamily,
                    fontSize = 11.sp,
                    color = ShadcnMutedForeground
                )
            }
        }
        val tone = when (droplet.status) {
            "Running" -> StatusTone.GREEN
            "Provisioning" -> StatusTone.AMBER
            else -> StatusTone.SLATE
        }
        StatusPill(text = droplet.status, tone = tone, showDot = true)
    }
}

@Composable
private fun QuickAccessRow(
    icon: ImageVector,
    title: String,
    desc: String,
    onClick: () -> Unit
) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .clickable(onClick = onClick)
            .padding(horizontal = 16.dp, vertical = 13.dp),
        horizontalArrangement = Arrangement.SpaceBetween,
        verticalAlignment = Alignment.CenterVertically
    ) {
        Row(
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(12.dp),
            modifier = Modifier.weight(1f)
        ) {
            Box(
                modifier = Modifier
                    .size(36.dp)
                    .clip(RoundedCornerShape(9.dp))
                    .background(ShadcnMuted),
                contentAlignment = Alignment.Center
            ) {
                Icon(
                    imageVector = icon,
                    contentDescription = title,
                    tint = ShadcnForeground,
                    modifier = Modifier.size(18.dp)
                )
            }
            Column {
                Text(
                    text = title,
                    fontFamily = FigtreeFontFamily,
                    fontWeight = FontWeight.SemiBold,
                    fontSize = 13.sp,
                    color = ShadcnForeground
                )
                Text(
                    text = desc,
                    fontFamily = FigtreeFontFamily,
                    fontSize = 12.sp,
                    color = ShadcnMutedForeground
                )
            }
        }
        Icon(
            imageVector = Icons.AutoMirrored.Outlined.ArrowForward,
            contentDescription = null,
            tint = ShadcnMutedForeground,
            modifier = Modifier.size(16.dp)
        )
    }
}

private data class CreateTileSpec(
    val title: String,
    val desc: String,
    val badge: String?,
    val icon: ImageVector,
    val onClick: () -> Unit
)

@Composable
private fun CreateNewTile(
    spec: CreateTileSpec,
    modifier: Modifier = Modifier
) {
    Column(
        modifier = modifier
            .clip(RoundedCornerShape(12.dp))
            .clickable(onClick = spec.onClick)
            .padding(12.dp)
    ) {
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically
        ) {
            Box(
                modifier = Modifier
                    .size(32.dp)
                    .clip(RoundedCornerShape(8.dp))
                    .background(ShadcnMuted),
                contentAlignment = Alignment.Center
            ) {
                Icon(
                    imageVector = spec.icon,
                    contentDescription = spec.title,
                    tint = ShadcnForeground,
                    modifier = Modifier.size(16.dp)
                )
            }
            if (spec.badge != null) {
                StatusPill(
                    text = spec.badge,
                    tone = if (spec.badge == "Popular") StatusTone.GREEN else StatusTone.BLUE
                )
            }
        }
        Spacer(modifier = Modifier.height(10.dp))
        Text(
            text = spec.title,
            fontFamily = FigtreeFontFamily,
            fontWeight = FontWeight.SemiBold,
            fontSize = 13.sp,
            color = ShadcnForeground
        )
        Spacer(modifier = Modifier.height(2.dp))
        Text(
            text = spec.desc,
            fontFamily = FigtreeFontFamily,
            fontSize = 11.sp,
            color = ShadcnMutedForeground
        )
    }
}

@Composable
private fun ServiceStatusRow(
    service: String,
    status: String,
    tone: StatusTone
) {
    Row(
        modifier = Modifier.fillMaxWidth(),
        horizontalArrangement = Arrangement.SpaceBetween,
        verticalAlignment = Alignment.CenterVertically
    ) {
        Text(
            text = service,
            fontFamily = FigtreeFontFamily,
            fontWeight = FontWeight.Medium,
            fontSize = 13.sp,
            color = ShadcnForeground
        )
        StatusPill(text = status, tone = tone, showDot = true)
    }
}

@Composable
private fun LegendDotItem(
    color: Color,
    label: String
) {
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
