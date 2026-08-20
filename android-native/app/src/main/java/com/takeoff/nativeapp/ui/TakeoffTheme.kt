package com.takeoff.nativeapp.ui

import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Shapes
import androidx.compose.material3.Typography
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp

private val TakeoffPalette = lightColorScheme(
    primary = Color(0xFF0B5F86),
    onPrimary = Color(0xFFFFFFFF),
    primaryContainer = Color(0xFFD6EEF9),
    onPrimaryContainer = Color(0xFF05364E),
    secondary = Color(0xFFD86F4B),
    secondaryContainer = Color(0xFFFFE4DA),
    tertiary = Color(0xFF728B12),
    surface = Color(0xFFFFFFFF),
    onSurface = Color(0xFF172B36),
    surfaceVariant = Color(0xFFE8F0F4),
    onSurfaceVariant = Color(0xFF43545E),
    background = TakeoffPaper,
    onBackground = Color(0xFF172B36),
    outline = Color(0xFFB4C4CD)
)

private val TakeoffTypography = Typography(
    headlineSmall = TextStyle(fontWeight = FontWeight.ExtraBold, fontSize = 28.sp, lineHeight = 34.sp),
    titleLarge = TextStyle(fontWeight = FontWeight.Bold, fontSize = 22.sp, lineHeight = 28.sp),
    titleMedium = TextStyle(fontWeight = FontWeight.Bold, fontSize = 17.sp, lineHeight = 23.sp),
    titleSmall = TextStyle(fontWeight = FontWeight.SemiBold, fontSize = 14.sp, lineHeight = 20.sp),
    bodyLarge = TextStyle(fontSize = 16.sp, lineHeight = 24.sp),
    bodyMedium = TextStyle(fontSize = 14.sp, lineHeight = 21.sp),
    bodySmall = TextStyle(fontSize = 12.sp, lineHeight = 18.sp),
    labelLarge = TextStyle(fontWeight = FontWeight.Bold, fontSize = 13.sp),
    labelSmall = TextStyle(fontWeight = FontWeight.Medium, fontSize = 11.sp)
)

private val TakeoffShapes = Shapes(
    extraSmall = androidx.compose.foundation.shape.RoundedCornerShape(10.dp),
    small = androidx.compose.foundation.shape.RoundedCornerShape(14.dp),
    medium = androidx.compose.foundation.shape.RoundedCornerShape(18.dp),
    large = androidx.compose.foundation.shape.RoundedCornerShape(24.dp),
    extraLarge = androidx.compose.foundation.shape.RoundedCornerShape(32.dp)
)

@Composable
fun TakeoffTheme(content: @Composable () -> Unit) {
    MaterialTheme(colorScheme = TakeoffPalette, typography = TakeoffTypography, shapes = TakeoffShapes, content = content)
}
