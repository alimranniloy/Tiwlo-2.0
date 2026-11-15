package com.example.ui.theme

import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable

private val TiwloShadcnColorScheme = lightColorScheme(
    primary = ShadcnPrimary,
    onPrimary = ShadcnPrimaryForeground,
    primaryContainer = ShadcnPrimary,
    onPrimaryContainer = ShadcnPrimaryForeground,
    secondary = ShadcnSecondary,
    onSecondary = ShadcnSecondaryForeground,
    secondaryContainer = ShadcnMuted,
    onSecondaryContainer = ShadcnForeground,
    tertiary = ShadcnInk,
    onTertiary = ShadcnInkForeground,
    background = ShadcnBackground,
    onBackground = ShadcnForeground,
    surface = ShadcnBackground,
    onSurface = ShadcnForeground,
    surfaceVariant = ShadcnMuted,
    onSurfaceVariant = ShadcnMutedForeground,
    outline = ShadcnBorder,
    outlineVariant = ShadcnInput,
    error = ShadcnDestructive,
    onError = ShadcnInkForeground
)

@Composable
fun TiwloTheme(
    content: @Composable () -> Unit
) {
    MaterialTheme(
        colorScheme = TiwloShadcnColorScheme,
        typography = Typography,
        content = content
    )
}

@Composable
fun MyApplicationTheme(
    content: @Composable () -> Unit
) {
    TiwloTheme(content = content)
}
