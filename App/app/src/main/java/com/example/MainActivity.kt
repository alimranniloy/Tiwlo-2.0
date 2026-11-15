package com.example

import android.os.Bundle
import android.net.Uri
import androidx.activity.ComponentActivity
import androidx.activity.compose.BackHandler
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.compose.animation.Crossfade
import androidx.compose.animation.core.tween
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import androidx.compose.ui.text.input.KeyboardType
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewmodel.compose.viewModel
import com.example.model.AppScreen
import com.example.ui.components.MobileMenuHubScreen
import com.example.ui.components.StoreMenuHubScreen
import com.example.ui.components.ToastBanner
import com.example.ui.screens.AuthScreen
import com.example.ui.screens.AuthVerificationScreen
import com.example.ui.screens.CloudAccountWorkspaceSubScreen
import com.example.ui.screens.CloudCreateDropletScreen
import com.example.ui.screens.CloudDomainsScreen
import com.example.ui.screens.CloudDropletsListScreen
import com.example.ui.screens.CloudImagesScreen
import com.example.ui.screens.CloudKubernetesScreen
import com.example.ui.screens.CloudScreen
import com.example.ui.screens.CloudSecurityNetworkScreen
import com.example.ui.screens.CloudSnapshotsBackupsScreen
import com.example.ui.screens.CloudTPanelScreen
import com.example.ui.screens.CloudVolumesScreen
import com.example.ui.screens.CreateStoreScreen
import com.example.ui.screens.EcommerceScreen
import com.example.ui.screens.MailComposeScreen
import com.example.ui.screens.MailScreen
import com.example.ui.screens.OneProfileEditScreen
import com.example.ui.screens.OneProfileScreen
import com.example.ui.screens.OneProfileSubPageScreen
import com.example.ui.screens.StoreCategoriesScreen
import com.example.ui.screens.StoreCreateProductScreen
import com.example.ui.screens.StoreInventoryScreen
import com.example.ui.screens.StoreManagementSubScreen
import com.example.ui.screens.StoreOperationsSubScreen
import com.example.ui.screens.StoreOrdersScreen
import com.example.ui.screens.StorePosScreen
import com.example.ui.screens.StoreProductsCatalogScreen
import com.example.ui.screens.StoreTScanScreen
import com.example.ui.screens.StoresHubScreen
import com.example.ui.theme.TiwloTheme
import com.example.viewmodel.TiwloViewModel

class MainActivity : ComponentActivity() {
    private var sessionViewModel: TiwloViewModel? = null

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()
        val initialSsoCallback = intent?.data
        setContent {
            TiwloTheme {
                val appViewModel: TiwloViewModel = viewModel()
                sessionViewModel = appViewModel
                TiwloAppRoot(appViewModel, initialSsoCallback)
            }
        }
    }

    override fun onNewIntent(intent: android.content.Intent) {
        super.onNewIntent(intent)
        setIntent(intent)
        val callbackUri = intent.data
        if (callbackUri?.path == "/app/sso/callback" ||
            (callbackUri?.scheme == "tiwlo" && callbackUri.host == "auth" && callbackUri.path == "/callback")
        ) {
            sessionViewModel?.consumeSsoCallback(callbackUri)
        }
    }
}

@Composable
fun TiwloAppRoot(
    viewModel: TiwloViewModel = viewModel(),
    initialSsoCallback: Uri? = null
) {
    val uiState by viewModel.uiState.collectAsStateWithLifecycle()
    LaunchedEffect(initialSsoCallback) {
        if (initialSsoCallback != null) viewModel.consumeSsoCallback(initialSsoCallback)
    }

    BackHandler(enabled = uiState.backStack.isNotEmpty() || uiState.currentScreen != AppScreen.LOGIN) {
        viewModel.navigateBack()
    }

    val activeStore = uiState.stores.firstOrNull { it.id == uiState.activeStoreId }

    Box(modifier = Modifier.fillMaxSize()) {
        Crossfade(
            targetState = uiState.currentScreen,
            animationSpec = tween(durationMillis = 200),
            label = "tiwlo_mobile_router"
        ) { screen ->
            when (screen) {
                AppScreen.LOGIN,
                AppScreen.SIGNUP -> AuthScreen(
                    mode = screen,
                    onNavigate = viewModel::navigateTo,
                    onAuthSubmit = viewModel::submitAuth,
                    onSocialLogin = viewModel::openSocialSignIn
                )

                AppScreen.AUTH_VERIFICATION -> AuthVerificationScreen(
                    type = uiState.authChallengeType,
                    message = uiState.authChallengeMessage,
                    onVerifyCode = viewModel::verifyAuthCode,
                    onBackToSignIn = viewModel::dismissAuthChallenge,
                    onOpenAddressVerification = viewModel::openPendingVerification,
                    onRefreshSession = viewModel::refreshSession
                )

                // Main Cloud Dashboard & Infrastructure Sub-Pages
                AppScreen.CLOUD -> CloudScreen(
                    uiState = uiState,
                    onNavigate = viewModel::navigateTo,
                    onOpenCreateDroplet = viewModel::openCreateDropletPage,
                    onSelectWorkloadPeriod = viewModel::selectWorkloadPeriod,
                    onOpenTPanel = viewModel::openTPanelPage,
                    onMarkAllNotificationsRead = viewModel::markAllNotificationsRead,
                    onNotificationClick = viewModel::markNotificationRead
                )

                AppScreen.CLOUD_CREATE_DROPLET -> CloudCreateDropletScreen(
                    uiState = uiState,
                    onNavigate = viewModel::navigateTo,
                    onBack = viewModel::navigateBack,
                    onCreateDroplet = viewModel::createDroplet,
                    onMarkAllNotificationsRead = viewModel::markAllNotificationsRead,
                    onNotificationClick = viewModel::markNotificationRead
                )

                AppScreen.CLOUD_DROPLETS -> CloudDropletsListScreen(
                    uiState = uiState,
                    onNavigate = viewModel::navigateTo,
                    onBack = viewModel::navigateBack,
                    onToggleDropletPower = viewModel::toggleDropletPower,
                    onMarkAllNotificationsRead = viewModel::markAllNotificationsRead,
                    onNotificationClick = viewModel::markNotificationRead
                )

                AppScreen.CLOUD_TPANEL -> CloudTPanelScreen(
                    uiState = uiState,
                    onNavigate = viewModel::navigateTo,
                    onBack = viewModel::navigateBack,
                    onMarkAllNotificationsRead = viewModel::markAllNotificationsRead,
                    onNotificationClick = viewModel::markNotificationRead
                )

                AppScreen.CLOUD_KUBERNETES -> CloudKubernetesScreen(
                    uiState = uiState,
                    onNavigate = viewModel::navigateTo,
                    onBack = viewModel::navigateBack,
                    onMarkAllNotificationsRead = viewModel::markAllNotificationsRead,
                    onNotificationClick = viewModel::markNotificationRead
                )

                AppScreen.CLOUD_VOLUMES -> CloudVolumesScreen(
                    uiState = uiState,
                    onNavigate = viewModel::navigateTo,
                    onBack = viewModel::navigateBack,
                    onAddVolume = viewModel::addVolume,
                    onMarkAllNotificationsRead = viewModel::markAllNotificationsRead,
                    onNotificationClick = viewModel::markNotificationRead
                )

                AppScreen.CLOUD_DOMAINS -> CloudDomainsScreen(
                    uiState = uiState,
                    onNavigate = viewModel::navigateTo,
                    onBack = viewModel::navigateBack,
                    onAddDomain = viewModel::addDomain,
                    onMarkAllNotificationsRead = viewModel::markAllNotificationsRead,
                    onNotificationClick = viewModel::markNotificationRead
                )

                AppScreen.CLOUD_IMAGES -> CloudImagesScreen(
                    uiState = uiState,
                    onNavigate = viewModel::navigateTo,
                    onBack = viewModel::navigateBack,
                    onMarkAllNotificationsRead = viewModel::markAllNotificationsRead,
                    onNotificationClick = viewModel::markNotificationRead
                )

                AppScreen.CLOUD_SNAPSHOTS,
                AppScreen.CLOUD_BACKUPS -> CloudSnapshotsBackupsScreen(
                    currentScreen = screen,
                    uiState = uiState,
                    onNavigate = viewModel::navigateTo,
                    onBack = viewModel::navigateBack,
                    onMarkAllNotificationsRead = viewModel::markAllNotificationsRead,
                    onNotificationClick = viewModel::markNotificationRead
                )

                AppScreen.CLOUD_FIREWALL,
                AppScreen.CLOUD_SSH_KEYS -> CloudSecurityNetworkScreen(
                    currentScreen = screen,
                    uiState = uiState,
                    onNavigate = viewModel::navigateTo,
                    onBack = viewModel::navigateBack,
                    onMarkAllNotificationsRead = viewModel::markAllNotificationsRead,
                    onNotificationClick = viewModel::markNotificationRead
                )

                AppScreen.CLOUD_MARKETPLACE,
                AppScreen.CLOUD_IDENTITY,
                AppScreen.CLOUD_BILLING,
                AppScreen.CLOUD_SETTINGS,
                AppScreen.CLOUD_HELP -> CloudAccountWorkspaceSubScreen(
                    currentScreen = screen,
                    uiState = uiState,
                    onNavigate = viewModel::navigateTo,
                    onBack = viewModel::navigateBack,
                    onMarkAllNotificationsRead = viewModel::markAllNotificationsRead,
                    onNotificationClick = viewModel::markNotificationRead
                )

                // Online Stores Hub & Create Store (Main Console)
                AppScreen.STORES_HUB -> StoresHubScreen(
                    uiState = uiState,
                    onNavigate = viewModel::navigateTo,
                    onOpenCreateStore = viewModel::openCreateStorePage,
                    onEnterStoreDashboard = viewModel::enterStoreDashboard,
                    onMarkAllNotificationsRead = viewModel::markAllNotificationsRead,
                    onNotificationClick = viewModel::markNotificationRead
                )

                AppScreen.CREATE_STORE -> CreateStoreScreen(
                    uiState = uiState,
                    onNavigate = viewModel::navigateTo,
                    onBack = viewModel::navigateBack,
                    onCreateStore = viewModel::createNewStore,
                    onMarkAllNotificationsRead = viewModel::markAllNotificationsRead,
                    onNotificationClick = viewModel::markNotificationRead
                )

                // Separate Store Admin Panel (Inside TiwiMart or any selected Store)
                AppScreen.ECOMMERCE -> EcommerceScreen(
                    uiState = uiState,
                    onNavigate = viewModel::navigateTo,
                    onSwitchToMainDashboard = viewModel::switchToMainDashboard,
                    onSelectStockPeriod = viewModel::selectStockPeriod,
                    onOpenProductModal = viewModel::openCreateProductPage,
                    onOpenCategoryModal = viewModel::openCategoriesPage,
                    onOpenPosModal = viewModel::openPosPage
                )

                AppScreen.STORE_MENU -> StoreMenuHubScreen(
                    storeName = activeStore?.name.orEmpty(),
                    storeDomain = activeStore?.domain.orEmpty(),
                    onSwitchToMainDashboard = viewModel::switchToMainDashboard,
                    onNavigate = viewModel::navigateTo
                )

                AppScreen.STORE_CREATE_PRODUCT -> StoreCreateProductScreen(
                    uiState = uiState,
                    onNavigate = viewModel::navigateTo,
                    onBack = viewModel::navigateBack,
                    onSwitchToMainDashboard = viewModel::switchToMainDashboard,
                    onAddProduct = viewModel::addProduct
                )

                AppScreen.STORE_CATEGORIES -> StoreCategoriesScreen(
                    uiState = uiState,
                    onNavigate = viewModel::navigateTo,
                    onBack = viewModel::navigateBack,
                    onSwitchToMainDashboard = viewModel::switchToMainDashboard,
                    onAddCategory = viewModel::addCategory,
                    onAddSubCategory = viewModel::addSubCategory
                )

                AppScreen.STORE_PRODUCTS -> StoreProductsCatalogScreen(
                    uiState = uiState,
                    onNavigate = viewModel::navigateTo,
                    onBack = viewModel::navigateBack,
                    onSwitchToMainDashboard = viewModel::switchToMainDashboard
                )

                AppScreen.STORE_POS -> StorePosScreen(
                    uiState = uiState,
                    onNavigate = viewModel::navigateTo,
                    onBack = viewModel::navigateBack,
                    onSwitchToMainDashboard = viewModel::switchToMainDashboard,
                    onAddToPosCart = viewModel::addToPosCart,
                    onRemoveFromPosCart = viewModel::removeFromPosCart,
                    onClearPosCart = viewModel::clearPosCart,
                    onCheckoutPos = viewModel::checkoutPosOrder
                )

                AppScreen.STORE_TSCAN -> StoreTScanScreen(
                    uiState = uiState,
                    onNavigate = viewModel::navigateTo,
                    onBack = viewModel::navigateBack,
                    onSwitchToMainDashboard = viewModel::switchToMainDashboard,
                    onScanCode = viewModel::scanProductCode
                )

                AppScreen.STORE_INVENTORY -> StoreInventoryScreen(
                    uiState = uiState,
                    onNavigate = viewModel::navigateTo,
                    onBack = viewModel::navigateBack,
                    onSwitchToMainDashboard = viewModel::switchToMainDashboard,
                    onRestockProduct = viewModel::restockProduct
                )

                AppScreen.STORE_ORDERS -> StoreOrdersScreen(
                    uiState = uiState,
                    onNavigate = viewModel::navigateTo,
                    onBack = viewModel::navigateBack,
                    onSwitchToMainDashboard = viewModel::switchToMainDashboard,
                    onAdvanceOrderStatus = viewModel::advanceOrderStatus
                )

                AppScreen.STORE_PURCHASES,
                AppScreen.STORE_SUPPLIERS,
                AppScreen.STORE_CUSTOMERS -> StoreOperationsSubScreen(
                    currentScreen = screen,
                    uiState = uiState,
                    onNavigate = viewModel::navigateTo,
                    onBack = viewModel::navigateBack,
                    onSwitchToMainDashboard = viewModel::switchToMainDashboard
                )

                AppScreen.STORE_ANALYTICS,
                AppScreen.STORE_MARKETING,
                AppScreen.STORE_PROMO_CODES,
                AppScreen.STORE_REVIEWS,
                AppScreen.STORE_THEME,
                AppScreen.STORE_PAYMENTS,
                AppScreen.STORE_SHIPPING,
                AppScreen.STORE_STAFF,
                AppScreen.STORE_CHECKLIST -> StoreManagementSubScreen(
                    currentScreen = screen,
                    uiState = uiState,
                    onNavigate = viewModel::navigateTo,
                    onBack = viewModel::navigateBack,
                    onSwitchToMainDashboard = viewModel::switchToMainDashboard,
                    onAddPromoCode = viewModel::addPromoCode
                )

                // Tiwlo Mail
                AppScreen.EMAIL -> MailScreen(
                    uiState = uiState,
                    onNavigate = viewModel::navigateTo,
                    onSelectFolder = viewModel::selectMailFolder,
                    onSelectCategory = viewModel::selectMailCategory,
                    onSearchQueryChange = viewModel::updateMailSearchQuery,
                    onSelectEmail = viewModel::selectEmail,
                    onToggleStar = viewModel::toggleEmailStar,
                    onDeleteEmail = viewModel::deleteEmail,
                    onOpenCompose = viewModel::openComposeEmailPage,
                    onMarkAllNotificationsRead = viewModel::markAllNotificationsRead,
                    onNotificationClick = viewModel::markNotificationRead
                )

                AppScreen.EMAIL_COMPOSE -> MailComposeScreen(
                    uiState = uiState,
                    onNavigate = viewModel::navigateTo,
                    onBack = viewModel::navigateBack,
                    onSendEmail = viewModel::sendNewEmail,
                    onMarkAllNotificationsRead = viewModel::markAllNotificationsRead,
                    onNotificationClick = viewModel::markNotificationRead
                )

                // OneProfile (UIDs)
                AppScreen.ONEPROFILE -> OneProfileScreen(
                    uiState = uiState,
                    onNavigate = viewModel::navigateTo,
                    onSelectAnalyticsPeriod = viewModel::selectAnalyticsPeriod,
                    onSelectTheme = viewModel::selectProfileTheme,
                    onOpenEditProfile = viewModel::openEditProfilePage,
                    onMarkAllNotificationsRead = viewModel::markAllNotificationsRead,
                    onNotificationClick = viewModel::markNotificationRead
                )

                AppScreen.ONEPROFILE_EDIT -> OneProfileEditScreen(
                    uiState = uiState,
                    onNavigate = viewModel::navigateTo,
                    onBack = viewModel::navigateBack,
                    onSaveProfile = viewModel::saveProfileChanges,
                    onMarkAllNotificationsRead = viewModel::markAllNotificationsRead,
                    onNotificationClick = viewModel::markNotificationRead
                )

                AppScreen.ONEPROFILE_SUBDOMAINS,
                AppScreen.ONEPROFILE_TEMPLATES,
                AppScreen.ONEPROFILE_HOSTING,
                AppScreen.ONEPROFILE_NFC,
                AppScreen.ONEPROFILE_ANALYTICS -> OneProfileSubPageScreen(
                    currentScreen = screen,
                    uiState = uiState,
                    onNavigate = viewModel::navigateTo,
                    onBack = viewModel::navigateBack,
                    onSelectTheme = viewModel::selectProfileTheme,
                    onMarkAllNotificationsRead = viewModel::markAllNotificationsRead,
                    onNotificationClick = viewModel::markNotificationRead
                )

                // Main Console Menu Hub
                AppScreen.MOBILE_MENU -> MobileMenuHubScreen(
                    unreadCount = uiState.notifications.count { it.unread },
                    notifications = uiState.notifications,
                    userName = uiState.userName,
                    userEmail = uiState.userEmail,
                    accountVerified = uiState.accountVerified,
                    unreadMailCount = uiState.emails.count { it.unread },
                    onNavigate = viewModel::navigateTo,
                    onSignOut = viewModel::signOut,
                    onMarkAllNotificationsRead = viewModel::markAllNotificationsRead,
                    onNotificationClick = viewModel::markNotificationRead
                )
            }
        }

        if (uiState.authChallengeToken != null && uiState.authChallengeType == "reauth") {
            var verificationCode by remember(uiState.authChallengeToken) { mutableStateOf("") }
            AlertDialog(
                onDismissRequest = viewModel::dismissAuthChallenge,
                title = { Text("Confirm sensitive action") },
                text = {
                    androidx.compose.foundation.layout.Column {
                        Text(uiState.authChallengeMessage.orEmpty())
                        OutlinedTextField(
                            value = verificationCode,
                            onValueChange = { value ->
                                verificationCode = value.filter(Char::isDigit).take(6)
                            },
                            label = { Text("6-digit code") },
                            singleLine = true,
                            keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number)
                        )
                    }
                },
                confirmButton = {
                    TextButton(onClick = { viewModel.verifyAuthCode(verificationCode) }) {
                        Text("Verify")
                    }
                },
                dismissButton = {
                    TextButton(onClick = viewModel::dismissAuthChallenge) {
                        Text("Cancel")
                    }
                }
            )
        }

        val toast = uiState.toastMessage
        if (toast != null) {
            ToastBanner(
                message = toast,
                onDismiss = viewModel::clearToast,
                modifier = Modifier
                    .align(Alignment.BottomCenter)
                    .padding(bottom = 84.dp)
            )
        }
    }
}
