package com.takeoff.nativeapp.ui

import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.DeleteSweep
import androidx.compose.material.icons.filled.FolderOpen
import androidx.compose.material.icons.filled.PanTool
import androidx.compose.material.icons.filled.Straighten
import androidx.compose.material.icons.filled.Texture
import androidx.compose.material.icons.filled.TouchApp
import androidx.compose.material.icons.automirrored.filled.Undo
import androidx.compose.material3.AssistChip
import androidx.compose.material3.AssistChipDefaults
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.TopAppBar
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import com.takeoff.nativeapp.NativeTool

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun TakeoffCommandBar(
    activeTool: NativeTool,
    isLoading: Boolean,
    hasMeasurements: Boolean,
    onOpenPlan: () -> Unit,
    onToolSelected: (NativeTool) -> Unit,
    onClear: () -> Unit,
    onUndo: () -> Unit,
    onExportReport: () -> Unit
) {
    TopAppBar(
        title = { Text("Takeoff Native", style = MaterialTheme.typography.titleMedium) },
        actions = {
            Row(
                modifier = Modifier.horizontalScroll(rememberScrollState()).padding(end = 8.dp),
                horizontalArrangement = Arrangement.spacedBy(5.dp)
            ) {
                AssistChip(onClick = onOpenPlan, label = { Text(if (isLoading) "جارٍ العرض" else "فتح PDF") }, leadingIcon = { Icon(Icons.Default.FolderOpen, null) })
                NativeTool.entries.forEach { tool ->
                    val icon = when (tool) {
                        NativeTool.PAN -> Icons.Default.PanTool
                        NativeTool.CALIBRATE -> Icons.Default.Straighten
                        NativeTool.COUNT -> Icons.Default.TouchApp
                        NativeTool.SEGMENT -> Icons.Default.Straighten
                        NativeTool.LINEAR -> Icons.Default.Straighten
                        NativeTool.AREA -> Icons.Default.Texture
                    }
                    AssistChip(
                        onClick = { onToolSelected(tool) },
                        label = { Text(tool.label) },
                        leadingIcon = { Icon(icon, null) },
                        colors = if (tool == activeTool) AssistChipDefaults.assistChipColors(containerColor = MaterialTheme.colorScheme.primaryContainer) else AssistChipDefaults.assistChipColors()
                    )
                }
                if (hasMeasurements) {
                    AssistChip(onClick = onExportReport, label = { Text("تصدير CSV") }, leadingIcon = { Icon(Icons.Default.FolderOpen, null) })
                    AssistChip(onClick = onUndo, label = { Text("تراجع") }, leadingIcon = { Icon(Icons.AutoMirrored.Filled.Undo, null) })
                    AssistChip(onClick = onClear, label = { Text("مسح") }, leadingIcon = { Icon(Icons.Default.DeleteSweep, null) })
                }
            }
        }
    )
}
