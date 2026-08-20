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

val TakeoffInk = Color(0xFF0C2634)
val TakeoffCanvasBlue = Color(0xFF102E3D)
val TakeoffSignal = Color(0xFFCDEB59)
val TakeoffPaper = Color(0xFFF5F7F4)
val TakeoffOrange = Color(0xFFFF936D)

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
            Text(title, style = MaterialTheme.typography.titleMedium, color = TakeoffInk)
        }
        subtitle?.let {
            Text(it, style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
        }
    }
}

@Composable
fun WorkspacePill(label: String, value: String, accent: Color = TakeoffSignal) {
    Surface(color = Color(0x1FFFFFFF), shape = RoundedCornerShape(12.dp)) {
        Column(modifier = Modifier.padding(horizontal = 10.dp, vertical = 7.dp), verticalArrangement = Arrangement.spacedBy(2.dp)) {
            Text(label, style = MaterialTheme.typography.labelSmall, color = Color(0xFFC0D4DD))
            Text(value, style = MaterialTheme.typography.labelLarge, color = accent)
        }
    }
}
