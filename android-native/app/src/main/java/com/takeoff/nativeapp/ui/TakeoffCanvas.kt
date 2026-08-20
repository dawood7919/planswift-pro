package com.takeoff.nativeapp.ui

import android.view.MotionEvent
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.Button
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.remember
import androidx.compose.ui.ExperimentalComposeUiApi
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.asImageBitmap
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.graphics.nativeCanvas
import androidx.compose.ui.input.pointer.pointerInteropFilter
import androidx.compose.ui.layout.onSizeChanged
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.IntOffset
import androidx.compose.ui.unit.IntSize
import androidx.compose.ui.unit.dp
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
    onOpenPlan: () -> Unit,
    onMotionEvent: (MotionEvent, PlanPoint, Offset) -> Unit
) {
    val workspaceSummary = workspaceSummary(state.selectedTool, state.measurements.size, state.calibration?.unit)
    var viewport = remember { IntSize.Zero }
    val bitmap = state.pdfBitmap
    val referenceBitmap = state.referencePdfBitmap
    val frame = bitmap?.let {
        val fitted = min(viewport.width / it.width.toFloat(), viewport.height / it.height.toFloat()) * state.zoom
        PdfFrame(Offset((viewport.width - it.width * fitted) / 2f, (viewport.height - it.height * fitted) / 2f) + state.pan, fitted)
    }
    val referenceFrame = referenceBitmap?.let {
        val fitted = min(viewport.width / it.width.toFloat(), viewport.height / it.height.toFloat()) * state.zoom
        PdfFrame(Offset((viewport.width - it.width * fitted) / 2f, (viewport.height - it.height * fitted) / 2f) + state.pan, fitted)
    }
    Box(modifier = Modifier.fillMaxSize().background(TakeoffCanvasBlue)) {
        androidx.compose.foundation.Canvas(
            modifier = Modifier
                .fillMaxSize()
                .onSizeChanged { viewport = it }
                .pointerInteropFilter { event ->
                    val point = frame?.toPlanPoint(Offset(event.x, event.y)) ?: PlanPoint(event.x, event.y)
                    onMotionEvent(event, point, Offset(event.x, event.y))
                    true
                }
        ) {
            drawRect(TakeoffCanvasBlue)
            for (x in 0..size.width.toInt() step 48) drawLine(Color(0xFF1A485B), Offset(x.toFloat(), 0f), Offset(x.toFloat(), size.height), 1f)
            for (y in 0..size.height.toInt() step 48) drawLine(Color(0xFF1A485B), Offset(0f, y.toFloat()), Offset(size.width, y.toFloat()), 1f)
            if (bitmap != null && frame != null) {
                drawImage(bitmap.asImageBitmap(), dstOffset = IntOffset(frame.origin.x.toInt(), frame.origin.y.toInt()), dstSize = IntSize((bitmap.width * frame.scale).toInt(), (bitmap.height * frame.scale).toInt()))
                if (referenceBitmap != null && referenceFrame != null && state.isReferenceOverlayVisible) {
                    drawImage(referenceBitmap.asImageBitmap(), dstOffset = IntOffset(referenceFrame.origin.x.toInt(), referenceFrame.origin.y.toInt()), dstSize = IntSize((referenceBitmap.width * referenceFrame.scale).toInt(), (referenceBitmap.height * referenceFrame.scale).toInt()), alpha = 0.42f)
                }
                state.measurements.filter { measurement -> state.layers.firstOrNull { it.id == measurement.layerId }?.visible != false }.forEach { measurement ->
                    val points = measurement.points.map(frame::toScreen)
                    val layerColor = state.layers.firstOrNull { it.id == measurement.layerId }?.let { Color(it.color) } ?: Color(0xFF59C3F5)
                    when (measurement.kind) {
                        MeasurementKind.COUNT -> points.firstOrNull()?.let { drawCircle(Color(0xFFFFA26B), radius = 9f, center = it) }
                        MeasurementKind.LINEAR -> if (points.size > 1) for (index in 0 until points.lastIndex) drawLine(layerColor, points[index], points[index + 1], strokeWidth = 5f)
                        MeasurementKind.AREA, MeasurementKind.ROOF_AREA, MeasurementKind.VOLUME -> if (points.size > 2) {
                            val path = androidx.compose.ui.graphics.Path().apply { moveTo(points.first().x, points.first().y); points.drop(1).forEach { lineTo(it.x, it.y) }; close() }
                            drawPath(path, Color(0x4436E39D))
                            drawPath(path, layerColor, style = Stroke(width = 4f))
                            measurement.cutouts.forEach { cutout ->
                                val cutoutPoints = cutout.map(frame::toScreen)
                                if (cutoutPoints.size > 2) {
                                    val cutoutPath = androidx.compose.ui.graphics.Path().apply { moveTo(cutoutPoints.first().x, cutoutPoints.first().y); cutoutPoints.drop(1).forEach { lineTo(it.x, it.y) }; close() }
                                    drawPath(cutoutPath, Color(0x99102E3D))
                                    drawPath(cutoutPath, Color(0xFFFFD078), style = Stroke(width = 3f))
                                }
                            }
                        }
                    }
                }
                state.annotations.forEach { annotation ->
                    val point = frame.toScreen(annotation.point)
                    drawCircle(Color(annotation.color), radius = 7f, center = point)
                    drawContext.canvas.nativeCanvas.drawText(annotation.text, point.x + 10f, point.y - 10f, android.graphics.Paint().apply { color = android.graphics.Color.rgb(255, 224, 130); textSize = 28f; isAntiAlias = true })
                }
                val active = state.activePoints.map(frame::toScreen)
                if (active.size > 1) for (index in 0 until active.lastIndex) drawLine(Color(0xFFFFD078), active[index], active[index + 1], strokeWidth = 3f)
                val calibration = state.calibrationPoints.map(frame::toScreen)
                calibration.forEach { drawCircle(Color(0xFFFFD078), radius = 10f, center = it) }
                if (calibration.size == 2) drawLine(Color(0xFFFFD078), calibration[0], calibration[1], strokeWidth = 4f)
            }
        }
        if (bitmap == null && !state.isLoadingPlan) {
            Surface(modifier = Modifier.align(androidx.compose.ui.Alignment.Center).padding(24.dp), shape = MaterialTheme.shapes.extraLarge, color = Color(0xFFF7FBFD), shadowElevation = 8.dp) {
                Column(modifier = Modifier.padding(24.dp), verticalArrangement = Arrangement.spacedBy(10.dp), horizontalAlignment = androidx.compose.ui.Alignment.CenterHorizontally) {
                    Text("ابدأ من مخطط حقيقي", style = MaterialTheme.typography.titleLarge, color = Color(0xFF163645))
                    Text("افتح ملف PDF، عاير المسافة، ثم اختر أداة القياس المناسبة.", style = MaterialTheme.typography.bodyMedium, color = Color(0xFF4B626D), textAlign = TextAlign.Center)
                    Button(onClick = onOpenPlan) { Text("فتح مخطط PDF") }
                }
            }
        }
        Surface(modifier = Modifier.align(androidx.compose.ui.Alignment.TopStart).padding(12.dp), color = Color(0xD90C2634), shape = MaterialTheme.shapes.medium) {
            Column(modifier = Modifier.padding(horizontal = 11.dp, vertical = 8.dp), verticalArrangement = Arrangement.spacedBy(2.dp)) {
                Text("أداة نشطة", color = Color(0xFFB8CFDB), style = MaterialTheme.typography.labelSmall)
                Text("${workspaceSummary.toolLabel}  ·  ${workspaceSummary.measurementsLabel}", color = TakeoffSignal, style = MaterialTheme.typography.labelLarge)
            }
        }
        if (state.isReferenceOverlayVisible) Surface(modifier = Modifier.align(androidx.compose.ui.Alignment.TopEnd).padding(12.dp), color = Color(0xD6BD6A2E), shape = MaterialTheme.shapes.medium) {
            Text("مراجعة: ${state.referencePdfLabel ?: "مرجع"}", modifier = Modifier.padding(horizontal = 10.dp, vertical = 6.dp), color = Color.White, style = MaterialTheme.typography.labelMedium)
        }
        Surface(modifier = Modifier.align(androidx.compose.ui.Alignment.BottomStart).padding(12.dp), color = Color(0xBF0C2634), shape = MaterialTheme.shapes.medium) {
            Text("${state.inputSource}  ·  ${workspaceSummary.calibrationLabel}", modifier = Modifier.padding(horizontal = 10.dp, vertical = 6.dp), color = Color(0xFFD8E9EF), style = MaterialTheme.typography.labelSmall)
        }
    }
}
