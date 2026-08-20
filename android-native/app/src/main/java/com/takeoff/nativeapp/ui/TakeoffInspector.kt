package com.takeoff.nativeapp.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
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
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.unit.dp
import com.takeoff.nativeapp.MeasurementKind
import com.takeoff.nativeapp.NativeCloudDocument
import com.takeoff.nativeapp.NativeCloudReview
import com.takeoff.nativeapp.TakeoffUiState
import com.takeoff.nativeapp.estimation.EstimationEngine
import com.takeoff.nativeapp.estimation.CostKind
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
    onNoteTextChange: (String) -> Unit,
    onCloudEndpointChange: (String) -> Unit,
    onConnectCloud: (String, String) -> Unit,
    onRefreshCloudProjects: () -> Unit,
    onImportCloudProject: (String) -> Unit,
    onLoadCloudDocuments: (String) -> Unit,
    onLoadCloudReviews: (String) -> Unit,
    onDownloadCloudPdf: (String, NativeCloudDocument) -> Unit,
    onOpenCloudReview: (String, NativeCloudReview) -> Unit,
    onToggleReferenceOverlay: () -> Unit,
    onClearCloudConnection: () -> Unit,
    onCreateVersion: (String) -> Unit,
    onCompareVersion: (Long) -> Unit,
    onRestoreVersion: (Long) -> Unit,
    onApplyCalibration: () -> Unit,
    onDeleteMeasurement: (Long) -> Unit,
    onDuplicateMeasurement: (Long) -> Unit,
    onToggleMeasurementSelection: (Long) -> Unit,
    onSelectCutoutTarget: (Long) -> Unit,
    onDeleteSelectedMeasurements: () -> Unit,
    onDuplicateSelectedMeasurements: () -> Unit,
    onAddLayer: (String) -> Unit,
    onSelectLayer: (Long) -> Unit,
    onToggleLayer: (Long) -> Unit,
    onAddTemplate: (String, String, String, TemplateKind) -> Unit,
    onSelectTemplate: (Long?) -> Unit,
    onAddCostItem: (String, String, String, String, String, CostKind) -> Unit,
    onSelectPage: (Long) -> Unit,
    modifier: Modifier = Modifier
) {
    var newLayerName by rememberSaveable { mutableStateOf("") }
    var newTemplateName by rememberSaveable { mutableStateOf("") }
    var newTemplateUnit by rememberSaveable { mutableStateOf("وحدة") }
    var newTemplateRate by rememberSaveable { mutableStateOf("0") }
    var newCostName by rememberSaveable { mutableStateOf("") }
    var newCostUnit by rememberSaveable { mutableStateOf("وحدة") }
    var newCostFactor by rememberSaveable { mutableStateOf("1") }
    var newCostRate by rememberSaveable { mutableStateOf("0") }
    var newCostWaste by rememberSaveable { mutableStateOf("0") }
    var deviceToken by rememberSaveable { mutableStateOf("") }
    var versionLabel by rememberSaveable { mutableStateOf("") }
    Column(modifier = modifier.background(Color.White).verticalScroll(rememberScrollState()).padding(14.dp), verticalArrangement = Arrangement.spacedBy(4.dp)) {
        Text("لوحة المشروع", style = MaterialTheme.typography.titleLarge, color = MaterialTheme.colorScheme.primary)
        Text("أدوات القياس، الطبقات، القوالب والإصدارات", style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
        Card(modifier = Modifier.fillMaxWidth()) {
            Column(Modifier.padding(10.dp), verticalArrangement = Arrangement.spacedBy(2.dp)) {
                Text(state.project.name, style = MaterialTheme.typography.titleSmall)
                Text(if (state.project.pages.isEmpty()) "لم تُضف صفحة بعد." else "${state.project.pages.size} صفحة · ${state.measurements.size} عنصر قياس", style = MaterialTheme.typography.bodySmall)
                Text("الأداة النشطة: ${state.selectedTool.label}", style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.primary)
            }
        }
        Text("الصفحات", style = MaterialTheme.typography.titleSmall, modifier = Modifier.padding(top = 8.dp))
        state.project.pages.forEach { page ->
            Button(onClick = { onSelectPage(page.id) }, enabled = page.id != state.activePageId, modifier = Modifier.fillMaxWidth().padding(top = 3.dp)) {
                Text("${if (page.id == state.activePageId) "●" else "○"} ${page.name}")
            }
        }
        Text("مصدر الإدخال: ${state.inputSource}", style = MaterialTheme.typography.bodySmall)
        state.pdfLabel?.let { Text("المخطط: $it", style = MaterialTheme.typography.bodySmall, maxLines = 1) }
        state.loadError?.let { Text(it, color = MaterialTheme.colorScheme.error, style = MaterialTheme.typography.bodySmall) }
        Spacer(Modifier.height(12.dp))
        Text("ربط منصة Takeoff", style = MaterialTheme.typography.titleSmall)
        Text("أنشئ رمز Android مؤقتاً من مساحة العمل على الويب، ثم الصقه هنا. لا يُرسل الرمز إلى أي عنوان غير رابط المنصة المحدد.", style = MaterialTheme.typography.bodySmall)
        OutlinedTextField(value = state.cloudEndpoint, onValueChange = onCloudEndpointChange, label = { Text("رابط المنصة HTTPS") }, singleLine = true, modifier = Modifier.fillMaxWidth().padding(top = 4.dp))
        OutlinedTextField(value = deviceToken, onValueChange = { deviceToken = it }, label = { Text("رمز ربط Android المؤقت") }, singleLine = true, visualTransformation = PasswordVisualTransformation(), modifier = Modifier.fillMaxWidth().padding(top = 4.dp))
        androidx.compose.foundation.layout.Row(horizontalArrangement = Arrangement.spacedBy(4.dp), modifier = Modifier.padding(top = 4.dp)) {
            Button(onClick = { onConnectCloud(state.cloudEndpoint, deviceToken); deviceToken = "" }, enabled = deviceToken.isNotBlank()) { Text("ربط الجهاز") }
            Button(onClick = onRefreshCloudProjects, enabled = !state.isRefreshingCloudProjects) { Text(if (state.isRefreshingCloudProjects) "جارٍ التحديث" else "تحديث المشاريع") }
            Button(onClick = onClearCloudConnection) { Text("إلغاء الربط") }
        }
        Text(state.cloudStatus, style = MaterialTheme.typography.bodySmall, modifier = Modifier.padding(top = 3.dp))
        state.cloudError?.let { Text(it, color = MaterialTheme.colorScheme.error, style = MaterialTheme.typography.bodySmall) }
        state.cloudProjects.take(8).forEach { project ->
            androidx.compose.foundation.layout.Row(horizontalArrangement = Arrangement.spacedBy(4.dp), modifier = Modifier.fillMaxWidth().padding(top = 2.dp)) {
                Button(onClick = { onImportCloudProject(project.id) }, enabled = !state.isRefreshingCloudProjects, modifier = Modifier.weight(1f)) { Text("استيراد: ${project.name}") }
                Button(onClick = { onLoadCloudDocuments(project.id) }, enabled = !state.isRefreshingCloudProjects) { Text("PDF") }
                Button(onClick = { onLoadCloudReviews(project.id) }, enabled = !state.isRefreshingCloudProjects) { Text("مراجعات") }
            }
        }
        if (state.cloudDocumentProjectId != null) state.cloudDocuments.forEach { document ->
            Button(onClick = { onDownloadCloudPdf(state.cloudDocumentProjectId, document) }, enabled = !state.isDownloadingCloudPdf, modifier = Modifier.fillMaxWidth().padding(top = 2.dp)) {
                Text(if (state.isDownloadingCloudPdf) "جارٍ تنزيل PDF" else "تنزيل وفتح: ${document.originalName}")
            }
        }
        if (state.cloudReviewProjectId != null) state.cloudReviews.forEach { review ->
            Button(onClick = { onOpenCloudReview(state.cloudReviewProjectId, review) }, enabled = !state.isDownloadingCloudPdf, modifier = Modifier.fillMaxWidth().padding(top = 2.dp)) {
                Text(if (state.isDownloadingCloudPdf) "جارٍ فتح المراجعة" else "مراجعة: ${review.label} → ${review.referenceDocumentName}")
            }
            review.note?.let { Text(it, style = MaterialTheme.typography.bodySmall, modifier = Modifier.padding(horizontal = 4.dp)) }
        }
        if (state.referencePdfBitmap != null) Button(onClick = onToggleReferenceOverlay, modifier = Modifier.fillMaxWidth().padding(top = 3.dp)) {
            Text(if (state.isReferenceOverlayVisible) "إخفاء طبقة المراجعة" else "إظهار طبقة المراجعة")
        }
        Spacer(Modifier.height(12.dp))
        Text("الإصدارات المحلية", style = MaterialTheme.typography.titleSmall)
        OutlinedTextField(value = versionLabel, onValueChange = { versionLabel = it }, label = { Text("اسم لقطة الإصدار") }, singleLine = true, modifier = Modifier.fillMaxWidth().padding(top = 4.dp))
        Button(onClick = { onCreateVersion(versionLabel); versionLabel = "" }, enabled = versionLabel.trim().isNotEmpty(), modifier = Modifier.fillMaxWidth().padding(top = 4.dp)) { Text("حفظ لقطة") }
        state.versions.takeLast(8).reversed().forEach { version ->
            androidx.compose.foundation.layout.Row(horizontalArrangement = Arrangement.spacedBy(4.dp), modifier = Modifier.fillMaxWidth().padding(top = 2.dp)) {
                Button(onClick = { onCompareVersion(version.id) }, modifier = Modifier.weight(1f)) { Text("مقارنة: ${version.label}") }
                Button(onClick = { onRestoreVersion(version.id) }) { Text("استعادة") }
            }
        }
        state.versionComparison?.let { comparison ->
            Text("فروق مع: ${comparison.referenceLabel} · ${comparison.totalChanges} تغيير", style = MaterialTheme.typography.bodySmall, modifier = Modifier.padding(top = 4.dp))
            Text("قياسات: +${comparison.addedMeasurements} / -${comparison.removedMeasurements} / ~${comparison.changedMeasurements} · تعليقات: +${comparison.addedAnnotations} / -${comparison.removedAnnotations} / ~${comparison.changedAnnotations} · صفحات: ${comparison.changedPages}", style = MaterialTheme.typography.bodySmall)
        }
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
        state.selectedTemplateId?.let { selectedId ->
            val selected = state.templates.firstOrNull { it.id == selectedId }
            Text("بنود ${selected?.name ?: "القالب"}", style = MaterialTheme.typography.labelLarge, modifier = Modifier.padding(top = 6.dp))
            OutlinedTextField(value = newCostName, onValueChange = { newCostName = it }, label = { Text("اسم البند") }, singleLine = true, modifier = Modifier.fillMaxWidth().padding(top = 3.dp))
            OutlinedTextField(value = newCostUnit, onValueChange = { newCostUnit = it }, label = { Text("الوحدة") }, singleLine = true, modifier = Modifier.fillMaxWidth().padding(top = 3.dp))
            OutlinedTextField(value = newCostFactor, onValueChange = { newCostFactor = it }, label = { Text("كمية لكل وحدة") }, singleLine = true, modifier = Modifier.fillMaxWidth().padding(top = 3.dp))
            OutlinedTextField(value = newCostRate, onValueChange = { newCostRate = it }, label = { Text("سعر الوحدة") }, singleLine = true, modifier = Modifier.fillMaxWidth().padding(top = 3.dp))
            OutlinedTextField(value = newCostWaste, onValueChange = { newCostWaste = it }, label = { Text("هالك %") }, singleLine = true, modifier = Modifier.fillMaxWidth().padding(top = 3.dp))
            androidx.compose.foundation.layout.Row(horizontalArrangement = Arrangement.spacedBy(4.dp), modifier = Modifier.padding(top = 3.dp)) {
                listOf(CostKind.MATERIAL to "مواد", CostKind.LABOR to "عمالة", CostKind.EQUIPMENT to "معدات").forEach { (kind, label) ->
                    Button(onClick = { onAddCostItem(newCostName, newCostUnit, newCostFactor, newCostRate, newCostWaste, kind); newCostName = "" }, enabled = newCostName.trim().isNotEmpty()) { Text(label) }
                }
            }
            selected?.costItems?.forEach { item -> Text("${item.kind.name} · ${item.name}: ${item.quantityFactor} ${item.unit} × ${item.rate} (هالك ${item.wastePercent}%)", style = MaterialTheme.typography.bodySmall, modifier = Modifier.padding(top = 2.dp)) }
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
        OutlinedTextField(value = state.noteText, onValueChange = onNoteTextChange, label = { Text("نص الملاحظة الهندسية") }, modifier = Modifier.fillMaxWidth().padding(top = 4.dp))
        Spacer(Modifier.height(12.dp))
        Text("القياسات", style = MaterialTheme.typography.titleSmall)
        val cutoutTarget = state.cutoutTargetId?.let { targetId -> state.measurements.firstOrNull { it.id == targetId } }
        Text(
            cutoutTarget?.let { "هدف الفتحات: ${it.kind.name} · ${it.cutouts.size} فتحة. اختر أداة «فتحة» وارسم الحلقة." }
                ?: "الفتحات: اختر «فتحات» بجانب مساحة أو سطح مائل، ثم اختر أداة «فتحة» لرسم الحلقة.",
            style = MaterialTheme.typography.bodySmall
        )
        if (state.selectedMeasurementIds.isNotEmpty()) {
            Text("محدد: ${state.selectedMeasurementIds.size}", style = MaterialTheme.typography.bodySmall)
            androidx.compose.foundation.layout.Row(horizontalArrangement = Arrangement.spacedBy(4.dp), modifier = Modifier.padding(top = 4.dp)) {
                Button(onClick = onDuplicateSelectedMeasurements) { Text("نسخ المجموعة") }
                Button(onClick = onDeleteSelectedMeasurements) { Text("حذف المجموعة") }
            }
        }
        Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
            state.measurements.forEach { measurement ->
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
                        if (measurement.cutouts.isNotEmpty()) Text("فتحات: ${measurement.cutouts.size}", style = MaterialTheme.typography.bodySmall)
                        estimatedCost?.let { Text("التكلفة: ${"%.2f".format(it)}", style = MaterialTheme.typography.bodySmall) }
                        androidx.compose.foundation.layout.Row(horizontalArrangement = Arrangement.spacedBy(4.dp), modifier = Modifier.padding(top = 4.dp)) {
                            Button(onClick = { onToggleMeasurementSelection(measurement.id) }) { Text(if (measurement.id in state.selectedMeasurementIds) "إلغاء التحديد" else "تحديد") }
                            if (measurement.kind == MeasurementKind.AREA || measurement.kind == MeasurementKind.ROOF_AREA) Button(onClick = { onSelectCutoutTarget(measurement.id) }) { Text(if (measurement.id == state.cutoutTargetId) "هدف الفتحات" else "فتحـات") }
                            Button(onClick = { onDuplicateMeasurement(measurement.id) }) { Text("نسخ") }
                            Button(onClick = { onDeleteMeasurement(measurement.id) }) { Text("حذف") }
                        }
                    }
                }
            }
        }
    }
}
