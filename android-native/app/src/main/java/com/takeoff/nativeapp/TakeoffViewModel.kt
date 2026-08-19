package com.takeoff.nativeapp

import android.app.Application
import android.content.Context
import android.graphics.Bitmap
import android.graphics.pdf.PdfRenderer
import android.net.Uri
import android.view.MotionEvent
import androidx.compose.ui.geometry.Offset
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import com.takeoff.nativeapp.estimation.NativeTemplate
import com.takeoff.nativeapp.estimation.TemplateKind
import com.takeoff.nativeapp.estimation.CostKind
import com.takeoff.nativeapp.estimation.TemplateCostItem
import com.takeoff.nativeapp.measurement.MeasurementEngine
import com.takeoff.nativeapp.measurement.PlanPoint
import com.takeoff.nativeapp.report.NativeReportEngine
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext

enum class NativeTool(val label: String) {
    PAN("تحريك"),
    CALIBRATE("معايرة"),
    COUNT("عد"),
    SEGMENT("مقطع"),
    LINEAR("طول"),
    AREA("مساحة"),
    ROOF_AREA("سطح مائل"),
    VOLUME("حجم")
}

enum class MeasurementKind { COUNT, LINEAR, AREA, ROOF_AREA, VOLUME }

data class NativeProjectPage(val id: Long, val name: String, val sourceUri: String? = null)

data class NativeProject(val id: Long, val name: String, val pages: List<NativeProjectPage>)

data class NativeLayer(val id: Long, val name: String, val color: Long, val visible: Boolean = true)

data class NativeMeasurement(
    val id: Long,
    val kind: MeasurementKind,
    val points: List<PlanPoint>,
    val value: Double,
    val layerId: Long,
    val templateId: Long? = null,
    val multiplier: Double = 1.0
)

data class NativeCalibration(val factor: Double, val unit: String)

data class TakeoffUiState(
    val pdfBitmap: Bitmap? = null,
    val pdfLabel: String? = null,
    val selectedTool: NativeTool = NativeTool.PAN,
    val pan: Offset = Offset.Zero,
    val zoom: Float = 1f,
    val activePoints: List<PlanPoint> = emptyList(),
    val calibrationPoints: List<PlanPoint> = emptyList(),
    val knownDistance: String = "1",
    val scaleUnit: String = "m",
    val roofRise: String = "",
    val roofRun: String = "",
    val volumeDepth: String = "",
    val calibration: NativeCalibration? = null,
    val layers: List<NativeLayer> = listOf(NativeLayer(1L, "قياسات عامة", 0xFF59C3F5)),
    val selectedLayerId: Long = 1L,
    val templates: List<NativeTemplate> = emptyList(),
    val selectedTemplateId: Long? = null,
    val multiplierInput: String = "1",
    val measurements: List<NativeMeasurement> = emptyList(),
    val selectedMeasurementIds: Set<Long> = emptySet(),
    val project: NativeProject = NativeProject(id = 1L, name = "مشروع محلي جديد", pages = emptyList()),
    val activePageId: Long? = null,
    val inputSource: String = "لم يبدأ إدخال",
    val isLoadingPlan: Boolean = false,
    val loadError: String? = null
)

class TakeoffViewModel(application: Application) : AndroidViewModel(application) {
    private val _state = MutableStateFlow(TakeoffUiState())
    val state: StateFlow<TakeoffUiState> = _state.asStateFlow()
    private val localStore = NativeProjectStore(application)
    private var lastScreenPoint: Offset? = null
    private var activePointerId: Int? = null
    private var lastPinchDistance: Float? = null
    private var isPinching = false
    private var nextMeasurementId = 1L
    private var nextPageId = 1L
    private var nextLayerId = 2L
    private var nextTemplateId = 1L
    private var nextCostItemId = 1L

    init {
        localStore.load()?.let { stored ->
            _state.value = _state.value.copy(project = stored.project, measurements = stored.measurements, calibration = stored.calibration, layers = stored.layers, selectedLayerId = stored.selectedLayerId, templates = stored.templates, selectedTemplateId = stored.selectedTemplateId, activePageId = stored.project.pages.lastOrNull()?.id)
            nextMeasurementId = (stored.measurements.maxOfOrNull { it.id } ?: 0L) + 1L
            nextPageId = (stored.project.pages.maxOfOrNull { it.id } ?: 0L) + 1L
            nextLayerId = (stored.layers.maxOfOrNull { it.id } ?: 0L) + 1L
            nextTemplateId = (stored.templates.maxOfOrNull { it.id } ?: 0L) + 1L
            nextCostItemId = (stored.templates.flatMap { it.costItems }.maxOfOrNull { it.id } ?: 0L) + 1L
        }
    }

    fun selectTool(tool: NativeTool) {
        _state.update { it.copy(selectedTool = tool, activePoints = emptyList()) }
    }

    fun clearMeasurements() {
        _state.update { it.copy(measurements = emptyList(), activePoints = emptyList()) }
        persistWorkspace()
    }

    fun undoLastMeasurement() {
        _state.update { current -> current.copy(measurements = current.measurements.dropLast(1)) }
        persistWorkspace()
    }

    fun deleteMeasurement(measurementId: Long) {
        _state.update { current -> current.copy(measurements = current.measurements.filterNot { it.id == measurementId }, selectedMeasurementIds = current.selectedMeasurementIds - measurementId) }
        persistWorkspace()
    }

    fun duplicateMeasurement(measurementId: Long) {
        val source = _state.value.measurements.firstOrNull { it.id == measurementId } ?: return
        val copy = source.copy(id = nextMeasurementId++, points = source.points.map { point -> PlanPoint(point.x + 12f, point.y + 12f) })
        _state.update { it.copy(measurements = it.measurements + copy, inputSource = "نُسخ عنصر القياس بإزاحة واضحة") }
        persistWorkspace()
    }

    fun toggleMeasurementSelection(measurementId: Long) {
        _state.update { current ->
            val selected = if (measurementId in current.selectedMeasurementIds) current.selectedMeasurementIds - measurementId else current.selectedMeasurementIds + measurementId
            current.copy(selectedMeasurementIds = selected)
        }
    }

    fun deleteSelectedMeasurements() {
        val selected = _state.value.selectedMeasurementIds
        if (selected.isEmpty()) return
        _state.update { current -> current.copy(measurements = current.measurements.filterNot { it.id in selected }, selectedMeasurementIds = emptySet()) }
        persistWorkspace()
    }

    fun duplicateSelectedMeasurements() {
        val selected = _state.value.selectedMeasurementIds
        if (selected.isEmpty()) return
        val copies = _state.value.measurements.filter { it.id in selected }.map { source -> source.copy(id = nextMeasurementId++, points = source.points.map { point -> PlanPoint(point.x + 12f, point.y + 12f) }) }
        _state.update { it.copy(measurements = it.measurements + copies, inputSource = "نُسخت مجموعة القياسات بإزاحة واضحة") }
        persistWorkspace()
    }

    fun setKnownDistance(value: String) {
        _state.update { it.copy(knownDistance = value) }
    }

    fun setScaleUnit(unit: String) {
        _state.update { it.copy(scaleUnit = unit) }
    }

    fun setRoofRise(value: String) {
        _state.update { it.copy(roofRise = value) }
    }

    fun setRoofRun(value: String) {
        _state.update { it.copy(roofRun = value) }
    }

    fun setVolumeDepth(value: String) {
        _state.update { it.copy(volumeDepth = value) }
    }

    fun setMultiplierInput(value: String) {
        _state.update { it.copy(multiplierInput = value) }
    }

    fun addLayer(name: String) {
        val normalized = name.trim().take(80)
        if (normalized.isEmpty()) return
        val colors = longArrayOf(0xFF59C3F5, 0xFF36E39D, 0xFFFFA26B, 0xFFA78BFA, 0xFFF6CF62)
        val layer = NativeLayer(nextLayerId++, normalized, colors[(nextLayerId % colors.size).toInt()])
        _state.update { it.copy(layers = it.layers + layer, selectedLayerId = layer.id, inputSource = "اختيرت طبقة $normalized") }
        persistWorkspace()
    }

    fun selectLayer(layerId: Long) {
        _state.update { state -> if (state.layers.any { it.id == layerId }) state.copy(selectedLayerId = layerId) else state }
    }

    fun toggleLayer(layerId: Long) {
        _state.update { state -> state.copy(layers = state.layers.map { if (it.id == layerId) it.copy(visible = !it.visible) else it }) }
        persistWorkspace()
    }

    fun addTemplate(name: String, unit: String, rateText: String, kind: TemplateKind) {
        val normalizedName = name.trim().take(120)
        val normalizedUnit = unit.trim().take(32)
        val rate = rateText.toDoubleOrNull()
        if (normalizedName.isEmpty() || normalizedUnit.isEmpty() || rate == null || !rate.isFinite() || rate < 0) return
        val template = NativeTemplate(nextTemplateId++, kind, normalizedName, normalizedUnit, rate)
        _state.update { it.copy(templates = it.templates + template, selectedTemplateId = template.id, inputSource = "اختير قالب $normalizedName") }
        persistWorkspace()
    }

    fun selectTemplate(templateId: Long?) {
        _state.update { state -> state.copy(selectedTemplateId = templateId?.takeIf { id -> state.templates.any { it.id == id } }) }
    }

    fun addCostItem(name: String, unit: String, factorText: String, rateText: String, wasteText: String, kind: CostKind) {
        val templateId = _state.value.selectedTemplateId ?: return
        val normalizedName = name.trim().take(120)
        val normalizedUnit = unit.trim().take(32)
        val factor = factorText.toDoubleOrNull()
        val rate = rateText.toDoubleOrNull()
        val waste = wasteText.toDoubleOrNull()
        if (normalizedName.isEmpty() || normalizedUnit.isEmpty() || factor == null || rate == null || waste == null || !factor.isFinite() || !rate.isFinite() || !waste.isFinite() || factor < 0 || rate < 0 || waste < 0 || waste > 100) return
        val item = TemplateCostItem(nextCostItemId++, kind, normalizedName, factor, normalizedUnit, rate, waste)
        _state.update { current -> current.copy(templates = current.templates.map { template -> if (template.id == templateId) template.copy(costItems = template.costItems + item) else template }, inputSource = "أضيف بند ${item.name} للقالب") }
        persistWorkspace()
    }

    fun exportReportCsv(): String {
        val current = _state.value
        return NativeReportEngine.toCsv(NativeReportEngine.rows(current.measurements, current.layers, current.templates, current.calibration))
    }

    fun applyCalibration() {
        val current = _state.value
        val knownDistance = current.knownDistance.toDoubleOrNull()
        val drawingDistance = MeasurementEngine.polylineLength(current.calibrationPoints)
        val factor = knownDistance?.let { MeasurementEngine.scaleFactor(drawingDistance, it) }
        if (factor == null) {
            _state.update { it.copy(inputSource = "أدخل مسافة حقيقية موجبة بعد تحديد نقطتين") }
            return
        }
        _state.update {
            it.copy(
                calibration = NativeCalibration(factor, it.scaleUnit),
                inputSource = "اعتمد المقياس: ${"%.5f".format(factor)} ${it.scaleUnit}/وحدة رسم",
                calibrationPoints = emptyList()
            )
        }
        persistWorkspace()
    }

    fun openPdf(context: Context, uri: Uri, label: String) {
        _state.update { it.copy(isLoadingPlan = true, loadError = null, pdfLabel = label) }
        viewModelScope.launch(Dispatchers.IO) {
            val result = runCatching {
                context.contentResolver.openFileDescriptor(uri, "r")?.use { descriptor ->
                    PdfRenderer(descriptor).use { renderer ->
                        require(renderer.pageCount > 0) { "لا يحتوي ملف PDF على صفحات." }
                        renderer.openPage(0).use { page ->
                            val width = page.width * 2
                            val height = page.height * 2
                            Bitmap.createBitmap(width, height, Bitmap.Config.ARGB_8888).also { bitmap ->
                                page.render(bitmap, null, null, PdfRenderer.Page.RENDER_MODE_FOR_DISPLAY)
                            }
                        }
                    }
                } ?: error("تعذر قراءة ملف PDF المحدد.")
            }
            withContext(Dispatchers.Main) {
                result.onSuccess { bitmap -> _state.update { current ->
                    val page = current.project.pages.firstOrNull { it.sourceUri == uri.toString() }
                        ?: NativeProjectPage(nextPageId++, label, uri.toString())
                    current.copy(
                        pdfBitmap = bitmap,
                        isLoadingPlan = false,
                        activePageId = page.id,
                        project = if (current.project.pages.any { it.id == page.id }) current.project else current.project.copy(pages = current.project.pages + page)
                    )
                }.also { persistWorkspace() } }
                    .onFailure { error -> _state.update { it.copy(isLoadingPlan = false, loadError = error.message ?: "تعذر عرض المخطط.") } }
            }
        }
    }

    fun selectPage(context: Context, pageId: Long) {
        val page = _state.value.project.pages.firstOrNull { it.id == pageId } ?: return
        val sourceUri = page.sourceUri ?: return
        openPdf(context, Uri.parse(sourceUri), page.name)
    }

    fun onMotionEvent(event: MotionEvent, planPoint: PlanPoint, screenPoint: Offset) {
        val action = event.actionMasked
        val index = event.actionIndex
        val pointerId = event.getPointerId(index)
        val isStylus = event.getToolType(index) == MotionEvent.TOOL_TYPE_STYLUS
        val source = if (isStylus) "قلم S Pen / Stylus" else "لمس"

        when (action) {
            MotionEvent.ACTION_DOWN -> {
                isPinching = false
                activePointerId = pointerId
                lastScreenPoint = screenPoint
                _state.update { current ->
                    when (current.selectedTool) {
                        NativeTool.PAN -> current.copy(inputSource = source)
                        NativeTool.CALIBRATE -> current.copy(inputSource = "المعايرة: المس النقطة الأولى ثم الثانية")
                        NativeTool.COUNT -> current.copy(inputSource = source)
                        NativeTool.SEGMENT, NativeTool.LINEAR, NativeTool.AREA, NativeTool.ROOF_AREA, NativeTool.VOLUME -> current.copy(inputSource = source, activePoints = listOf(planPoint))
                    }
                }
            }
            MotionEvent.ACTION_POINTER_DOWN -> {
                if (event.pointerCount >= 2) {
                    isPinching = true
                    activePointerId = null
                    lastPinchDistance = event.pointerDistance()
                    _state.update { it.copy(activePoints = emptyList(), inputSource = "لمس متعدد: تكبير وتحريك") }
                }
            }
            MotionEvent.ACTION_MOVE -> {
                val current = _state.value
                if (isPinching && event.pointerCount >= 2) {
                    val distance = event.pointerDistance()
                    val previousDistance = lastPinchDistance ?: distance
                    val zoom = (current.zoom * (distance / previousDistance)).coerceIn(0.5f, 5f)
                    _state.update { it.copy(zoom = zoom, inputSource = "لمس متعدد: تكبير ${"%.2f".format(zoom)}×") }
                    lastPinchDistance = distance
                } else if (current.selectedTool == NativeTool.PAN) {
                    val previous = lastScreenPoint ?: screenPoint
                    _state.update { it.copy(pan = it.pan + (screenPoint - previous), inputSource = source) }
                    lastScreenPoint = screenPoint
                } else if (activePointerId == pointerId && current.selectedTool != NativeTool.COUNT && current.selectedTool != NativeTool.CALIBRATE && current.selectedTool != NativeTool.SEGMENT) {
                    _state.update { it.copy(activePoints = it.activePoints.appendDistinct(planPoint)) }
                }
            }
            MotionEvent.ACTION_UP, MotionEvent.ACTION_POINTER_UP -> {
                if (isPinching) {
                    lastPinchDistance = null
                    activePointerId = null
                    lastScreenPoint = null
                    if (action == MotionEvent.ACTION_UP || event.pointerCount <= 2) isPinching = false
                    _state.update { it.copy(activePoints = emptyList()) }
                    return
                }
                val current = _state.value
                when (current.selectedTool) {
                    NativeTool.PAN -> Unit
                    NativeTool.CALIBRATE -> {
                        val points = (current.calibrationPoints + planPoint).takeLast(2)
                        _state.update {
                            it.copy(
                                calibrationPoints = points,
                                inputSource = if (points.size == 2) "أدخل المسافة الحقيقية ثم اعتمد المقياس" else "المعايرة: حُفظت النقطة الأولى"
                            )
                        }
                    }
                    NativeTool.COUNT -> commit(MeasurementKind.COUNT, listOf(planPoint), 1.0)
                    NativeTool.SEGMENT -> {
                        val points = current.activePoints.take(1) + planPoint
                        if (points.size == 2) commit(MeasurementKind.LINEAR, points, MeasurementEngine.polylineLength(points))
                    }
                    NativeTool.LINEAR -> {
                        val points = current.activePoints.appendDistinct(planPoint)
                        if (points.size >= 2) commit(MeasurementKind.LINEAR, points, MeasurementEngine.polylineLength(points))
                    }
                    NativeTool.AREA -> {
                        val points = current.activePoints.appendDistinct(planPoint)
                        if (points.size >= 3) commit(MeasurementKind.AREA, points, MeasurementEngine.polygonArea(points))
                    }
                    NativeTool.ROOF_AREA -> {
                        val points = current.activePoints.appendDistinct(planPoint)
                        val rise = current.roofRise.toDoubleOrNull()
                        val run = current.roofRun.toDoubleOrNull()
                        if (points.size >= 3 && rise != null && run != null) {
                            commit(MeasurementKind.ROOF_AREA, points, MeasurementEngine.roofArea(MeasurementEngine.polygonArea(points), rise, run))
                        } else {
                            _state.update { it.copy(inputSource = "أدخل rise وrun موجبين قبل قياس السطح المائل") }
                        }
                    }
                    NativeTool.VOLUME -> {
                        val points = current.activePoints.appendDistinct(planPoint)
                        val depth = current.volumeDepth.toDoubleOrNull()
                        if (points.size >= 3 && depth != null) {
                            commit(MeasurementKind.VOLUME, points, MeasurementEngine.volume(MeasurementEngine.polygonArea(points), depth))
                        } else {
                            _state.update { it.copy(inputSource = "أدخل عمقاً موجباً قبل قياس الحجم") }
                        }
                    }
                }
                activePointerId = null
                lastScreenPoint = null
                _state.update { it.copy(activePoints = emptyList()) }
            }
            MotionEvent.ACTION_CANCEL -> {
                activePointerId = null
                lastScreenPoint = null
                lastPinchDistance = null
                isPinching = false
                _state.update { it.copy(activePoints = emptyList(), inputSource = "أُلغي الإدخال لحماية القياس") }
            }
        }
    }

    private fun commit(kind: MeasurementKind, points: List<PlanPoint>, value: Double) {
        val current = _state.value
        val multiplier = current.multiplierInput.toDoubleOrNull()
        if (multiplier == null || !multiplier.isFinite() || multiplier <= 0) {
            _state.update { it.copy(inputSource = "عامل التكرار يجب أن يكون موجباً") }
            return
        }
        val measurement = NativeMeasurement(nextMeasurementId++, kind, points, value, current.selectedLayerId, current.selectedTemplateId, multiplier)
        _state.update { it.copy(measurements = it.measurements + measurement) }
        persistWorkspace()
    }

    private fun List<PlanPoint>.appendDistinct(point: PlanPoint): List<PlanPoint> {
        val last = lastOrNull() ?: return listOf(point)
        return if (kotlin.math.abs(last.x - point.x) < 1f && kotlin.math.abs(last.y - point.y) < 1f) this else this + point
    }

    private fun MotionEvent.pointerDistance(): Float {
        if (pointerCount < 2) return 0f
        return kotlin.math.hypot(getX(0) - getX(1), getY(0) - getY(1))
    }

    private fun persistWorkspace() {
        val current = _state.value
        localStore.save(StoredWorkspace(current.project, current.measurements, current.calibration, current.layers, current.selectedLayerId, current.templates, current.selectedTemplateId))
    }
}
