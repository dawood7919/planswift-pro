package com.takeoff.nativeapp.ui

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.unit.dp

/**
 * Design tokens, identical to the web workspace's CSS custom properties.
 * Defined once here; no composable may hard-code a colour.
 */

// Surfaces, darkest to lightest.
val TakeoffCanvas = Color(0xFF07090B)
val TakeoffBackground = Color(0xFF0B0E11)
val TakeoffSurface = Color(0xFF14181D)
val TakeoffSurfaceAlt = Color(0xFF1B2027)
val TakeoffSurfaceHi = Color(0xFF242B34)

val TakeoffBorder = Color(0xFF262D36)
val TakeoffBorderHi = Color(0xFF39424E)

val TakeoffText = Color(0xFFE6EBF2)
val TakeoffTextDim = Color(0xFF8A94A6)
val TakeoffTextFaint = Color(0xFF5C6675)

/** Money and primary actions only. Never a measurement. */
val TakeoffAccent = Color(0xFFFF8A3D)
val TakeoffAccentDim = Color(0xFF7A4520)

// One hue per takeoff type, used on the canvas, in layers and in reports alike.
val TakeoffArea = Color(0xFF22D3EE)
val TakeoffRoofArea = Color(0xFF7DD3FC)
val TakeoffVolume = Color(0xFF0E9BB4)
val TakeoffLinear = Color(0xFFF5A524)
val TakeoffSegment = Color(0xFF4ADE80)
val TakeoffCount = Color(0xFFA78BFA)

val TakeoffDanger = Color(0xFFF87171)
val TakeoffSuccess = Color(0xFF4ADE80)
val TakeoffWarning = Color(0xFFFBBF24)

/** Grid lines drawn over the canvas as screen decoration, not drawing geometry. */
val TakeoffGridLine = Color(0xFF161C24)

@Composable
fun InspectorSectionHeader(title: String, subtitle: String? = null) {
    Column(
        modifier = Modifier.fillMaxWidth().padding(top = 16.dp, bottom = 7.dp),
        verticalArrangement = Arrangement.spacedBy(2.dp)
    ) {
        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            Surface(color = MaterialTheme.colorScheme.primary, shape = RoundedCornerShape(99.dp)) {
                Text("", modifier = Modifier.padding(horizontal = 3.dp, vertical = 11.dp))
            }
            Text(title, style = MaterialTheme.typography.titleMedium, color = TakeoffText)
        }
        subtitle?.let {
            Text(it, style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
        }
    }
}

@Composable
fun WorkspacePill(label: String, value: String, accent: Color = TakeoffArea) {
    Surface(color = TakeoffSurfaceAlt, shape = RoundedCornerShape(12.dp)) {
        Column(modifier = Modifier.padding(horizontal = 10.dp, vertical = 7.dp), verticalArrangement = Arrangement.spacedBy(2.dp)) {
            Text(label, style = MaterialTheme.typography.labelSmall, color = TakeoffTextFaint)
            Text(value, style = MaterialTheme.typography.labelLarge, color = accent)
        }
    }
}
