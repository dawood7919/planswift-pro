package com.takeoff.nativeapp.ui

import android.view.MotionEvent
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.ExperimentalComposeUiApi
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.asImageBitmap
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.input.pointer.pointerInteropFilter
import androidx.compose.ui.layout.onSizeChanged
import androidx.compose.ui.unit.IntOffset
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.IntSize
import androidx.compose.ui.unit.sp
import com.takeoff.nativeapp.MeasurementKind
import com.takeoff.nativeapp.TakeoffUiState
import com.takeoff.nativeapp.measurement.PlanPoint
import kotlin.math.min

private data class PdfFrame(val origin: Offset, val scale: Float) {
    fun toPlanPoint(point: Offset): PlanPoint = PlanPoint((point.x - origin.x) / scale, (point.y - origin.y) / scale)
    fun toScreen(point: PlanPoint): Offset = Offset(origin.x + point.x * scale, origin.y + point.y * scale)
}

@OptIn(ExperimentalComposeUiApi::class)
@Composable
fun TakeoffCanvas(
    state: TakeoffUiState,
    onMotionEvent: (MotionEvent, PlanPoint, Offset) -> Unit
) {
    var viewport = androidx.compose.runtime.remember { IntSize.Zero }
    val bitmap = state.pdfBitmap
    val frame = bitmap?.let {
        val fitted = min(viewport.width / it.width.toFloat(), viewport.height / it.height.toFloat()) * state.zoom
        PdfFrame(Offset((viewport.width - it.width * fitted) / 2f, (viewport.height - it.height * fitted) / 2f) + state.pan, fitted)
    }

    Canvas(
        modifier = Modifier
            .fillMaxSize()
            .onSizeChanged { viewport = it }
            .pointerInteropFilter { event ->
                val point = frame?.toPlanPoint(Offset(event.x, event.y)) ?: PlanPoint(event.x, event.y)
                onMotionEvent(event, point, Offset(event.x, event.y))
                true
            }
    ) {
        drawRect(Color(0xFF06202D))
        if (bitmap != null && frame != null) {
            drawImage(
                image = bitmap.asImageBitmap(),
                dstOffset = IntOffset(frame.origin.x.toInt(), frame.origin.y.toInt()),
                dstSize = IntSize((bitmap.width * frame.scale).toInt(), (bitmap.height * frame.scale).toInt())
            )
            state.measurements.filter { measurement -> state.layers.firstOrNull { it.id == measurement.layerId }?.visible != false }.forEach { measurement ->
                val points = measurement.points.map(frame::toScreen)
                val layerColor = state.layers.firstOrNull { it.id == measurement.layerId }?.let { Color(it.color) } ?: Color(0xFF59C3F5)
                when (measurement.kind) {
                    MeasurementKind.COUNT -> points.firstOrNull()?.let { drawCircle(Color(0xFFFFA26B), radius = 9f, center = it) }
                    MeasurementKind.LINEAR -> if (points.size > 1) for (index in 0 until points.lastIndex) drawLine(layerColor, points[index], points[index + 1], strokeWidth = 5f)
                    MeasurementKind.AREA, MeasurementKind.ROOF_AREA, MeasurementKind.VOLUME -> if (points.size > 2) {
                        val path = androidx.compose.ui.graphics.Path().apply { moveTo(points.first().x, points.first().y); points.drop(1).forEach { lineTo(it.x, it.y) }; close() }
                        drawPath(path, Color(0x5536E39D))
                        drawPath(path, layerColor, style = Stroke(width = 4f))
                    }
                }
            }
            val active = state.activePoints.map(frame::toScreen)
            if (active.size > 1) for (index in 0 until active.lastIndex) drawLine(Color(0xFFFFE082), active[index], active[index + 1], strokeWidth = 3f)
            val calibration = state.calibrationPoints.map(frame::toScreen)
            calibration.forEach { drawCircle(Color(0xFFFFE082), radius = 10f, center = it) }
            if (calibration.size == 2) drawLine(Color(0xFFFFE082), calibration[0], calibration[1], strokeWidth = 4f)
        }
    }
    if (bitmap == null && !state.isLoadingPlan) Text("افتح ملف PDF لبدء القياس", color = Color.White, fontSize = 17.sp, textAlign = TextAlign.Center)
}
