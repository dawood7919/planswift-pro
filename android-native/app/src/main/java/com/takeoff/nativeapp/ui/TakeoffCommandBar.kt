package com.takeoff.nativeapp.ui

import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.Undo
import androidx.compose.material.icons.filled.DeleteSweep
import androidx.compose.material.icons.filled.FolderOpen
import androidx.compose.material.icons.filled.Settings
import androidx.compose.material3.AssistChip
import androidx.compose.material3.AssistChipDefaults
import androidx.compose.material3.FilterChip
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.unit.dp
import com.takeoff.nativeapp.NativeTool

@Composable
fun TakeoffCommandBar(
    projectName: String,
    activeTool: NativeTool,
    isLoading: Boolean,
    hasMeasurements: Boolean,
    onOpenPlan: () -> Unit,
    onToolSelected: (NativeTool) -> Unit,
    onClear: () -> Unit,
    onUndo: () -> Unit,
    onExportReport: () -> Unit,
    onToggleInspector: () -> Unit
) {
    Surface(color = Color(0xFF102D3C), contentColor = Color.White, shadowElevation = 6.dp) {
        Column(modifier = Modifier.fillMaxWidth().padding(horizontal = 14.dp, vertical = 8.dp), verticalArrangement = Arrangement.spacedBy(7.dp)) {
            Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                Column(modifier = Modifier.weight(1f)) {
                    Text("Takeoff", style = MaterialTheme.typography.titleLarge)
                    Text(projectName, style = MaterialTheme.typography.bodySmall, color = Color(0xFFB8CFDB), maxLines = 1)
                }
                Row(horizontalArrangement = Arrangement.spacedBy(2.dp)) {
                    IconButton(onClick = onOpenPlan) { Icon(Icons.Default.FolderOpen, contentDescription = "فتح مخطط PDF") }
                    IconButton(onClick = onToggleInspector) { Icon(Icons.Default.Settings, contentDescription = "فتح المفتش") }
                }
            }
            Row(modifier = Modifier.horizontalScroll(rememberScrollState()), horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                NativeTool.entries.forEach { tool ->
                    FilterChip(
                        selected = activeTool == tool,
                        onClick = { onToolSelected(tool) },
                        label = { Text(tool.label) },
                        colors = androidx.compose.material3.FilterChipDefaults.filterChipColors(
                            selectedContainerColor = Color(0xFF2F88B3),
                            selectedLabelColor = Color.White,
                            labelColor = Color(0xFFE1EEF4)
                        )
                    )
                }
                if (hasMeasurements) {
                    AssistChip(onClick = onUndo, label = { Text("تراجع") }, leadingIcon = { Icon(Icons.AutoMirrored.Filled.Undo, null) }, colors = AssistChipDefaults.assistChipColors(containerColor = Color(0xFF234B60), labelColor = Color.White, leadingIconContentColor = Color.White))
                    AssistChip(onClick = onExportReport, label = { Text("تصدير") }, colors = AssistChipDefaults.assistChipColors(containerColor = Color(0xFF234B60), labelColor = Color.White))
                    AssistChip(onClick = onClear, label = { Text("مسح") }, leadingIcon = { Icon(Icons.Default.DeleteSweep, null) }, colors = AssistChipDefaults.assistChipColors(containerColor = Color(0xFF5A2D31), labelColor = Color.White, leadingIconContentColor = Color.White))
                }
                if (isLoading) Text("جارٍ فتح المخطط…", style = MaterialTheme.typography.bodySmall, modifier = Modifier.padding(top = 10.dp), color = Color(0xFFB8CFDB))
            }
        }
    }
}
