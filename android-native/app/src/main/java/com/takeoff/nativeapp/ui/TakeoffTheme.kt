package com.takeoff.nativeapp.ui

import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.darkColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.ui.graphics.Color

private val TakeoffPalette = darkColorScheme(
    primary = Color(0xFF60B6E7),
    onPrimary = Color(0xFF06202D),
    surface = Color(0xFFF7FBFD),
    onSurface = Color(0xFF143648),
    background = Color(0xFFF3F7F9),
    onBackground = Color(0xFF143648)
)

@Composable
fun TakeoffTheme(content: @Composable () -> Unit) {
    MaterialTheme(colorScheme = TakeoffPalette, content = content)
}
