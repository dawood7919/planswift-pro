package com.takeoff.nativeapp.ui

import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Shapes
import androidx.compose.material3.Typography
import androidx.compose.material3.darkColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp

/**
 * Dark, canvas-first design tokens, matching the web workspace exactly.
 *
 * The drawing is the hero: chrome recedes, the canvas is near-black (pure black crushes the
 * light linework of a plan), one hue identifies each takeoff type everywhere it appears, and
 * [TakeoffAccent] is reserved for money and primary actions so an orange figure never means a
 * measurement.
 */
private val TakeoffPalette = darkColorScheme(
    primary = TakeoffAccent,
    onPrimary = Color(0xFF1A1005),
    primaryContainer = TakeoffAccentDim,
    onPrimaryContainer = Color(0xFFFFE6D2),
    secondary = TakeoffArea,
    onSecondary = Color(0xFF04222A),
    secondaryContainer = TakeoffSurfaceHi,
    onSecondaryContainer = TakeoffText,
    tertiary = TakeoffCount,
    background = TakeoffBackground,
    onBackground = TakeoffText,
    surface = TakeoffSurface,
    onSurface = TakeoffText,
    surfaceVariant = TakeoffSurfaceAlt,
    onSurfaceVariant = TakeoffTextDim,
    surfaceContainerHighest = TakeoffSurfaceHi,
    outline = TakeoffBorderHi,
    outlineVariant = TakeoffBorder,
    error = TakeoffDanger,
    onError = Color(0xFF2A0B0B)
)

private val TakeoffTypography = Typography(
    headlineSmall = TextStyle(fontWeight = FontWeight.Bold, fontSize = 28.sp, lineHeight = 34.sp, letterSpacing = (-0.5).sp),
    titleLarge = TextStyle(fontWeight = FontWeight.Bold, fontSize = 20.sp, lineHeight = 26.sp, letterSpacing = (-0.3).sp),
    titleMedium = TextStyle(fontWeight = FontWeight.SemiBold, fontSize = 16.sp, lineHeight = 22.sp),
    titleSmall = TextStyle(fontWeight = FontWeight.SemiBold, fontSize = 14.sp, lineHeight = 20.sp),
    bodyLarge = TextStyle(fontSize = 15.sp, lineHeight = 23.sp),
    bodyMedium = TextStyle(fontSize = 14.sp, lineHeight = 21.sp),
    bodySmall = TextStyle(fontSize = 12.sp, lineHeight = 18.sp),
    labelLarge = TextStyle(fontWeight = FontWeight.SemiBold, fontSize = 13.sp),
    labelMedium = TextStyle(fontWeight = FontWeight.Medium, fontSize = 12.sp),
    labelSmall = TextStyle(fontWeight = FontWeight.SemiBold, fontSize = 11.sp, letterSpacing = 0.6.sp)
)

private val TakeoffShapes = Shapes(
    extraSmall = androidx.compose.foundation.shape.RoundedCornerShape(8.dp),
    small = androidx.compose.foundation.shape.RoundedCornerShape(8.dp),
    medium = androidx.compose.foundation.shape.RoundedCornerShape(12.dp),
    large = androidx.compose.foundation.shape.RoundedCornerShape(16.dp),
    extraLarge = androidx.compose.foundation.shape.RoundedCornerShape(22.dp)
)

@Composable
fun TakeoffTheme(content: @Composable () -> Unit) {
    MaterialTheme(colorScheme = TakeoffPalette, typography = TakeoffTypography, shapes = TakeoffShapes, content = content)
}
