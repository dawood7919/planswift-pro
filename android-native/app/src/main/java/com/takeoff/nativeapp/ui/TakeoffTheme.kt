package com.takeoff.nativeapp.ui

import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.ui.graphics.Color

private val TakeoffPalette = lightColorScheme(
    primary = Color(0xFF0B5F86),
    onPrimary = Color(0xFFFFFFFF),
    primaryContainer = Color(0xFFD6EEF9),
    onPrimaryContainer = Color(0xFF05364E),
    secondary = Color(0xFFBD6A2E),
    secondaryContainer = Color(0xFFFFE8D6),
    surface = Color(0xFFFFFFFF),
    onSurface = Color(0xFF172B36),
    surfaceVariant = Color(0xFFE8F0F4),
    onSurfaceVariant = Color(0xFF43545E),
    background = Color(0xFFF3F6F8),
    onBackground = Color(0xFF172B36),
    outline = Color(0xFFB4C4CD)
)

@Composable
fun TakeoffTheme(content: @Composable () -> Unit) {
    MaterialTheme(colorScheme = TakeoffPalette, content = content)
}
