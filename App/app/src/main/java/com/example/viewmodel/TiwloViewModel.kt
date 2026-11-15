package com.example.viewmodel

import android.app.Application
import android.net.Uri
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import com.example.data.TiwloApi
import com.example.data.TiwloApiException
import com.example.data.asJsonArray
import com.example.data.asJsonObject
import com.example.data.toApiPathSegment
import com.example.model.AppScreen
import com.example.model.CustomerItem
import com.example.model.DomainRecordItem
import com.example.model.DropletItem
import com.example.model.EmailAttachment
import com.example.model.EmailMessage
import com.example.model.FirewallRuleItem
import com.example.model.K8sClusterItem
import com.example.model.NotificationItem
import com.example.model.OrderItem
import com.example.model.ProductItem
import com.example.model.ProductReviewItem
import com.example.model.ProfileWebsiteItem
import com.example.model.PromoCodeItem
import com.example.model.PurchaseOrderItem
import com.example.model.SnapshotItem
import com.example.model.SshKeyItem
import com.example.model.StaffMemberItem
import com.example.model.StoreCategory
import com.example.model.StoreInstance
import com.example.model.SupplierItem
import com.example.model.VolumeItem
import kotlinx.coroutines.launch
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import org.json.JSONArray
import org.json.JSONObject

data class TiwloUiState(
    val currentScreen: AppScreen = AppScreen.LOGIN,
    val backStack: List<AppScreen> = emptyList(),
    val isAuthenticated: Boolean = false,
    val accountVerified: Boolean = false,
    val userName: String = "",
    val userEmail: String = "",
    val authChallengeToken: String? = null,
    val authChallengeType: String? = null,
    val authChallengeMessage: String? = null,

    // Cloud State
    val selectedWorkloadPeriod: String = "24H",
    val droplets: List<DropletItem> = emptyList(),
    val cloudMetrics: Map<String, String> = emptyMap(),
    val billingCreditBalance: String = "Unavailable",
    val billingGatewayStatus: String = "Unavailable",
    val k8sClusters: List<K8sClusterItem> = emptyList(),
    val volumes: List<VolumeItem> = emptyList(),
    val domains: List<DomainRecordItem> = emptyList(),
    val snapshots: List<SnapshotItem> = emptyList(),
    val firewallRules: List<FirewallRuleItem> = emptyList(),
    val sshKeys: List<SshKeyItem> = emptyList(),

    // Stores Hub & Separate Store Admin State
    val stores: List<StoreInstance> = emptyList(),
    val activeStoreId: String = "",
    val selectedStockPeriod: String = "7D",
    val categories: List<StoreCategory> = emptyList(),
    val storeSettings: Map<String, String> = emptyMap(),
    val products: List<ProductItem> = emptyList(),
    val orders: List<OrderItem> = emptyList(),
    val purchaseOrders: List<PurchaseOrderItem> = emptyList(),
    val suppliers: List<SupplierItem> = emptyList(),
    val customers: List<CustomerItem> = emptyList(),
    val promoCodes: List<PromoCodeItem> = emptyList(),
    val reviews: List<ProductReviewItem> = emptyList(),
    val staffMembers: List<StaffMemberItem> = emptyList(),
    val posCart: Map<String, Int> = emptyMap(),
    val lastScannedCode: String = "",

    // Mail State
    val selectedMailFolder: String = "Inbox",
    val selectedMailCategory: String = "All",
    val mailSearchQuery: String = "",
    val mailboxAddress: String = "",
    val emails: List<EmailMessage> = emptyList(),
    val selectedEmailId: String = "",

    // OneProfile State
    val selectedAnalyticsPeriod: String = "30D",
    val selectedProfileTheme: String = "Obsidian Emerald",
    val profileDisplayName: String = "",
    val profileRole: String = "",
    val profileBio: String = "",
    val profileLocation: String = "",
    val profileSlug: String = "",
    val profileViews: Int = 0,
    val profileWebsites: List<ProfileWebsiteItem> = emptyList(),
    val profileDomains: List<String> = emptyList(),

    // Notifications & Toast
    val notifications: List<NotificationItem> = emptyList(),
    val toastMessage: String? = null
)

class TiwloViewModel(application: Application) : AndroidViewModel(application) {
    private val api = TiwloApi(application)
    private val _uiState = MutableStateFlow(TiwloUiState())
    private var pendingSensitiveAction: (suspend (String) -> Unit)? = null
    val uiState: StateFlow<TiwloUiState> = _uiState.asStateFlow()

    init {
        restoreSession()
    }

    fun refreshSession() = restoreSession()

    fun consumeSsoCallback(uri: Uri?) {
        val fragmentParams = uri?.fragment?.let {
            Uri.parse("https://tiwlo.com/app/sso/callback?$it")
        }
        val challengeType = uri?.getQueryParameter("auth_challenge")
            ?: fragmentParams?.getQueryParameter("auth_challenge")
        val tempToken = uri?.getQueryParameter("temp_token")
            ?: fragmentParams?.getQueryParameter("temp_token")
        if (
            (challengeType == "2fa" || challengeType == "setup2fa") &&
            !tempToken.isNullOrBlank()
        ) {
            val message = uri?.getQueryParameter("message")
                ?: fragmentParams?.getQueryParameter("message")
                ?: "Enter the 6-digit code sent to your email."
            setAuthChallenge(
                JSONObject()
                    .put("tempToken", tempToken)
                    .put("message", message),
                challengeType
            )
            return
        }
        val ssoToken = uri?.getQueryParameter("sso_token")
            ?: fragmentParams?.getQueryParameter("sso_token")
            ?: uri?.getQueryParameter("token")
        val nonce = uri?.getQueryParameter("sso_nonce")
            ?: fragmentParams?.getQueryParameter("sso_nonce")
            ?: uri?.getQueryParameter("nonce")
        if (ssoToken.isNullOrBlank() || nonce.isNullOrBlank()) {
            refreshSession()
            return
        }
        viewModelScope.launch {
            try {
                val response = api.post(
                    "auth/sso/consume-handshake",
                    JSONObject().put("ssoToken", ssoToken).put("nonce", nonce)
                ).asJsonObject() ?: throw IllegalStateException("Tiwlo did not return an SSO response.")
                val user = response.optJSONObject("user")
                if (!response.optBoolean("authenticated") || user == null) {
                    throw IllegalStateException("Tiwlo could not verify this sign-in link.")
                }
                finishSignIn(user)
            } catch (error: Exception) {
                showApiError(error)
            }
        }
    }

    private fun restoreSession() {
        viewModelScope.launch {
            try {
                val response = api.get("auth/me").asJsonObject()
                val user = response?.optJSONObject("user")
                if (response?.optBoolean("authenticated") == true && user != null) {
                    acceptUser(user)
                    val verificationType = getRequiredVerificationType(user)
                    if (verificationType != null) {
                        showAccountVerification(verificationType)
                    } else {
                        _uiState.update {
                            it.copy(
                                currentScreen = AppScreen.CLOUD,
                                backStack = emptyList(),
                                authChallengeToken = null,
                                authChallengeType = null,
                                authChallengeMessage = null
                            )
                        }
                        loadWorkspace()
                    }
                } else {
                    api.clearSession()
                    _uiState.update { state ->
                        if (state.isAuthenticated) TiwloUiState() else state
                    }
                }
            } catch (error: Exception) {
                _uiState.update { it.copy(toastMessage = error.message ?: "Could not check the Tiwlo session.") }
            }
        }
    }

    fun signIn(email: String, password: String) {
        val identifier = email.trim()
        if (identifier.isEmpty() || password.isEmpty()) {
            _uiState.update { it.copy(toastMessage = "Enter your email and password.") }
            return
        }
        viewModelScope.launch {
            try {
                val response = api.post(
                    "auth/login",
                    JSONObject().put("identifier", identifier).put("password", password)
                ).asJsonObject() ?: throw IllegalStateException("The sign-in response was empty.")
                when {
                    response.optBoolean("requiresEmailVerification") ->
                        setAuthChallenge(response, "email")
                    response.optBoolean("requires2FASetup") ->
                        setAuthChallenge(response, "setup2fa")
                    response.optBoolean("requires2FA") ->
                        setAuthChallenge(response, "2fa")
                    else -> {
                        val user = response.optJSONObject("user")
                            ?: api.get("auth/me").asJsonObject()?.optJSONObject("user")
                            ?: throw IllegalStateException("Tiwlo did not return an authenticated account.")
                        finishSignIn(user)
                    }
                }
            } catch (error: Exception) {
                showApiError(error)
            }
        }
    }

    fun verifyAuthCode(code: String) {
        val state = _uiState.value
        val token = state.authChallengeToken
        val challenge = state.authChallengeType
        if (token.isNullOrBlank() || challenge.isNullOrBlank()) {
            _uiState.update { it.copy(toastMessage = "The verification session expired. Sign in again.") }
            return
        }
        val cleanCode = code.trim()
        if (!cleanCode.matches(Regex("\\d{6}"))) {
            _uiState.update { it.copy(toastMessage = "Enter the 6-digit code sent to your email.") }
            return
        }
        viewModelScope.launch {
            try {
                val endpoint = when (challenge) {
                    "email" -> "auth/verify-email"
                    "setup2fa" -> "auth/setup-2fa"
                    "2fa" -> "auth/verify-2fa"
                    else -> throw IllegalStateException("Unknown verification step.")
                }
                val response = api.post(
                    endpoint,
                    JSONObject().put("tempToken", token).put("otpCode", cleanCode)
                ).asJsonObject() ?: throw IllegalStateException("The verification response was empty.")
                if (challenge == "reauth") {
                    val grant = response.optString("grant")
                        .takeIf(String::isNotBlank)
                        ?: throw IllegalStateException("Tiwlo did not return a confirmation grant.")
                    val action = pendingSensitiveAction
                        ?: throw IllegalStateException("The sensitive action is no longer available.")
                    pendingSensitiveAction = null
                    _uiState.update {
                        it.copy(
                            authChallengeToken = null,
                            authChallengeType = null,
                            authChallengeMessage = null
                        )
                    }
                    action(grant)
                    return@launch
                }
                when {
                    response.optBoolean("requires2FASetup") ->
                        setAuthChallenge(response, "setup2fa")
                    response.optBoolean("requires2FA") ->
                        setAuthChallenge(response, "2fa")
                    response.optBoolean("authenticated") || response.optString("sessionToken").isNotBlank() -> {
                        val user = response.optJSONObject("user")
                            ?: api.get("auth/me").asJsonObject()?.optJSONObject("user")
                            ?: throw IllegalStateException("Tiwlo did not return an authenticated account.")
                        finishSignIn(user)
                    }
                    else -> throw IllegalStateException("Tiwlo did not complete verification.")
                }
            } catch (error: Exception) {
                showApiError(error)
            }
        }
    }

    fun dismissAuthChallenge() {
        if (_uiState.value.authChallengeType == "reauth") {
            pendingSensitiveAction = null
        }
        _uiState.update {
            it.copy(
                currentScreen = if (it.authChallengeType == "reauth") {
                    it.currentScreen
                } else {
                    AppScreen.LOGIN
                },
                backStack = if (it.authChallengeType == "reauth") it.backStack else emptyList(),
                authChallengeToken = null,
                authChallengeType = null,
                authChallengeMessage = null
            )
        }
    }

    private fun setAuthChallenge(response: JSONObject, type: String) {
        val token = response.optString("tempToken").takeIf(String::isNotBlank)
            ?: throw IllegalStateException("Tiwlo did not return a verification session.")
        _uiState.update {
            it.copy(
                authChallengeToken = token,
                authChallengeType = type,
                authChallengeMessage = response.optString("message").ifBlank {
                    "Enter the 6-digit code sent to your email."
                },
                currentScreen = if (type == "reauth") it.currentScreen else AppScreen.AUTH_VERIFICATION,
                backStack = if (type == "reauth" || it.currentScreen == AppScreen.AUTH_VERIFICATION) {
                    it.backStack
                } else {
                    if (it.backStack.lastOrNull() == it.currentScreen) it.backStack
                    else (it.backStack + it.currentScreen).takeLast(24)
                },
                toastMessage = null
            )
        }
    }

    private fun finishSignIn(user: JSONObject) {
        acceptUser(user)
        val verificationType = getRequiredVerificationType(user)
        if (verificationType != null) {
            showAccountVerification(verificationType)
            return
        }
        _uiState.update {
            it.copy(
                currentScreen = AppScreen.CLOUD,
                backStack = emptyList(),
                authChallengeToken = null,
                authChallengeType = null,
                authChallengeMessage = null,
                toastMessage = "Signed in as ${it.userName}"
            )
        }
        viewModelScope.launch { loadWorkspace() }
    }

    private fun getRequiredVerificationType(user: JSONObject): String? = when {
        user.optBoolean("identityVerificationRequired") && !user.optBoolean("identityVerified") ->
            "identity"
        !user.optBoolean("addressVerified") -> "address"
        else -> null
    }

    private fun showAccountVerification(type: String) {
        val message = if (type == "identity") {
            "Identity verification is required for this account. Continue securely on tiwlo.com, then return here."
        } else {
            "Address verification is required for this account. Continue securely on tiwlo.com, then return here."
        }
        _uiState.update {
            it.copy(
                currentScreen = AppScreen.AUTH_VERIFICATION,
                backStack = if (it.currentScreen == AppScreen.AUTH_VERIFICATION) it.backStack
                else (it.backStack + it.currentScreen).takeLast(24),
                authChallengeToken = null,
                authChallengeType = type,
                authChallengeMessage = message,
                toastMessage = null
            )
        }
    }

    private fun acceptUser(user: JSONObject) {
        _uiState.update {
            it.copy(
                isAuthenticated = true,
                accountVerified = user.optBoolean("emailVerified", true) && user.optBoolean("addressVerified"),
                userName = user.optString("name").ifBlank { user.optString("storeName") },
                userEmail = user.optString("email")
            )
        }
    }

    fun signOut() {
        viewModelScope.launch {
            var logoutError: Exception? = null
            try {
                api.post("auth/logout")
            } catch (error: Exception) {
                logoutError = error
            }
            try {
                api.clearSession()
            } catch (error: Exception) {
                showApiError(error)
                return@launch
            }
            _uiState.value = TiwloUiState(
                toastMessage = logoutError?.let {
                    "Signed out on this device, but server sign-out could not be confirmed: ${it.message}"
                } ?: "Signed out of Tiwlo"
            )
        }
    }

    private suspend fun loadWorkspace() {
        val cloud = api.get("cloud/dashboard").asJsonObject()
        val droplets = cloud?.optJSONArray("droplets")?.toDroplets().orEmpty()
        val cloudMetrics = cloud?.optJSONObject("metrics")?.let { metrics ->
            listOf("totalDroplets", "totalVcpus", "totalStorage", "totalBandwidth", "cpuUsed", "memoryUsed", "storageUsed", "bandwidthUsed")
                .associateWith { key ->
                    if (metrics.isNull(key)) "Unavailable" else metrics.optString(key, "Unavailable")
                }
        }.orEmpty()
        val activities = cloud?.optJSONArray("activities")?.toNotifications().orEmpty()
        val billingAccount = try {
            api.get("cloud/billing").asJsonObject()?.optJSONObject("account")
        } catch (error: Exception) {
            _uiState.update {
                it.copy(toastMessage = error.message ?: "Could not load cloud billing information.")
            }
            null
        }
        val credits = billingAccount?.optDouble("credits", Double.NaN) ?: Double.NaN
        val billingCreditBalance = if (credits.isFinite()) {
            "${billingAccount?.optString("currency").orEmpty().ifBlank { "USD" }} ${"%,.2f".format(credits)}"
        } else {
            "Unavailable"
        }
        val billingGatewayStatus = billingAccount?.optString("paymentGatewayStatusMessage")
            ?.takeIf(String::isNotBlank) ?: "Unavailable"
        val domainsResponse = api.get("domains").asJsonObject()
        val domains = domainsResponse?.optJSONArray("domains").toDomains()
        val stores = (api.get("stores").asJsonArray() ?: JSONArray()).toStores()
        val activeStoreId = stores.firstOrNull()?.id.orEmpty()
        if (activeStoreId.isNotBlank()) {
            api.post("stores/active", JSONObject().put("tiwiId", activeStoreId))
            val storeData = loadActiveStoreData()
            val settings = api.get("store/settings").asJsonObject()
            _uiState.update {
                it.copy(
                    stores = stores,
                    activeStoreId = activeStoreId,
                    products = storeData.products,
                    categories = storeData.categories,
                    orders = storeData.orders,
                    purchaseOrders = storeData.purchases,
                    suppliers = storeData.suppliers,
                    customers = storeData.customers,
                    reviews = storeData.reviews,
                    staffMembers = storeData.staff,
                    storeSettings = settings?.toStoreSettings().orEmpty(),
                    promoCodes = settings.toPromoCodes(storeData.orders)
                )
            }
        } else {
            _uiState.update { it.copy(stores = emptyList(), activeStoreId = "") }
        }
        val profile = api.get("oneprofile/summary").asJsonObject()
        val profileData = profile?.optJSONObject("profile")
        val profileMetrics = profile?.optJSONObject("metrics")
        val websites = profile?.optJSONArray("websites")?.objects()?.map { website ->
            ProfileWebsiteItem(
                title = website.value("title", "domain") ?: "Profile website",
                domain = website.value("domain") ?: "",
                views = website.optInt("view_count", website.optInt("viewCount", 0))
            )
        }.orEmpty()
        val profileDomains = profile?.optJSONArray("domains")?.objects()?.mapNotNull { domain ->
            domain.value("subdomain", "domain")?.takeIf(String::isNotBlank)
        }.orEmpty()
        _uiState.update {
            it.copy(
                droplets = droplets,
                cloudMetrics = cloudMetrics,
                billingCreditBalance = billingCreditBalance,
                billingGatewayStatus = billingGatewayStatus,
                domains = domains,
                notifications = activities + profile?.optJSONArray("notifications").toNotifications().orEmpty(),
                profileRole = profileData?.optString("headline").orEmpty().ifBlank { it.profileRole },
                profileBio = profileData?.optString("bio").orEmpty().ifBlank { it.profileBio },
                profileDisplayName = it.userName,
                profileSlug = profileData?.optString("public_slug").orEmpty(),
                profileViews = profileMetrics?.optInt("views", 0) ?: 0,
                profileWebsites = websites,
                profileDomains = profileDomains
            )
        }
        loadMail()
    }

    private data class StoreData(
        val products: List<ProductItem>,
        val categories: List<StoreCategory>,
        val orders: List<OrderItem>,
        val purchases: List<PurchaseOrderItem>,
        val suppliers: List<SupplierItem>,
        val customers: List<CustomerItem>,
        val reviews: List<ProductReviewItem>,
        val staff: List<StaffMemberItem>
    )

    private suspend fun loadActiveStoreData(): StoreData {
        val products = (api.get("products").asJsonArray() ?: JSONArray()).toProducts()
        val categories = (api.get("categories").asJsonArray() ?: JSONArray()).toCategories()
        val sales = (api.get("sales").asJsonArray() ?: JSONArray()).toOrders()
        val purchases = (api.get("purchases").asJsonArray() ?: JSONArray()).toPurchases()
        val suppliers = (api.get("suppliers").asJsonArray() ?: JSONArray()).toSuppliers()
        val customers = (api.get("customers").asJsonArray() ?: JSONArray()).toCustomers()
        val reviewsResponse = api.get("reviews")
        val reviews = (reviewsResponse.asJsonObject()?.optJSONArray("reviews")
            ?: reviewsResponse.asJsonArray() ?: JSONArray()).toReviews()
        val staffResponse = api.get("staff")
        val staff = (staffResponse.asJsonObject()?.optJSONArray("staff")
            ?: staffResponse.asJsonArray() ?: JSONArray()).toStaff()
        return StoreData(products, categories, sales, purchases, suppliers, customers, reviews, staff)
    }

    private suspend fun loadMail() {
        try {
            val mailbox = api.get("email/mailbox").asJsonObject()
            val mailboxAddress = mailbox?.optJSONObject("mailbox")
                ?.optString("address").orEmpty()
            if (mailboxAddress.isBlank()) {
                _uiState.update { it.copy(mailboxAddress = "", emails = emptyList()) }
                return
            }
            val state = _uiState.value
            val folder = when (state.selectedMailFolder.lowercase()) {
                "starred" -> "flagged"
                "all mail" -> "inbox"
                else -> state.selectedMailFolder.lowercase()
            }
            val query = buildString {
                append("email/messages?folder=${folder.toApiPathSegment()}&tab=all")
                val searchTerms = buildList {
                    if (!state.selectedMailCategory.equals("All", true)) {
                        add("category:${state.selectedMailCategory}")
                    }
                    if (state.mailSearchQuery.isNotBlank()) add(state.mailSearchQuery)
                }
                if (searchTerms.isNotEmpty()) append("&q=${searchTerms.joinToString(" ").toApiPathSegment()}")
            }
            val folders = if (state.selectedMailFolder.equals("All Mail", true)) {
                listOf("inbox", "sent", "drafts", "junk", "trash", "archive")
                    .flatMap { item ->
                        val part = api.get(query.replace("folder=inbox", "folder=$item")).asJsonObject()
                        part?.optJSONArray("emails").toEmails()
                    }.distinctBy { it.id }
            } else {
                api.get(query).asJsonObject()?.optJSONArray("emails").toEmails()
            }
            _uiState.update {
                it.copy(mailboxAddress = mailboxAddress, emails = folders)
            }
        } catch (error: Exception) {
            _uiState.update { it.copy(toastMessage = error.message ?: "Could not load Tiwlo Mail.") }
        }
    }

    private fun showApiError(error: Exception) {
        val apiError = error as? TiwloApiException
        val body = apiError?.responseBody.asJsonObject()
        val banned = body?.optBoolean("isBanned") == true
        val identityRequired = body?.optString("code") == "IDENTITY_VERIFICATION_REQUIRED"
        val addressRequired = body?.optString("code") == "ADDRESS_VERIFICATION_REQUIRED"
        val message = when {
            banned -> body?.optString("error") ?: "This Tiwlo account is suspended."
            else -> error.message ?: "The Tiwlo API request failed."
        }
        _uiState.update { it.copy(toastMessage = message) }
        when {
            identityRequired -> showAccountVerification("identity")
            addressRequired -> showAccountVerification("address")
        }
    }

    fun openPendingVerification() {
        val path = when (_uiState.value.authChallengeType) {
            "identity" -> "verification"
            "address" -> "address-verification"
            else -> return
        }
        openVerificationInBrowser(path)
    }

    private fun openVerificationInBrowser(path: String) {
        val intent = android.content.Intent(
            android.content.Intent.ACTION_VIEW,
            android.net.Uri.parse("https://tiwlo.com/$path")
        ).addFlags(android.content.Intent.FLAG_ACTIVITY_NEW_TASK)
        getApplication<Application>().startActivity(intent)
    }

    private fun requestSensitiveAction(action: suspend (String) -> Unit) {
        viewModelScope.launch {
            try {
                val response = api.post("auth/reauth/request").asJsonObject()
                    ?: throw IllegalStateException("Tiwlo did not return a verification challenge.")
                pendingSensitiveAction = action
                setAuthChallenge(response, "reauth")
            } catch (error: Exception) {
                showApiError(error)
            }
        }
    }

    fun navigateTo(screen: AppScreen) {
        _uiState.update { state ->
            if (state.currentScreen == screen) {
                state
            } else {
                state.copy(
                    backStack = (state.backStack + state.currentScreen).takeLast(24),
                    currentScreen = screen
                )
            }
        }
    }

    fun navigateBack() {
        _uiState.update { state ->
            if (state.backStack.isNotEmpty()) {
                val previous = state.backStack.last()
                state.copy(
                    currentScreen = previous,
                    backStack = state.backStack.dropLast(1)
                )
            } else if (state.isAuthenticated && state.currentScreen != AppScreen.CLOUD) {
                state.copy(currentScreen = AppScreen.CLOUD)
            } else {
                state
            }
        }
    }

    fun submitAuth(mode: AppScreen, name: String, email: String, password: String) {
        if (mode == AppScreen.LOGIN) {
            signIn(email, password)
        } else {
            _uiState.update {
                it.copy(toastMessage = "Create your account on tiwlo.com to complete the required address and email verification steps.")
            }
            openVerificationInBrowser("create-account")
        }
    }

    fun openSocialSignIn(provider: String) {
        if (provider != "google" && provider != "github") {
            _uiState.update { it.copy(toastMessage = "This sign-in provider is not supported.") }
            return
        }
        val signInUri = Uri.parse("https://tiwlo.com/api/auth/$provider")
            .buildUpon()
            .appendQueryParameter("return_to", "tiwlo://auth/callback")
            .build()
        val intent = android.content.Intent(android.content.Intent.ACTION_VIEW, signInUri)
            .addFlags(android.content.Intent.FLAG_ACTIVITY_NEW_TASK)
        getApplication<Application>().startActivity(intent)
    }

    // Stores Hub & Separate Store Admin Navigation
    fun openCreateStorePage() = navigateTo(AppScreen.CREATE_STORE)

    fun enterStoreDashboard(storeId: String) {
        val store = _uiState.value.stores.firstOrNull { it.id == storeId }
        if (store == null) {
            _uiState.update { it.copy(toastMessage = "That store is not available in your account.") }
            return
        }
        viewModelScope.launch {
            try {
                api.post("stores/active", JSONObject().put("tiwiId", store.id))
                val data = loadActiveStoreData()
                val settings = api.get("store/settings").asJsonObject()
                val storeSettings = settings?.toStoreSettings().orEmpty()
                _uiState.update { state ->
                    state.copy(
                        activeStoreId = store.id,
                        products = data.products,
                        categories = data.categories,
                        orders = data.orders,
                        purchaseOrders = data.purchases,
                        suppliers = data.suppliers,
                        customers = data.customers,
                        reviews = data.reviews,
                        staffMembers = data.staff,
                        storeSettings = storeSettings,
                        promoCodes = settings.toPromoCodes(data.orders),
                        backStack = (state.backStack + state.currentScreen).takeLast(24),
                        currentScreen = AppScreen.ECOMMERCE,
                        toastMessage = "Switched to ${store.name} Store Admin"
                    )
                }
            } catch (error: Exception) {
                showApiError(error)
            }
        }
    }

    fun switchToMainDashboard() {
        _uiState.update { state ->
            state.copy(
                currentScreen = AppScreen.CLOUD,
                backStack = emptyList(),
                toastMessage = "Switched back to Main Cloud Console"
            )
        }
    }

    fun createNewStore(name: String, slug: String, category: String, currency: String) {
        val cleanName = name.trim()
        val cleanSlug = slug.trim().lowercase().replace(" ", "-")
        if (cleanName.isBlank() || cleanSlug.isBlank() || category.isBlank()) {
            _uiState.update { it.copy(toastMessage = "Enter a store name, subdomain, and category.") }
            return
        }
        viewModelScope.launch {
            try {
                val store = api.post(
                    "stores",
                    JSONObject()
                        .put("storeName", cleanName)
                        .put("subdomain", cleanSlug)
                        .put("category", category)
                        .put("currency", currency)
                ).asJsonObject() ?: throw IllegalStateException("Tiwlo did not return the created store.")
                val created = store.toStore()
                api.post("stores/active", JSONObject().put("tiwiId", created.id))
                val stores = (api.get("stores").asJsonArray() ?: JSONArray()).toStores()
                val data = loadActiveStoreData()
                val settings = api.get("store/settings").asJsonObject()
                val storeSettings = settings?.toStoreSettings().orEmpty()
                _uiState.update {
                    it.copy(
                        stores = stores,
                        activeStoreId = created.id,
                        products = data.products,
                        categories = data.categories,
                        orders = data.orders,
                        purchaseOrders = data.purchases,
                        suppliers = data.suppliers,
                        customers = data.customers,
                        reviews = data.reviews,
                        staffMembers = data.staff,
                        storeSettings = storeSettings,
                        promoCodes = settings.toPromoCodes(data.orders),
                        currentScreen = AppScreen.ECOMMERCE,
                        backStack = listOf(AppScreen.CLOUD, AppScreen.STORES_HUB),
                        toastMessage = "Store '${created.name}' created."
                    )
                }
            } catch (error: Exception) {
                showApiError(error)
            }
        }
    }

    // Cloud Actions
    fun selectWorkloadPeriod(period: String) {
        _uiState.update { it.copy(selectedWorkloadPeriod = period) }
    }

    fun openCreateDropletPage() = navigateTo(AppScreen.CLOUD_CREATE_DROPLET)
    fun openTPanelPage() = navigateTo(AppScreen.CLOUD_TPANEL)

    fun createDroplet(
        name: String,
        region: String,
        flag: String,
        image: String,
        vcpu: Int,
        ramGb: Int,
        diskGb: Int,
        priceMo: Int
    ) {
        val cleanName = name.trim()
        if (cleanName.isBlank()) {
            _uiState.update { it.copy(toastMessage = "Enter a droplet name.") }
            return
        }
        viewModelScope.launch {
            try {
                api.post(
                    "cloud/droplets",
                    JSONObject()
                        .put("name", cleanName)
                        .put("region", region)
                        .put("image", image)
                        .put("vcpus", vcpu)
                        .put("memory", ramGb)
                        .put("storage", diskGb)
                        .put("priceMonthly", priceMo)
                )
                val response = api.get("cloud/droplets").asJsonArray()
                _uiState.update {
                    it.copy(
                        droplets = response.toDroplets(),
                        currentScreen = AppScreen.CLOUD_DROPLETS,
                        toastMessage = "Droplet request completed."
                    )
                }
            } catch (error: Exception) {
                showApiError(error)
            }
        }
    }

    fun toggleDropletPower(dropletId: String) {
        val droplet = _uiState.value.droplets.firstOrNull { it.id == dropletId }
        if (droplet == null) {
            _uiState.update { it.copy(toastMessage = "Droplet is not available.") }
            return
        }
        val nextStatus = if (droplet.status.equals("Running", true)) "stopped" else "active"
        viewModelScope.launch {
            try {
                api.patch(
                    "cloud/droplets/${dropletId.toApiPathSegment()}/status",
                    JSONObject().put("status", nextStatus)
                )
                val refreshed = (api.get("cloud/droplets").asJsonArray() ?: JSONArray()).toDroplets()
                _uiState.update { it.copy(droplets = refreshed, toastMessage = "Droplet status updated.") }
            } catch (error: Exception) {
                showApiError(error)
            }
        }
    }

    fun addDomain(domainName: String, targetIp: String) {
        val cleanDomain = domainName.trim().lowercase()
        if (cleanDomain.isBlank()) {
            _uiState.update { it.copy(toastMessage = "Enter a domain name.") }
            return
        }
        requestSensitiveAction { grant ->
            try {
                val createdResponse = api.post(
                    "domains",
                    JSONObject().put("domain", cleanDomain),
                    mapOf("x-tiwlo-reauth-grant" to grant)
                ).asJsonObject()
                val domainsResponse = api.get("domains").asJsonObject()
                val domains = domainsResponse?.optJSONArray("domains").toDomains()
                val instructions = createdResponse?.optString("instructions").orEmpty()
                val targetNote = targetIp.trim().takeIf(String::isNotBlank)
                    ?.let { " The API does not save target IPs; configure $it in your DNS records." }
                    .orEmpty()
                _uiState.update {
                    it.copy(
                        domains = domains,
                        toastMessage = listOf(instructions, targetNote.trim())
                            .filter(String::isNotBlank)
                            .joinToString(" ")
                            .ifBlank { "Domain added. Follow the DNS instructions from Tiwlo." }
                    )
                }
            } catch (error: Exception) {
                showApiError(error)
            }
        }
    }

    fun addVolume(name: String, sizeGb: Int, dropletName: String) {
        _uiState.update { it.copy(toastMessage = "Volume management is not available in the Tiwlo API yet.") }
    }

    // Store Admin Actions
    fun selectStockPeriod(period: String) {
        _uiState.update { it.copy(selectedStockPeriod = period) }
    }

    fun openCreateProductPage() = navigateTo(AppScreen.STORE_CREATE_PRODUCT)
    fun openCategoriesPage() = navigateTo(AppScreen.STORE_CATEGORIES)
    fun openPosPage() = navigateTo(AppScreen.STORE_POS)

    fun addProduct(
        name: String,
        sku: String,
        category: String,
        priceBdt: Int,
        stock: Int
    ) {
        val cleanName = name.trim()
        if (cleanName.isBlank() || sku.trim().isBlank() || priceBdt < 0 || stock < 0) {
            _uiState.update {
                it.copy(toastMessage = "Enter a product name, SKU, non-negative price, and stock quantity.")
            }
            return
        }
        viewModelScope.launch {
            try {
                api.post(
                    "products",
                    JSONObject()
                        .put("name", cleanName)
                        .put("sku", sku.trim())
                        .put("category", category)
                        .put("price", priceBdt)
                        .put("stock", stock)
                )
                val data = loadActiveStoreData()
                _uiState.update {
                    it.copy(
                        products = data.products,
                        categories = data.categories,
                        orders = data.orders,
                        purchaseOrders = data.purchases,
                        suppliers = data.suppliers,
                        customers = data.customers,
                        reviews = data.reviews,
                        staffMembers = data.staff,
                        currentScreen = AppScreen.STORE_PRODUCTS,
                        toastMessage = "Product '$cleanName' added."
                    )
                }
            } catch (error: Exception) {
                showApiError(error)
            }
        }
    }

    fun addCategory(name: String, slug: String, subCategories: List<String>) {
        val cleanName = name.trim()
        if (cleanName.isBlank()) {
            _uiState.update { it.copy(toastMessage = "Enter a category name.") }
            return
        }
        viewModelScope.launch {
            try {
                api.post("categories", JSONObject().put("name", cleanName))
                subCategories.map(String::trim).filter(String::isNotBlank).forEach { subCategory ->
                    api.post(
                        "subcategories",
                        JSONObject().put("categoryName", cleanName).put("name", subCategory)
                    )
                }
                val data = loadActiveStoreData()
                _uiState.update {
                    it.copy(
                        categories = data.categories,
                        products = data.products,
                        toastMessage = "Category '$cleanName' created."
                    )
                }
            } catch (error: Exception) {
                showApiError(error)
            }
        }
    }

    fun addSubCategory(categoryId: String, subCategoryName: String) {
        val cleanSub = subCategoryName.trim()
        val category = _uiState.value.categories.firstOrNull { it.id == categoryId }
        if (cleanSub.isEmpty() || category == null) {
            _uiState.update { it.copy(toastMessage = "Choose a category and enter a subcategory name.") }
            return
        }
        viewModelScope.launch {
            try {
                api.post(
                    "subcategories",
                    JSONObject().put("categoryId", category.id).put("categoryName", category.name).put("name", cleanSub)
                )
                val categories = (api.get("categories").asJsonArray() ?: JSONArray()).toCategories()
                _uiState.update {
                    it.copy(categories = categories, toastMessage = "Subcategory '$cleanSub' added.")
                }
            } catch (error: Exception) {
                showApiError(error)
            }
        }
    }

    fun addToPosCart(productId: String) {
        _uiState.update { state ->
            val currentQty = state.posCart[productId] ?: 0
            state.copy(posCart = state.posCart + (productId to (currentQty + 1)))
        }
    }

    fun removeFromPosCart(productId: String) {
        _uiState.update { state ->
            val currentQty = state.posCart[productId] ?: 0
            val nextMap = if (currentQty <= 1) {
                state.posCart - productId
            } else {
                state.posCart + (productId to (currentQty - 1))
            }
            state.copy(posCart = nextMap)
        }
    }

    fun clearPosCart() {
        _uiState.update { it.copy(posCart = emptyMap()) }
    }

    fun scanProductCode(skuOrCode: String) {
        _uiState.update { state ->
            val matched = state.products.firstOrNull {
                it.sku.equals(skuOrCode.trim(), ignoreCase = true) ||
                    it.name.contains(skuOrCode.trim(), ignoreCase = true)
            }
            if (matched == null) {
                return@update state.copy(toastMessage = "No matching product was found.")
            }
            val currentQty = state.posCart[matched.id] ?: 0
            state.copy(
                lastScannedCode = "${matched.sku} · ${matched.name} (৳${matched.priceBdt})",
                posCart = state.posCart + (matched.id to (currentQty + 1)),
                toastMessage = "Scanned ${matched.sku}: added '${matched.name}' to POS cart"
            )
        }
    }

    fun checkoutPosOrder(customerName: String, paymentMethod: String) {
        val state = _uiState.value
        if (state.posCart.isEmpty()) {
            _uiState.update { it.copy(toastMessage = "POS cart is empty.") }
            return
        }
        if (paymentMethod.isBlank()) {
            _uiState.update { it.copy(toastMessage = "Choose a payment method.") }
            return
        }
        viewModelScope.launch {
            try {
                val items = JSONArray()
                state.posCart.forEach { (productId, quantity) ->
                    items.put(JSONObject().put("productId", productId).put("quantity", quantity))
                }
                api.post(
                    "sales",
                    JSONObject()
                        .put("customerName", customerName.trim().ifBlank { "Walk-in Customer" })
                        .put("items", items)
                        .put("paymentMethod", paymentMethod)
                )
                val updated = loadActiveStoreData()
                _uiState.update {
                    it.copy(
                        orders = updated.orders,
                        products = updated.products,
                        posCart = emptyMap(),
                        currentScreen = AppScreen.STORE_ORDERS,
                        toastMessage = "POS sale recorded."
                    )
                }
            } catch (error: Exception) {
                showApiError(error)
            }
        }
    }

    fun advanceOrderStatus(orderId: String) {
        val order = _uiState.value.orders.firstOrNull { it.id == orderId }
        if (order == null) {
            _uiState.update { it.copy(toastMessage = "Order is not available.") }
            return
        }
        if (!order.channel.equals("storefront", ignoreCase = true)) {
            _uiState.update {
                it.copy(toastMessage = "The current API does not support status changes for this order type.")
            }
            return
        }
        val nextStatus = when (order.status) {
            "Pending" -> "Processing"
            "Confirmed" -> "Processing"
            "Shipped", "Out for Delivery" -> "Delivered"
            "Processing" -> {
                _uiState.update {
                    it.copy(toastMessage = "Add courier and tracking details on tiwlo.com before marking this order shipped.")
                }
                return
            }
            else -> {
                _uiState.update { it.copy(toastMessage = "This order has no supported next status.") }
                return
            }
        }
        viewModelScope.launch {
            try {
                api.patch(
                    "sales/${orderId.toApiPathSegment()}",
                    JSONObject().put("status", nextStatus)
                )
                val updated = (api.get("sales").asJsonArray() ?: JSONArray()).toOrders()
                _uiState.update { it.copy(orders = updated, toastMessage = "Order status updated.") }
            } catch (error: Exception) {
                showApiError(error)
            }
        }
    }

    fun restockProduct(productId: String, addQty: Int = 20) {
        if (addQty <= 0) {
            _uiState.update { it.copy(toastMessage = "Restock quantity must be greater than zero.") }
            return
        }
        viewModelScope.launch {
            try {
                api.post(
                    "inventory/adjustments",
                    JSONObject()
                        .put("productId", productId)
                        .put("type", "Add")
                        .put("quantity", addQty)
                        .put("reason", "Inventory restock")
                        .put("adjustedBy", _uiState.value.userName)
                )
                val products = (api.get("products").asJsonArray() ?: JSONArray()).toProducts()
                _uiState.update { it.copy(products = products, toastMessage = "Inventory updated.") }
            } catch (error: Exception) {
                showApiError(error)
            }
        }
    }

    fun addPromoCode(code: String, discount: String) {
        val normalizedCode = code.trim().uppercase()
        val percentage = Regex("\\d+(?:\\.\\d+)?").find(discount)?.value?.toDoubleOrNull()
        if (!normalizedCode.matches(Regex("[A-Z0-9_-]{1,32}")) || percentage == null || percentage <= 0.0 || percentage > 100.0) {
            _uiState.update { it.copy(toastMessage = "Enter a valid code and discount percentage.") }
            return
        }
        viewModelScope.launch {
            try {
                api.put(
                    "store/settings",
                    JSONObject()
                        .put("promoCode", normalizedCode)
                        .put("promoDiscountPercent", percentage)
                        .put("promoActive", true)
                )
                val settings = api.get("store/settings").asJsonObject()
                    ?: throw IllegalStateException("Tiwlo did not return store settings.")
                _uiState.update {
                    it.copy(
                        storeSettings = settings.toStoreSettings(),
                        promoCodes = listOf(
                            PromoCodeItem(
                                id = normalizedCode,
                                code = normalizedCode,
                                discount = "${percentage}% OFF",
                                uses = _uiState.value.orders.count {
                                    it.promoCode.equals(normalizedCode, ignoreCase = true)
                                },
                                status = "Active"
                            )
                        ),
                        toastMessage = "Store promotion updated."
                    )
                }
            } catch (error: Exception) {
                showApiError(error)
            }
        }
    }

    // Mail Actions
    fun selectMailFolder(folder: String) {
        _uiState.update { it.copy(selectedMailFolder = folder) }
        viewModelScope.launch { loadMail() }
    }

    fun selectMailCategory(category: String) {
        _uiState.update { it.copy(selectedMailCategory = category) }
        viewModelScope.launch { loadMail() }
    }

    fun updateMailSearchQuery(query: String) {
        _uiState.update { it.copy(mailSearchQuery = query) }
        viewModelScope.launch { loadMail() }
    }

    fun selectEmail(emailId: String) {
        viewModelScope.launch {
            try {
                val response = api.get("email/messages/${emailId.toApiPathSegment()}").asJsonObject()
                val email = response?.optJSONObject("email")?.toEmail()
                _uiState.update { state ->
                    state.copy(
                        selectedEmailId = emailId,
                        emails = if (email == null) state.emails else state.emails.map {
                            if (it.id == emailId) email else it
                        }
                    )
                }
            } catch (error: Exception) {
                showApiError(error)
            }
        }
    }

    fun toggleEmailStar(emailId: String) {
        viewModelScope.launch {
            try {
                api.post("email/toggle-flag", JSONObject().put("id", emailId))
                loadMail()
            } catch (error: Exception) {
                showApiError(error)
            }
        }
    }

    fun deleteEmail(emailId: String) {
        viewModelScope.launch {
            try {
                api.post("email/delete", JSONObject().put("id", emailId))
                _uiState.update { it.copy(selectedEmailId = "") }
                loadMail()
            } catch (error: Exception) {
                showApiError(error)
            }
        }
    }

    fun openComposeEmailPage() = navigateTo(AppScreen.EMAIL_COMPOSE)

    fun sendNewEmail(to: String, subject: String, body: String) {
        if (to.isBlank() || subject.isBlank()) {
            _uiState.update { it.copy(toastMessage = "Enter a recipient and subject.") }
            return
        }
        viewModelScope.launch {
            try {
                api.post(
                    "email/send",
                    JSONObject().put("to", to.trim()).put("subject", subject.trim()).put("body", body)
                )
                _uiState.update {
                    it.copy(
                        selectedMailFolder = "Sent",
                        selectedEmailId = "",
                        currentScreen = AppScreen.EMAIL,
                        toastMessage = "Email sent."
                    )
                }
                loadMail()
            } catch (error: Exception) {
                showApiError(error)
            }
        }
    }

    // OneProfile Actions
    fun selectAnalyticsPeriod(period: String) {
        _uiState.update { it.copy(selectedAnalyticsPeriod = period) }
    }

    fun selectProfileTheme(theme: String) {
        _uiState.update { it.copy(toastMessage = "OneProfile theme updates are not available in the Tiwlo API yet.") }
    }

    fun openEditProfilePage() = navigateTo(AppScreen.ONEPROFILE_EDIT)

    fun saveProfileChanges(
        displayName: String,
        role: String,
        bio: String,
        location: String
    ) {
        viewModelScope.launch {
            try {
                val userResponse = api.put(
                    "auth/profile",
                    JSONObject().put("name", displayName.trim())
                ).asJsonObject()
                val profileResponse = api.put(
                    "oneprofile/profile",
                    JSONObject().put("headline", role.trim()).put("bio", bio.trim())
                ).asJsonObject()
                if (profileResponse?.optBoolean("success") != true) {
                    throw IllegalStateException("Tiwlo did not save the OneProfile changes.")
                }
                val savedName = userResponse?.optJSONObject("user")?.optString("name")
                    ?.takeIf(String::isNotBlank) ?: displayName.trim()
                _uiState.update {
                    it.copy(
                        profileDisplayName = savedName,
                        userName = savedName,
                        profileRole = role.trim(),
                        profileBio = bio.trim(),
                        currentScreen = AppScreen.ONEPROFILE,
                        toastMessage = if (location.isNotBlank()) {
                            "Profile saved; location changes are not supported by the current API."
                        } else {
                            "OneProfile changes saved."
                        }
                    )
                }
            } catch (error: Exception) {
                showApiError(error)
            }
        }
    }

    // Notifications & Toast
    fun markAllNotificationsRead() {
        _uiState.update { it.copy(toastMessage = "Notification read actions are not available in the Tiwlo API yet.") }
    }

    fun markNotificationRead(id: String) {
        _uiState.update { it.copy(toastMessage = "Notification read actions are not available in the Tiwlo API yet.") }
    }

    fun showToast(message: String) {
        _uiState.update { it.copy(toastMessage = message) }
    }

    fun clearToast() {
        _uiState.update { it.copy(toastMessage = null) }
    }
}

private fun JSONArray?.toNotifications(): List<NotificationItem> =
    this?.objects()?.map { item ->
        NotificationItem(
            id = item.value("id", "eventId") ?: "",
            title = item.value("title", "action", "type") ?: "",
            desc = item.value("body", "description", "details") ?: "",
            time = item.value("createdAt", "created_at", "time") ?: "",
            unread = item.optBoolean("unread", item.isNull("read_at"))
        )
    }.orEmpty()

private fun JSONArray?.toStores(): List<StoreInstance> =
    this?.objects()?.map { item ->
        val tiwiId = item.value("tiwiId", "storeId", "id") ?: ""
        val subdomain = item.value("subdomain", "domain") ?: ""
        StoreInstance(
            id = tiwiId,
            name = item.value("storeName", "name") ?: "",
            domain = subdomain,
            category = item.value("category") ?: "",
            currency = item.value("currency") ?: "",
            productsCount = item.optInt("productsCount", 0),
            ordersCount = item.optInt("ordersCount", 0),
            revenueLabel = item.value("revenueLabel") ?: "",
            status = item.value("status") ?: ""
        )
    }.orEmpty().filter { it.id.isNotBlank() }

private fun JSONObject.toStore(): StoreInstance {
    val tiwiId = value("tiwiId", "storeId", "id").orEmpty()
    return StoreInstance(
        id = tiwiId,
        name = value("storeName", "name").orEmpty(),
        domain = value("subdomain", "domain").orEmpty(),
        category = value("category").orEmpty(),
        currency = value("currency").orEmpty(),
        productsCount = optInt("productsCount", 0),
        ordersCount = optInt("ordersCount", 0),
        revenueLabel = value("revenueLabel").orEmpty(),
        status = value("status").orEmpty()
    )
}

private fun JSONObject.toStoreSettings(): Map<String, String> {
    val keys = listOf(
        "storeName",
        "subdomain",
        "storeTagline",
        "activeTheme",
        "themeColor",
        "themeMode",
        "currency",
        "currencySymbol",
        "contactEmail",
        "contactPhone",
        "storeAddress",
        "storeCity",
        "storeCountry",
        "taxRate",
        "shippingFlatRate",
        "freeShippingThreshold",
        "promoActive",
        "promoCode",
        "promoDiscountPercent"
    )
    return keys.mapNotNull { key ->
        if (!has(key) || isNull(key)) null else key to optString(key)
    }.toMap()
}

private fun JSONObject?.toPromoCodes(orders: List<OrderItem>): List<PromoCodeItem> {
    val code = this?.optString("promoCode").orEmpty()
    if (code.isBlank()) return emptyList()
    val discountPercent = this?.optDouble("promoDiscountPercent", 0.0) ?: 0.0
    return listOf(
        PromoCodeItem(
            id = code,
            code = code,
            discount = "${discountPercent}% OFF",
            uses = orders.count { it.promoCode.equals(code, ignoreCase = true) },
            status = if (this?.optBoolean("promoActive") == true) "Active" else "Inactive"
        )
    )
}

private fun JSONArray?.toDomains(): List<DomainRecordItem> =
    this?.objects()?.map { item ->
        DomainRecordItem(
            id = item.value("id") ?: "",
            domain = item.value("domain") ?: "",
            targetIp = item.value("targetIp", "ipAddress") ?: "",
            sslStatus = item.value("sslStatus", "status") ?: "",
            recordsCount = item.optInt("recordsCount", 0)
        )
    }.orEmpty()

private fun JSONArray?.toDroplets(): List<DropletItem> =
    this?.objects()?.map { item ->
        val region = item.value("region", "regionCode") ?: ""
        DropletItem(
            id = item.value("id") ?: "",
            name = item.value("name") ?: "",
            ip = item.value("ip", "ipAddress") ?: "",
            region = region,
            flag = "",
            image = item.value("image", "os", "imageName") ?: "",
            vcpu = item.optInt("vcpus", item.optInt("vcpu", 0)),
            ramGb = item.optInt("memory", item.optInt("ramGb", 0)),
            diskGb = item.optInt("storage", item.optInt("diskGb", 0)),
            priceMo = item.optInt("priceMonthly", item.optInt("priceMo", 0)),
            status = item.value("status") ?: "",
            cpuPercent = if (item.has("cpuPercent") && !item.isNull("cpuPercent")) {
                item.optInt("cpuPercent")
            } else {
                null
            }
        )
    }.orEmpty()

private fun JSONArray?.toProducts(): List<ProductItem> =
    this?.objects()?.map { item ->
        ProductItem(
            id = item.value("id") ?: "",
            name = item.value("name") ?: "",
            sku = item.value("sku") ?: "",
            category = item.value("category") ?: "",
            priceBdt = item.optInt("price", item.optInt("priceBdt", 0)),
            stock = item.optInt("stock", 0),
            status = item.value("status") ?: "",
            soldCount = item.optInt("soldCount", item.optInt("unitsSold", 0))
        )
    }.orEmpty()

private fun JSONArray?.toCategories(): List<StoreCategory> =
    this?.objects()?.map { item ->
        val subcategories = item.optJSONArray("subCategories") ?: JSONArray()
        StoreCategory(
            id = item.value("id") ?: "",
            name = item.value("name") ?: "",
            slug = item.value("slug") ?: "",
            subCategories = subcategories.strings(),
            productCount = item.optInt("productCount", 0)
        )
    }.orEmpty()

private fun JSONArray?.toOrders(): List<OrderItem> =
    this?.objects()?.map { item ->
        val items = item.optJSONArray("items")
        val itemCount = if (items == null) item.optInt("itemsCount", 0) else items.length()
        OrderItem(
            id = item.value("id", "orderId") ?: "",
            customer = item.value("customerName", "customer", "name") ?: "",
            items = itemCount,
            totalBdt = item.optInt("total", item.optInt("totalBdt", item.optInt("totalAmount", 0))),
            payment = item.value("paymentMethod", "payment", "paymentStatus") ?: "",
            status = item.value("status") ?: "",
            date = item.value("date", "createdAt", "created_at") ?: "",
            channel = item.value("channel") ?: "",
            promoCode = item.value("promoCode") ?: ""
        )
    }.orEmpty()

private fun JSONArray?.toPurchases(): List<PurchaseOrderItem> =
    this?.objects()?.map { item ->
        val items = item.optJSONArray("items")
        PurchaseOrderItem(
            id = item.value("id", "purchaseOrderId") ?: "",
            supplier = item.value("supplierName", "supplier") ?: "",
            itemsCount = items?.length() ?: item.optInt("itemsCount", 0),
            totalBdt = item.optInt("total", item.optInt("totalBdt", 0)),
            status = item.value("status") ?: "",
            expectedDate = item.value("expectedDate", "date", "createdAt") ?: ""
        )
    }.orEmpty()

private fun JSONArray?.toSuppliers(): List<SupplierItem> =
    this?.objects()?.map { item ->
        SupplierItem(
            id = item.value("id") ?: "",
            name = item.value("companyName", "name") ?: "",
            contactPerson = item.value("contactPerson") ?: "",
            phone = item.value("phone") ?: "",
            city = item.value("city", "address") ?: "",
            activeSkus = item.optInt("activeSkus", 0)
        )
    }.orEmpty()

private fun JSONArray?.toCustomers(): List<CustomerItem> =
    this?.objects()?.map { item ->
        CustomerItem(
            id = item.value("id") ?: "",
            name = item.value("name") ?: "",
            phone = item.value("phone") ?: "",
            totalOrders = item.optInt("totalOrders", 0),
            totalSpentBdt = item.optInt("totalSpent", item.optInt("totalSpentBdt", 0)),
            lastOrder = item.value("lastOrder", "updatedAt", "createdAt") ?: ""
        )
    }.orEmpty()

private fun JSONArray?.toReviews(): List<ProductReviewItem> =
    this?.objects()?.map { item ->
        ProductReviewItem(
            id = item.value("id") ?: "",
            productName = item.value("productName", "product") ?: "",
            customer = item.value("customerName", "customer") ?: "",
            rating = item.optInt("rating", 0),
            comment = item.value("comment", "review") ?: "",
            date = item.value("createdAt", "date") ?: ""
        )
    }.orEmpty()

private fun JSONArray?.toStaff(): List<StaffMemberItem> =
    this?.objects()?.map { item ->
        StaffMemberItem(
            id = item.value("id") ?: "",
            name = item.value("name") ?: "",
            role = item.value("role") ?: "",
            email = item.value("email") ?: "",
            status = item.value("status") ?: ""
        )
    }.orEmpty()

private fun JSONArray?.toEmails(): List<EmailMessage> =
    this?.objects()?.map { item ->
        item.toEmail()
    }.orEmpty()

private fun JSONObject.toEmail(): EmailMessage {
    val sender = optJSONObject("sender")
    val senderName = sender?.value("name") ?: value("senderName", "sender").orEmpty()
    val bodyText = value("bodyText", "body", "preview").orEmpty()
    return EmailMessage(
            id = value("id") ?: "",
            sender = senderName,
            senderEmail = sender?.value("email") ?: value("senderEmail").orEmpty(),
            avatar = sender?.value("initials") ?: senderName.take(2).uppercase(),
            subject = value("subject").orEmpty(),
            preview = value("preview").orEmpty(),
            body = bodyText.lines().filter(String::isNotBlank),
            time = value("date", "createdAt", "time").orEmpty(),
            date = value("fullDate", "date", "createdAt").orEmpty(),
            unread = optBoolean("isUnread", optBoolean("unread", false)),
            starred = optBoolean("isFlagged", optBoolean("starred", false)),
            category = value("category").orEmpty(),
            folder = value("folder").orEmpty(),
            attachments = optJSONArray("attachments").objects().map { attachment ->
                EmailAttachment(
                    name = attachment.value("filename", "name") ?: "",
                    size = attachment.value("size") ?: "",
                    type = attachment.value("contentType", "type") ?: ""
                )
            }
        )
}

private fun JSONArray?.objects(): List<JSONObject> {
    if (this == null) return emptyList()
    return (0 until length()).mapNotNull { optJSONObject(it) }
}

private fun JSONArray?.strings(): List<String> {
    if (this == null) return emptyList()
    return (0 until length()).mapNotNull { index -> optString(index).takeIf(String::isNotBlank) }
}

private fun JSONObject.value(vararg keys: String): String? =
    keys.firstNotNullOfOrNull { key ->
        if (!has(key) || isNull(key)) null else optString(key).takeIf(String::isNotBlank)
    }

private fun JSONObject.optJSONArray(key: String): JSONArray? =
    if (isNull(key)) null else opt(key) as? JSONArray
