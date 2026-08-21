package com.takeoff.nativeapp.ui

import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.Undo
import androidx.compose.material.icons.filled.DeleteSweep
import androidx.compose.material.icons.filled.FolderOpen
import androidx.compose.material.icons.filled.Settings
import androidx.compose.material.icons.filled.UploadFile
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
import androidx.compose.ui.text.style.TextOverflow
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
    val summary = workspaceSummary(activeTool, if (hasMeasurements) 1 else 0, null)
    Surface(color = TakeoffSurface, contentColor = TakeoffText, shadowElevation = 8.dp) {
        Column(modifier = Modifier.fillMaxWidth().padding(horizontal = 14.dp, vertical = 10.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
            Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = androidx.compose.ui.Alignment.CenterVertically) {
                Row(modifier = Modifier.weight(1f), horizontalArrangement = Arrangement.spacedBy(10.dp), verticalAlignment = androidx.compose.ui.Alignment.CenterVertically) {
                    Surface(color = TakeoffAccent, shape = MaterialTheme.shapes.medium) {
                        Text("T", modifier = Modifier.padding(horizontal = 11.dp, vertical = 7.dp), style = MaterialTheme.typography.titleMedium, color = Color(0xFF1A1005))
                    }
                    Column {
                        Text("TAKEOFF", style = MaterialTheme.typography.labelLarge, color = TakeoffText)
                        Text(projectName, style = MaterialTheme.typography.titleSmall, color = Color.White, maxLines = 1, overflow = TextOverflow.Ellipsis)
                    }
                }
                Row(horizontalArrangement = Arrangement.spacedBy(1.dp)) {
                    IconButton(onClick = onOpenPlan) { Icon(Icons.Default.UploadFile, contentDescription = "فتح مخطط PDF", tint = TakeoffAccent) }
                    IconButton(onClick = onToggleInspector) { Icon(Icons.Default.Settings, contentDescription = "فتح لوحة المشروع", tint = Color.White) }
                }
            }
            Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                WorkspacePill("الأداة", summary.toolLabel)
                WorkspacePill("القياسات", if (hasMeasurements) "جاهزة" else "جديدة", if (hasMeasurements) TakeoffSuccess else TakeoffTextFaint)
                if (isLoading) WorkspacePill("الحالة", "يفتح المخطط…", TakeoffWarning)
            }
            Row(modifier = Modifier.horizontalScroll(rememberScrollState()), horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                NativeTool.entries.forEach { tool ->
                    FilterChip(
                        selected = activeTool == tool,
                        onClick = { onToolSelected(tool) },
                        label = { Text(tool.label) },
                        colors = androidx.compose.material3.FilterChipDefaults.filterChipColors(
                            selectedContainerColor = TakeoffSurfaceHi,
                            selectedLabelColor = TakeoffText,
                            labelColor = TakeoffTextDim,
                            containerColor = TakeoffSurfaceAlt
                        )
                    )
                }
                if (hasMeasurements) {
                    AssistChip(onClick = onUndo, label = { Text("تراجع") }, leadingIcon = { Icon(Icons.AutoMirrored.Filled.Undo, null) }, colors = AssistChipDefaults.assistChipColors(containerColor = TakeoffSurfaceAlt, labelColor = TakeoffTextDim, leadingIconContentColor = TakeoffTextDim))
                    AssistChip(onClick = onExportReport, label = { Text("تصدير") }, colors = AssistChipDefaults.assistChipColors(containerColor = TakeoffSurfaceAlt, labelColor = TakeoffTextDim))
                    AssistChip(onClick = onClear, label = { Text("مسح") }, leadingIcon = { Icon(Icons.Default.DeleteSweep, null) }, colors = AssistChipDefaults.assistChipColors(containerColor = TakeoffSurfaceAlt, labelColor = TakeoffDanger, leadingIconContentColor = TakeoffDanger))
                }
            }
        }
    }
}
