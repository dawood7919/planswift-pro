package com.takeoff.nativeapp

import android.content.Context
import android.graphics.Bitmap
import android.graphics.pdf.PdfRenderer
import android.net.Uri
import android.view.MotionEvent
import androidx.compose.ui.geometry.Offset
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.takeoff.nativeapp.measurement.MeasurementEngine
import com.takeoff.nativeapp.measurement.PlanPoint
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext

enum class NativeTool(val label: String) {
    PAN("تحريك"),
    COUNT("عد"),
    LINEAR("طول"),
    AREA("مساحة")
}

enum class MeasurementKind { COUNT, LINEAR, AREA }

data class NativeMeasurement(
    val id: Long,
    val kind: MeasurementKind,
    val points: List<PlanPoint>,
    val value: Double
)

data class TakeoffUiState(
    val pdfBitmap: Bitmap? = null,
    val pdfLabel: String? = null,
    val selectedTool: NativeTool = NativeTool.PAN,
    val pan: Offset = Offset.Zero,
    val zoom: Float = 1f,
    val activePoints: List<PlanPoint> = emptyList(),
    val measurements: List<NativeMeasurement> = emptyList(),
    val inputSource: String = "لم يبدأ إدخال",
    val isLoadingPlan: Boolean = false,
    val loadError: String? = null
)

class TakeoffViewModel : ViewModel() {
    private val _state = MutableStateFlow(TakeoffUiState())
    val state: StateFlow<TakeoffUiState> = _state.asStateFlow()
    private var lastScreenPoint: Offset? = null
    private var activePointerId: Int? = null
    private var nextMeasurementId = 1L

    fun selectTool(tool: NativeTool) {
        _state.update { it.copy(selectedTool = tool, activePoints = emptyList()) }
    }

    fun clearMeasurements() {
        _state.update { it.copy(measurements = emptyList(), activePoints = emptyList()) }
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
                result.onSuccess { bitmap -> _state.update { it.copy(pdfBitmap = bitmap, isLoadingPlan = false) } }
                    .onFailure { error -> _state.update { it.copy(isLoadingPlan = false, loadError = error.message ?: "تعذر عرض المخطط.") } }
            }
        }
    }

    fun onMotionEvent(event: MotionEvent, planPoint: PlanPoint, screenPoint: Offset) {
        val action = event.actionMasked
        val index = event.actionIndex
        val pointerId = event.getPointerId(index)
        val isStylus = event.getToolType(index) == MotionEvent.TOOL_TYPE_STYLUS
        val source = if (isStylus) "قلم S Pen / Stylus" else "لمس"

        when (action) {
            MotionEvent.ACTION_DOWN, MotionEvent.ACTION_POINTER_DOWN -> {
                activePointerId = pointerId
                lastScreenPoint = screenPoint
                _state.update { current ->
                    when (current.selectedTool) {
                        NativeTool.PAN -> current.copy(inputSource = source)
                        NativeTool.COUNT -> current.copy(inputSource = source)
                        NativeTool.LINEAR, NativeTool.AREA -> current.copy(inputSource = source, activePoints = listOf(planPoint))
                    }
                }
            }
            MotionEvent.ACTION_MOVE -> {
                val current = _state.value
                if (current.selectedTool == NativeTool.PAN) {
                    val previous = lastScreenPoint ?: screenPoint
                    _state.update { it.copy(pan = it.pan + (screenPoint - previous), inputSource = source) }
                    lastScreenPoint = screenPoint
                } else if (activePointerId == pointerId && current.selectedTool != NativeTool.COUNT) {
                    _state.update { it.copy(activePoints = it.activePoints.appendDistinct(planPoint)) }
                }
            }
            MotionEvent.ACTION_UP, MotionEvent.ACTION_POINTER_UP -> {
                val current = _state.value
                when (current.selectedTool) {
                    NativeTool.PAN -> Unit
                    NativeTool.COUNT -> commit(MeasurementKind.COUNT, listOf(planPoint), 1.0)
                    NativeTool.LINEAR -> {
                        val points = current.activePoints.appendDistinct(planPoint)
                        if (points.size >= 2) commit(MeasurementKind.LINEAR, points, MeasurementEngine.polylineLength(points))
                    }
                    NativeTool.AREA -> {
                        val points = current.activePoints.appendDistinct(planPoint)
                        if (points.size >= 3) commit(MeasurementKind.AREA, points, MeasurementEngine.polygonArea(points))
                    }
                }
                activePointerId = null
                lastScreenPoint = null
                _state.update { it.copy(activePoints = emptyList()) }
            }
            MotionEvent.ACTION_CANCEL -> {
                activePointerId = null
                lastScreenPoint = null
                _state.update { it.copy(activePoints = emptyList(), inputSource = "أُلغي الإدخال لحماية القياس") }
            }
        }
    }

    private fun commit(kind: MeasurementKind, points: List<PlanPoint>, value: Double) {
        val measurement = NativeMeasurement(nextMeasurementId++, kind, points, value)
        _state.update { it.copy(measurements = it.measurements + measurement) }
    }

    private fun List<PlanPoint>.appendDistinct(point: PlanPoint): List<PlanPoint> {
        val last = lastOrNull() ?: return listOf(point)
        return if (kotlin.math.abs(last.x - point.x) < 1f && kotlin.math.abs(last.y - point.y) < 1f) this else this + point
    }
}
