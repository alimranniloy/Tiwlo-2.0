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
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.outlined.ArrowForward
import androidx.compose.material.icons.outlined.Check
import androidx.compose.material.icons.outlined.Lock
import androidx.compose.material.icons.outlined.MailOutline
import androidx.compose.material.icons.outlined.PersonOutline
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.TextButton
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
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.example.model.AppScreen
import com.example.ui.components.ShadcnCard
import com.example.ui.components.ShadcnInput
import com.example.ui.components.ShadcnPrimaryButton
import com.example.ui.components.TiwloRingBrandMark
import com.example.ui.theme.FigtreeFontFamily
import com.example.ui.theme.JetBrainsMonoFontFamily
import com.example.ui.theme.ShadcnBackground
import com.example.ui.theme.ShadcnBorder
import com.example.ui.theme.ShadcnForeground
import com.example.ui.theme.ShadcnInk
import com.example.ui.theme.ShadcnMuted
import com.example.ui.theme.ShadcnMutedForeground
import com.example.ui.theme.ShadcnPrimary
import com.example.ui.theme.ShadcnSurfaceSubtle

@Composable
fun AuthScreen(
    mode: AppScreen,
    onNavigate: (AppScreen) -> Unit,
    onAuthSubmit: (AppScreen, String, String, String) -> Unit,
    onSocialLogin: (String) -> Unit
) {
    val isLogin = mode == AppScreen.LOGIN
    var fullName by remember(mode) { mutableStateOf("") }
    var email by remember(mode) { mutableStateOf("") }
    var password by remember(mode) { mutableStateOf("") }
    var rememberOrTerms by remember(mode) { mutableStateOf(true) }
    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(ShadcnSurfaceSubtle)
            .verticalScroll(rememberScrollState())
            .navigationBarsPadding()
    ) {
        // 1. Mobile Native Dark Ring Top Header (Clean, NO green dot at top)
        Box(
            modifier = Modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(bottomStart = 28.dp, bottomEnd = 28.dp))
                .background(ShadcnInk)
                .statusBarsPadding()
        ) {
            Canvas(modifier = Modifier.matchParentSize()) {
                val center = Offset(size.width * 0.90f, size.height * 0.25f)
                drawCircle(
                    color = ShadcnPrimary.copy(alpha = 0.25f),
                    radius = 90.dp.toPx(),
                    center = center,
                    style = Stroke(width = 22.dp.toPx())
                )
                drawCircle(
                    color = ShadcnPrimary.copy(alpha = 0.10f),
                    radius = 136.dp.toPx(),
                    center = center,
                    style = Stroke(width = 2.dp.toPx())
                )
            }

            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(horizontal = 20.dp, vertical = 22.dp)
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
                        TiwloRingBrandMark(size = 38)
                        Column {
                            Text(
                                text = "tiwlo",
                                fontFamily = FigtreeFontFamily,
                                fontWeight = FontWeight.Bold,
                                fontSize = 20.sp,
                                color = Color.White,
                                letterSpacing = (-0.5).sp
                            )
                        }
                    }
                }

                Spacer(modifier = Modifier.height(18.dp))

                Text(
                    text = if (isLogin) "Welcome" else "Create your account",
                    fontFamily = FigtreeFontFamily,
                    fontWeight = FontWeight.Bold,
                    fontSize = 24.sp,
                    color = Color.White,
                    letterSpacing = (-0.7).sp
                )
                Spacer(modifier = Modifier.height(14.dp))

                // Mode Switcher Pill (Sign In / Sign Up)
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .clip(RoundedCornerShape(12.dp))
                        .padding(4.dp)
                ) {
                    Box(
                        modifier = Modifier
                            .weight(1f)
                            .clip(RoundedCornerShape(9.dp))
                            .background(if (isLogin) ShadcnPrimary else Color.Transparent)
                            .clickable { onNavigate(AppScreen.LOGIN) }
                            .padding(vertical = 9.dp)
                            .testTag("auth_mode_login"),
                        contentAlignment = Alignment.Center
                    ) {
                        Text(
                            text = "Sign In",
                            fontFamily = FigtreeFontFamily,
                            fontWeight = FontWeight.Bold,
                            fontSize = 13.sp,
                            color = if (isLogin) ShadcnInk else Color.White.copy(alpha = 0.75f)
                        )
                    }
                    Box(
                        modifier = Modifier
                            .weight(1f)
                            .clip(RoundedCornerShape(9.dp))
                            .background(if (!isLogin) ShadcnPrimary else Color.Transparent)
                            .clickable { onNavigate(AppScreen.SIGNUP) }
                            .padding(vertical = 9.dp)
                            .testTag("auth_mode_signup"),
                        contentAlignment = Alignment.Center
                    ) {
                        Text(
                            text = "Create Account",
                            fontFamily = FigtreeFontFamily,
                            fontWeight = FontWeight.Bold,
                            fontSize = 13.sp,
                            color = if (!isLogin) ShadcnInk else Color.White.copy(alpha = 0.75f)
                        )
                    }
                }
            }
        }

        // Login and signup fields share one continuous form.
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = 16.dp, vertical = 18.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp)
        ) {
            ShadcnCard {
                Column(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(18.dp),
                    verticalArrangement = Arrangement.spacedBy(14.dp)
                ) {
                    Text(
                        text = if (isLogin) "Sign in" else "Create account",
                        fontFamily = FigtreeFontFamily,
                        fontWeight = FontWeight.Bold,
                        fontSize = 16.sp,
                        color = ShadcnForeground
                    )

                    if (!isLogin) {
                        Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
                            Text(
                                text = "Full name",
                                fontFamily = FigtreeFontFamily,
                                fontWeight = FontWeight.Medium,
                                fontSize = 13.sp,
                                color = ShadcnForeground
                            )
                            ShadcnInput(
                                value = fullName,
                                onValueChange = { fullName = it },
                                placeholder = "Your full name",
                                leadingIcon = Icons.Outlined.PersonOutline,
                                testTag = "auth_name_input"
                            )
                        }
                    }

                    Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
                        Text(
                            text = "Email address",
                            fontFamily = FigtreeFontFamily,
                            fontWeight = FontWeight.Medium,
                            fontSize = 13.sp,
                            color = ShadcnForeground
                        )
                        ShadcnInput(
                            value = email,
                            onValueChange = { email = it },
                            placeholder = "you@company.com",
                            leadingIcon = Icons.Outlined.MailOutline,
                            keyboardType = KeyboardType.Email,
                            testTag = "auth_email_input"
                        )
                    }

                    Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.SpaceBetween,
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Text(
                                text = "Password",
                                fontFamily = FigtreeFontFamily,
                                fontWeight = FontWeight.Medium,
                                fontSize = 13.sp,
                                color = ShadcnForeground
                            )
                            if (isLogin) {
                                Text(
                                    text = "Forgot password?",
                                    fontFamily = FigtreeFontFamily,
                                    fontSize = 12.sp,
                                    color = ShadcnMutedForeground
                                )
                            }
                        }
                        ShadcnInput(
                            value = password,
                            onValueChange = { password = it },
                            placeholder = "••••••••••••",
                            leadingIcon = Icons.Outlined.Lock,
                            visualTransformation = PasswordVisualTransformation(),
                            keyboardType = KeyboardType.Password,
                            testTag = "auth_password_input"
                        )
                    }

                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .clickable { rememberOrTerms = !rememberOrTerms },
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(8.dp)
                    ) {
                        Box(
                            modifier = Modifier
                                .size(18.dp)
                                .clip(RoundedCornerShape(4.dp))
                                .background(if (rememberOrTerms) ShadcnInk else ShadcnBackground)
                                .border(
                                    1.dp,
                                    if (rememberOrTerms) ShadcnInk else ShadcnBorder,
                                    RoundedCornerShape(4.dp)
                                ),
                            contentAlignment = Alignment.Center
                        ) {
                            if (rememberOrTerms) {
                                Icon(
                                    imageVector = Icons.Outlined.Check,
                                    contentDescription = "Checked",
                                    tint = ShadcnPrimary,
                                    modifier = Modifier.size(12.dp)
                                )
                            }
                        }
                        Text(
                            text = if (isLogin) "Keep me signed in on this device"
                            else "I agree to Tiwlo Terms & Privacy Policy",
                            fontFamily = FigtreeFontFamily,
                            fontSize = 12.sp,
                            color = ShadcnMutedForeground
                        )
                    }

                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .height(44.dp)
                            .clip(RoundedCornerShape(10.dp))
                            .background(ShadcnInk)
                            .clickable { onAuthSubmit(mode, fullName, email, password) }
                            .testTag("auth_submit_button"),
                        horizontalArrangement = Arrangement.Center,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Text(
                            text = if (isLogin) "Sign in" else "Create account",
                            fontFamily = FigtreeFontFamily,
                            fontWeight = FontWeight.SemiBold,
                            fontSize = 14.sp,
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

                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(10.dp)
                    ) {
                        HorizontalDivider(modifier = Modifier.weight(1f), color = ShadcnBorder)
                        Text(
                            text = "OR CONTINUE WITH",
                            fontFamily = JetBrainsMonoFontFamily,
                            fontSize = 10.sp,
                            color = ShadcnMutedForeground
                        )
                        HorizontalDivider(modifier = Modifier.weight(1f), color = ShadcnBorder)
                    }

                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.spacedBy(10.dp)
                    ) {
                        SocialAuthButton(
                            label = "Google",
                            badge = "G",
                            modifier = Modifier.weight(1f),
                            onClick = { onSocialLogin("google") }
                        )
                        SocialAuthButton(
                            label = "GitHub",
                            badge = "GH",
                            modifier = Modifier.weight(1f),
                            onClick = { onSocialLogin("github") }
                        )
                    }
                }
            }
        }
    }
}

@Composable
private fun SocialAuthButton(
    label: String,
    badge: String,
    modifier: Modifier = Modifier,
    onClick: () -> Unit
) {
    Row(
        modifier = modifier
            .height(40.dp)
            .clip(RoundedCornerShape(10.dp))
            .background(ShadcnBackground)
            .border(1.dp, ShadcnBorder, RoundedCornerShape(10.dp))
            .clickable(onClick = onClick)
            .testTag("social_auth_${label.lowercase()}"),
        horizontalArrangement = Arrangement.Center,
        verticalAlignment = Alignment.CenterVertically
    ) {
        Box(
            modifier = Modifier
                .size(20.dp)
                .clip(RoundedCornerShape(5.dp))
                .background(ShadcnMuted),
            contentAlignment = Alignment.Center
        ) {
            Text(
                text = badge,
                fontFamily = JetBrainsMonoFontFamily,
                fontWeight = FontWeight.Bold,
                fontSize = 10.sp,
                color = ShadcnForeground
            )
        }
        Spacer(modifier = Modifier.size(8.dp))
        Text(
            text = label,
            fontFamily = FigtreeFontFamily,
            fontWeight = FontWeight.Medium,
            fontSize = 13.sp,
            color = ShadcnForeground
        )
    }
}

@Composable
fun AuthVerificationScreen(
    type: String?,
    message: String?,
    onVerifyCode: (String) -> Unit,
    onBackToSignIn: () -> Unit,
    onOpenAddressVerification: () -> Unit,
    onRefreshSession: () -> Unit
) {
    var code by remember(type) { mutableStateOf("") }
    val needsAddressVerification = type == "address" || type == "identity"
    val title = when (type) {
        "setup2fa" -> "Set up 2-Step Verification"
        "2fa" -> "Verify your sign-in"
        "email" -> "Verify your email"
        "identity" -> "Identity verification"
        "address" -> "Address verification"
        else -> "Verify your account"
    }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(ShadcnBackground)
            .verticalScroll(rememberScrollState())
            .navigationBarsPadding()
    ) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .background(ShadcnInk)
                .statusBarsPadding()
                .padding(horizontal = 20.dp, vertical = 18.dp)
        ) {
            Row(
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(10.dp)
            ) {
                TiwloRingBrandMark(size = 36)
                Text(
                    text = "tiwlo",
                    fontFamily = FigtreeFontFamily,
                    fontWeight = FontWeight.Bold,
                    fontSize = 20.sp,
                    color = Color.White
                )
            }
            Spacer(modifier = Modifier.height(20.dp))
            Text(
                text = title,
                fontFamily = FigtreeFontFamily,
                fontWeight = FontWeight.Bold,
                fontSize = 23.sp,
                color = Color.White
            )
        }

        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = 20.dp, vertical = 24.dp),
            verticalArrangement = Arrangement.spacedBy(16.dp)
        ) {
            Text(
                text = message ?: if (needsAddressVerification) {
                    "Complete the required verification to continue using your Tiwlo account."
                } else {
                    "Enter the 6-digit code sent to your email."
                },
                fontFamily = FigtreeFontFamily,
                fontSize = 14.sp,
                color = ShadcnMutedForeground
            )

            if (needsAddressVerification) {
                ShadcnPrimaryButton(
                    text = "Continue verification",
                    onClick = onOpenAddressVerification,
                    modifier = Modifier.fillMaxWidth()
                )
                ShadcnPrimaryButton(
                    text = "I've completed verification",
                    onClick = onRefreshSession,
                    modifier = Modifier.fillMaxWidth()
                )
            } else {
                OutlinedTextField(
                    value = code,
                    onValueChange = { value -> code = value.filter(Char::isDigit).take(6) },
                    label = { Text("6-digit code") },
                    singleLine = true,
                    keyboardOptions = androidx.compose.foundation.text.KeyboardOptions(
                        keyboardType = KeyboardType.Number
                    ),
                    modifier = Modifier.fillMaxWidth()
                )
                ShadcnPrimaryButton(
                    text = if (type == "setup2fa") "Confirm and continue" else "Verify and continue",
                    onClick = { onVerifyCode(code) },
                    modifier = Modifier.fillMaxWidth()
                )
            }

            TextButton(onClick = onBackToSignIn) {
                Text("Back to sign in", color = ShadcnForeground)
            }
        }
    }
}
