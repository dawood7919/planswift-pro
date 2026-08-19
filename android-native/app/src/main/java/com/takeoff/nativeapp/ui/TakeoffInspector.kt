package com.takeoff.nativeapp.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material3.Card
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.unit.dp
import com.takeoff.nativeapp.MeasurementKind
import com.takeoff.nativeapp.TakeoffUiState

@Composable
fun TakeoffInspector(state: TakeoffUiState, modifier: Modifier = Modifier) {
    Column(modifier = modifier.background(Color(0xFFF9FCFE)).padding(10.dp)) {
        Text("المفتش", style = MaterialTheme.typography.titleMedium)
        Spacer(Modifier.height(6.dp))
        Text("الأداة: ${state.selectedTool.label}", style = MaterialTheme.typography.bodySmall)
        Text("مصدر الإدخال: ${state.inputSource}", style = MaterialTheme.typography.bodySmall)
        state.pdfLabel?.let { Text("المخطط: $it", style = MaterialTheme.typography.bodySmall, maxLines = 1) }
        state.loadError?.let { Text(it, color = MaterialTheme.colorScheme.error, style = MaterialTheme.typography.bodySmall) }
        Spacer(Modifier.height(12.dp))
        Text("القياسات", style = MaterialTheme.typography.titleSmall)
        LazyColumn(verticalArrangement = Arrangement.spacedBy(6.dp)) {
            items(state.measurements, key = { it.id }) { measurement ->
                val value = when (measurement.kind) {
                    MeasurementKind.COUNT -> "1 عنصر"
                    MeasurementKind.LINEAR -> "${"%.2f".format(measurement.value)} وحدة رسم"
                    MeasurementKind.AREA -> "${"%.2f".format(measurement.value)} وحدة² رسم"
                }
                Card(modifier = Modifier.fillMaxWidth()) {
                    Column(Modifier.padding(8.dp)) {
                        Text(measurement.kind.name, style = MaterialTheme.typography.labelSmall)
                        Text(value, style = MaterialTheme.typography.bodyMedium)
                    }
                }
            }
        }
    }
}
