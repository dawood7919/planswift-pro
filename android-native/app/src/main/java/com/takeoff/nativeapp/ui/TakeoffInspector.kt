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
import androidx.compose.material3.Button
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.unit.dp
import com.takeoff.nativeapp.MeasurementKind
import com.takeoff.nativeapp.TakeoffUiState
import com.takeoff.nativeapp.estimation.EstimationEngine
import com.takeoff.nativeapp.estimation.TemplateKind

@Composable
fun TakeoffInspector(
    state: TakeoffUiState,
    onKnownDistanceChange: (String) -> Unit,
    onScaleUnitChange: (String) -> Unit,
    onRoofRiseChange: (String) -> Unit,
    onRoofRunChange: (String) -> Unit,
    onVolumeDepthChange: (String) -> Unit,
    onMultiplierChange: (String) -> Unit,
    onApplyCalibration: () -> Unit,
    onDeleteMeasurement: (Long) -> Unit,
    onDuplicateMeasurement: (Long) -> Unit,
    onAddLayer: (String) -> Unit,
    onSelectLayer: (Long) -> Unit,
    onToggleLayer: (Long) -> Unit,
    onAddTemplate: (String, String, String, TemplateKind) -> Unit,
    onSelectTemplate: (Long?) -> Unit,
    onSelectPage: (Long) -> Unit,
    modifier: Modifier = Modifier
) {
    var newLayerName by rememberSaveable { mutableStateOf("") }
    var newTemplateName by rememberSaveable { mutableStateOf("") }
    var newTemplateUnit by rememberSaveable { mutableStateOf("وحدة") }
    var newTemplateRate by rememberSaveable { mutableStateOf("0") }
    Column(modifier = modifier.background(Color(0xFFF9FCFE)).padding(10.dp)) {
        Text("المفتش", style = MaterialTheme.typography.titleMedium)
        Spacer(Modifier.height(6.dp))
        Text("المشروع: ${state.project.name}", style = MaterialTheme.typography.bodySmall)
        Text(
            if (state.project.pages.isEmpty()) "الصفحات: لم تُضف صفحة بعد." else "الصفحات: ${state.project.pages.joinToString(" · ") { it.name }}",
            style = MaterialTheme.typography.bodySmall,
            maxLines = 2
        )
        state.project.pages.forEach { page ->
            Button(onClick = { onSelectPage(page.id) }, enabled = page.id != state.activePageId, modifier = Modifier.fillMaxWidth().padding(top = 3.dp)) {
                Text("${if (page.id == state.activePageId) "●" else "○"} ${page.name}")
            }
        }
        Text("الأداة: ${state.selectedTool.label}", style = MaterialTheme.typography.bodySmall)
        Text("مصدر الإدخال: ${state.inputSource}", style = MaterialTheme.typography.bodySmall)
        state.pdfLabel?.let { Text("المخطط: $it", style = MaterialTheme.typography.bodySmall, maxLines = 1) }
        state.loadError?.let { Text(it, color = MaterialTheme.colorScheme.error, style = MaterialTheme.typography.bodySmall) }
        Spacer(Modifier.height(12.dp))
        Text("الطبقات", style = MaterialTheme.typography.titleSmall)
        OutlinedTextField(
            value = newLayerName,
            onValueChange = { newLayerName = it },
            label = { Text("اسم طبقة جديدة") },
            singleLine = true,
            modifier = Modifier.fillMaxWidth().padding(top = 4.dp)
        )
        Button(
            onClick = { onAddLayer(newLayerName); newLayerName = "" },
            enabled = newLayerName.trim().isNotEmpty(),
            modifier = Modifier.fillMaxWidth().padding(top = 4.dp)
        ) { Text("إضافة طبقة") }
        state.layers.forEach { layer ->
            androidx.compose.foundation.layout.Row(modifier = Modifier.fillMaxWidth().padding(top = 3.dp), horizontalArrangement = Arrangement.spacedBy(4.dp)) {
                Button(onClick = { onSelectLayer(layer.id) }, modifier = Modifier.weight(1f), enabled = state.selectedLayerId != layer.id) {
                    Text("${if (layer.visible) "●" else "○"} ${layer.name}")
                }
                Button(onClick = { onToggleLayer(layer.id) }) { Text(if (layer.visible) "إخفاء" else "إظهار") }
            }
        }
        Spacer(Modifier.height(12.dp))
        Text("القوالب والتقدير", style = MaterialTheme.typography.titleSmall)
        OutlinedTextField(value = newTemplateName, onValueChange = { newTemplateName = it }, label = { Text("اسم Part أو Assembly") }, singleLine = true, modifier = Modifier.fillMaxWidth().padding(top = 4.dp))
        OutlinedTextField(value = newTemplateUnit, onValueChange = { newTemplateUnit = it }, label = { Text("الوحدة") }, singleLine = true, modifier = Modifier.fillMaxWidth().padding(top = 4.dp))
        OutlinedTextField(value = newTemplateRate, onValueChange = { newTemplateRate = it }, label = { Text("سعر الوحدة") }, singleLine = true, modifier = Modifier.fillMaxWidth().padding(top = 4.dp))
        androidx.compose.foundation.layout.Row(horizontalArrangement = Arrangement.spacedBy(4.dp), modifier = Modifier.padding(top = 4.dp)) {
            Button(onClick = { onAddTemplate(newTemplateName, newTemplateUnit, newTemplateRate, TemplateKind.PART); newTemplateName = "" }, enabled = newTemplateName.trim().isNotEmpty()) { Text("Part") }
            Button(onClick = { onAddTemplate(newTemplateName, newTemplateUnit, newTemplateRate, TemplateKind.ASSEMBLY); newTemplateName = "" }, enabled = newTemplateName.trim().isNotEmpty()) { Text("Assembly") }
            Button(onClick = { onSelectTemplate(null) }, enabled = state.selectedTemplateId != null) { Text("يدوي") }
        }
        state.templates.forEach { template ->
            Button(onClick = { onSelectTemplate(template.id) }, modifier = Modifier.fillMaxWidth().padding(top = 3.dp), enabled = state.selectedTemplateId != template.id) {
                Text("${template.kind.name} · ${template.name} · ${template.rate}/${template.unit}")
            }
        }
        Spacer(Modifier.height(12.dp))
        Text("المقياس", style = MaterialTheme.typography.titleSmall)
        Text(
            state.calibration?.let { "1 وحدة رسم = ${"%.5f".format(it.factor)} ${it.unit}" }
                ?: "غير معاير — اختر أداة «معايرة» ثم حدد نقطتين.",
            style = MaterialTheme.typography.bodySmall
        )
        if (state.calibrationPoints.size == 2) {
            OutlinedTextField(
                value = state.knownDistance,
                onValueChange = onKnownDistanceChange,
                label = { Text("المسافة الحقيقية") },
                singleLine = true,
                modifier = Modifier.fillMaxWidth().padding(top = 6.dp)
            )
            androidx.compose.foundation.layout.Row(horizontalArrangement = Arrangement.spacedBy(4.dp), modifier = Modifier.padding(top = 5.dp)) {
                listOf("m", "cm", "ft", "in").forEach { unit ->
                    Button(onClick = { onScaleUnitChange(unit) }, enabled = state.scaleUnit != unit) { Text(unit) }
                }
            }
            Button(onClick = onApplyCalibration, modifier = Modifier.fillMaxWidth().padding(top = 5.dp)) { Text("اعتماد المقياس") }
        }
        Spacer(Modifier.height(12.dp))
        Text("قياسات متخصصة", style = MaterialTheme.typography.titleSmall)
        OutlinedTextField(value = state.roofRise, onValueChange = onRoofRiseChange, label = { Text("Roof rise") }, singleLine = true, modifier = Modifier.fillMaxWidth().padding(top = 4.dp))
        OutlinedTextField(value = state.roofRun, onValueChange = onRoofRunChange, label = { Text("Roof run") }, singleLine = true, modifier = Modifier.fillMaxWidth().padding(top = 4.dp))
        OutlinedTextField(value = state.volumeDepth, onValueChange = onVolumeDepthChange, label = { Text("عمق الحجم بوحدة المقياس") }, singleLine = true, modifier = Modifier.fillMaxWidth().padding(top = 4.dp))
        OutlinedTextField(value = state.multiplierInput, onValueChange = onMultiplierChange, label = { Text("عامل التكرار للعناصر الجديدة") }, singleLine = true, modifier = Modifier.fillMaxWidth().padding(top = 4.dp))
        Spacer(Modifier.height(12.dp))
        Text("القياسات", style = MaterialTheme.typography.titleSmall)
        LazyColumn(verticalArrangement = Arrangement.spacedBy(6.dp)) {
            items(state.measurements, key = { it.id }) { measurement ->
                val scale = state.calibration?.factor
                val unit = state.calibration?.unit
                val value = when (measurement.kind) {
                    MeasurementKind.COUNT -> "1 عنصر"
                    MeasurementKind.LINEAR -> if (scale != null && unit != null) "${"%.2f".format(measurement.value * scale)} $unit" else "${"%.2f".format(measurement.value)} وحدة رسم"
                    MeasurementKind.AREA, MeasurementKind.ROOF_AREA -> if (scale != null && unit != null) "${"%.2f".format(measurement.value * scale * scale)} $unit²" else "${"%.2f".format(measurement.value)} وحدة² رسم"
                    MeasurementKind.VOLUME -> if (scale != null && unit != null) "${"%.2f".format(measurement.value * scale * scale)} $unit³" else "${"%.2f".format(measurement.value)} وحدة³ رسم"
                }
                val scaledQuantity = when (measurement.kind) {
                    MeasurementKind.COUNT -> measurement.value
                    MeasurementKind.LINEAR -> measurement.value * (scale ?: 1.0)
                    MeasurementKind.AREA, MeasurementKind.ROOF_AREA, MeasurementKind.VOLUME -> measurement.value * (scale ?: 1.0) * (scale ?: 1.0)
                }
                val estimatedCost = state.templates.firstOrNull { it.id == measurement.templateId }?.let { EstimationEngine.estimate(it, scaledQuantity, measurement.multiplier).cost }
                Card(modifier = Modifier.fillMaxWidth()) {
                    Column(Modifier.padding(8.dp)) {
                        val layerName = state.layers.firstOrNull { it.id == measurement.layerId }?.name ?: "طبقة محذوفة"
                        Text("${measurement.kind.name} · $layerName", style = MaterialTheme.typography.labelSmall)
                        Text("$value × ${"%.2f".format(measurement.multiplier)}", style = MaterialTheme.typography.bodyMedium)
                        estimatedCost?.let { Text("التكلفة: ${"%.2f".format(it)}", style = MaterialTheme.typography.bodySmall) }
                        androidx.compose.foundation.layout.Row(horizontalArrangement = Arrangement.spacedBy(4.dp), modifier = Modifier.padding(top = 4.dp)) {
                            Button(onClick = { onDuplicateMeasurement(measurement.id) }) { Text("نسخ") }
                            Button(onClick = { onDeleteMeasurement(measurement.id) }) { Text("حذف") }
                        }
                    }
                }
            }
        }
    }
}
